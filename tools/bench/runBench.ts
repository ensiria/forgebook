/**
 * One benchmark: every metric asked for, for every tool asked for, with the machine's state beside the numbers.
 *
 * @remarks
 * A metric that fails is recorded and the run goes on, so one tool's problem does not lose the others' hours. Metrics a
 * tool cannot have are `absent`, with the reason, and never a zero. The status file is written before each sample.
 *
 * @module
 */
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { type Browser, chromium } from "@playwright/test";

import type { BenchReport, MachineReadings, MetricResult, ToolName, ToolResult } from "./bench.types.ts";
import { summary } from "./benchStats.ts";
import { buildCorpus, type CorpusComponent, type CorpusSize } from "./corpus.ts";
import { machineInfo, noiseWarnings, readMachine } from "./machine.ts";
import {
  type MeasureContext,
  measureBuild,
  measureComponentPage,
  measureEdits,
  measureFirstLoad,
  measureMemory,
  measureStart
} from "./measure.ts";
import {
  type BenchFolders,
  directDependencies,
  type InstallResult,
  installedVersion,
  installTarget,
  targetSource,
  writeProject
} from "./prepare.ts";
import type { RunStep } from "./statusFile.ts";
import type { Target } from "./targets.ts";

/** The groups of metrics, as `--metric` names them. */
export const METRIC_GROUPS = ["install", "start", "hmr", "page", "memory", "build"] as const;

/** A group of metrics. */
export type MetricGroup = (typeof METRIC_GROUPS)[number];

/** Runs of the memory metric: it is a peak, steadier than a time. */
const MEMORY_RUNS = 3;

/** The first port of a run; each tool takes the next, so a server that lingers cannot answer for another. */
const FIRST_PORT = 62_100;

/** What a benchmark is asked to do. */
export type BenchRequest = {
  /** Where to work. */
  readonly folders: BenchFolders;
  /** The tools. */
  readonly targets: readonly Target[];
  /** Forgebook's packages: tarballs or a published version. */
  readonly forgebookPackages: Readonly<Record<string, string>>;
  /** What the report says was measured of Forgebook. */
  readonly forgebookLabel: string;
  /** The corpus's size. */
  readonly size: CorpusSize;
  /** Runs of each time. */
  readonly runs: number;
  /** Edits of each file. */
  readonly edits: number;
  /** The groups of metrics. */
  readonly groups: readonly MetricGroup[];
  /** The browser's CPU throttle, 1 for none. */
  readonly throttle: number;
  /** The script's streams. */
  readonly io: ScriptIo;
  /** Reports a step, before its sample starts. */
  readonly onStep: (step: RunStep) => void;
};

/** How many samples each group takes, for the status's progress. */
const groupSteps = (group: MetricGroup, runs: number): number => {
  if (group === "install") return 1;
  if (group === "start") return runs * 2 + 1;
  if (group === "hmr") return 2;
  if (group === "page") return runs;
  if (group === "memory") return MEMORY_RUNS;
  return runs + 1;
};

/** Samples a value, in order, reporting each. */
const sampled = async <TSample>(
  runs: number,
  onSample: (run: number) => void,
  take: () => Promise<TSample>
): Promise<TSample[]> => {
  const samples: TSample[] = [];
  for (let run = 1; run <= runs; run += 1) {
    onSample(run);
    samples.push(await take());
  }
  return samples;
};

/** A measured time. */
const timeResult = (values: readonly number[]): MetricResult => ({
  kind: "measured",
  unit: "ms",
  summary: summary(values)
});

/** A measured size. */
const sizeResult = (values: readonly number[]): MetricResult => ({
  kind: "measured",
  unit: "bytes",
  summary: summary(values)
});

/** A measured count. */
const countResult = (value: number): MetricResult => ({
  kind: "measured",
  unit: "count",
  summary: summary([value])
});

/**
 * The metrics of one tool's groups, each group failing on its own.
 *
 * @param request - the benchmark.
 * @param target - the tool.
 * @param context - the measurement's context.
 * @param install - the tool's install, and the bare project's.
 * @param step - reports a step.
 */
const toolMetrics = async (
  request: BenchRequest,
  target: Target,
  context: MeasureContext,
  install: { readonly tool: InstallResult; readonly bare: InstallResult },
  step: (metric: string, run: number, runs: number) => void
): Promise<Record<string, MetricResult>> => {
  const { runs, edits } = request;
  const { component, directory } = context;
  const componentAddress = target.componentUrl?.(`http://127.0.0.1:${context.port}/`, component);
  const groups: Readonly<Record<MetricGroup, () => Promise<Record<string, MetricResult>>>> = {
    install: async () => ({
      installSize: sizeResult([install.tool.size]),
      installAdded: sizeResult([install.tool.size - install.bare.size]),
      packages: countResult(install.tool.packages),
      directDependencies: countResult(await directDependencies(directory, target.mainPackage))
    }),
    start: async () => {
      const cold = await sampled(
        runs,
        (run) => step("coldStart", run, runs),
        () => measureStart(context, true)
      );
      step("warmStart", 0, runs);
      await measureStart(context, false);
      const warm = await sampled(
        runs,
        (run) => step("warmStart", run, runs),
        () => measureStart(context, false)
      );
      return {
        coldStart: timeResult(cold.map((sample) => sample.story)),
        sidebarReady: timeResult(cold.map((sample) => sample.sidebar)),
        warmStart: timeResult(warm.map((sample) => sample.story))
      };
    },
    hmr: async () => {
      step("hmrStory", 1, 1);
      const story = await measureEdits(context, "story", edits);
      step("hmrComponent", 1, 1);
      const edited = await measureEdits(context, "component", edits);
      return { hmrStory: timeResult(story), hmrComponent: timeResult(edited) };
    },
    page: async () => {
      if (componentAddress === undefined) {
        const absent: MetricResult = {
          kind: "absent",
          reason: `${target.name} has no page of a component's stories`
        };
        return {
          componentPage: absent,
          firstPropsTable: { kind: "absent", reason: `${target.name} has no props table` }
        };
      }
      const visits = await sampled(
        runs,
        (run) => step("componentPage", run, runs),
        () => measureComponentPage(context, componentAddress)
      );
      const tables = visits.flatMap((visit) => (visit.props === undefined ? [] : [visit.props]));
      return {
        componentPage: timeResult(visits.map((visit) => visit.stories)),
        firstPropsTable: timeResult(tables)
      };
    },
    memory: async () => {
      const address = componentAddress ?? target.storyUrl(`http://127.0.0.1:${context.port}/`, component);
      const peaks = await sampled(
        MEMORY_RUNS,
        (run) => step("serverMemory", run, MEMORY_RUNS),
        () => measureMemory(context, address)
      );
      return { serverMemory: sizeResult(peaks) };
    },
    build: async () => {
      const builds = await sampled(
        runs,
        (run) => step("build", run, runs),
        () => measureBuild(context)
      );
      step("firstLoad", 1, 1);
      const load = await measureFirstLoad(context);
      return {
        build: timeResult(builds.map((sample) => sample.time)),
        buildSize: sizeResult(builds.map((sample) => sample.size)),
        shellJs: sizeResult([load.shell]),
        frameJs:
          load.frame === undefined
            ? { kind: "absent", reason: `${target.name} draws stories in its own page` }
            : sizeResult([load.frame])
      };
    }
  };
  const metrics: Record<string, MetricResult> = {};
  for (const group of request.groups) {
    try {
      Object.assign(metrics, await groups[group]());
    } catch (error) {
      metrics[group] = { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
    }
  }
  return metrics;
};

/**
 * Runs a benchmark.
 *
 * @param request - what to measure.
 * @returns the report.
 */
export const runBench = async (request: BenchRequest): Promise<BenchReport> => {
  const { folders, targets, size, io, groups, runs } = request;
  const startedAt = new Date().toISOString();
  const corpus = buildCorpus(size);
  const measured: CorpusComponent | undefined = corpus.components[0];
  if (measured === undefined) throw new Error("the corpus has no component");
  const total = targets.length * groups.reduce((sum, group) => sum + groupSteps(group, runs), 0);
  const bare = await installTarget(
    targetSource(folders.repository, "bare"),
    join(folders.work, "bare"),
    undefined,
    io
  );
  const browser: Browser = await chromium.launch();
  const tools: Partial<Record<ToolName, ToolResult>> = {};
  const readings: Partial<Record<ToolName, MachineReadings>> = {};
  const warnings: string[] = [];
  let done = 0;
  try {
    for (const [index, target] of targets.entries()) {
      const directory = join(folders.work, target.name);
      const tool = await installTarget(
        targetSource(folders.repository, target.name),
        directory,
        target.name === "forgebook" ? request.forgebookPackages : undefined,
        io
      );
      await writeProject(target, corpus, directory);
      const reading = await readMachine(folders.work, io);
      if (reading !== undefined) {
        readings[target.name] = reading;
        warnings.push(...noiseWarnings(reading).map((warning) => `${target.name}: ${warning}`));
      }
      const context: MeasureContext = {
        target,
        directory,
        browser,
        port: FIRST_PORT + index,
        component: measured,
        throttle: request.throttle,
        io
      };
      const step = (metric: string, run: number, stepRuns: number): void => {
        request.onStep({ tool: target.name, metric, run, runs: stepRuns, done, total });
        done += 1;
      };
      const metrics = await toolMetrics(request, target, context, { tool, bare }, step);
      const versions = await Promise.all(
        target.packages.map(async (name) => [name, await installedVersion(directory, name)] as const)
      );
      tools[target.name] = { versions: Object.fromEntries(versions), metrics };
    }
  } finally {
    await browser.close();
  }
  return {
    version: 1,
    startedAt,
    forgebook: request.forgebookLabel,
    corpus: size,
    throttle: request.throttle,
    machine: machineInfo(process.version),
    readings,
    warnings,
    tools
  };
};
