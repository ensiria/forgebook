/**
 * One benchmark: every metric asked for, for every tool asked for, with the machine's state beside the numbers.
 *
 * @remarks
 * The tools take turns, sample by sample and with the order rotating, so a machine that gets busier halfway does not
 * land on one tool. A group that fails for one tool is recorded and the others go on, so one tool's problem does not
 * lose the others' hours; a tool that will not even install fails alone too. Metrics a tool cannot have are `absent`,
 * with the reason, and never a zero. The status file is written before each sample.
 *
 * @module
 */
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { chromium } from "@playwright/test";

import type { BenchReport, MachineReading, MetricResult, ToolName } from "./bench.types.ts";
import { summary } from "./benchStats.ts";
import type { CorpusSize } from "./corpus.ts";
import { machineInfo, noiseWarnings, readMachine } from "./machine.ts";
import {
  baseOf,
  measureBuild,
  measureComponentPage,
  measureEdits,
  measureFirstLoad,
  measureMemory,
  measureStart
} from "./measure.ts";
import { type BenchFolders, directDependencies } from "./prepare.ts";
import {
  type PreparedRun,
  prepareGenerated,
  prepareReal,
  type RealRun,
  realCorpusInfo,
  type ToolRun
} from "./prepareRun.ts";
import type { RunStep } from "./statusFile.ts";
import { type SweepResult, sweepStories } from "./sweep.ts";
import type { Target } from "./targets.ts";

/** The groups of metrics, as `--metric` names them. */
export const METRIC_GROUPS = ["install", "start", "hmr", "page", "memory", "build", "sweep"] as const;

/** A group of metrics. */
export type MetricGroup = (typeof METRIC_GROUPS)[number];

/** Runs of the memory metrics: a peak is steadier than a time. */
const MEMORY_RUNS = 3;

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
  /** The first port of the run; each tool takes the next, so a server that lingers cannot answer for another. */
  readonly port: number;
  /** The corpus's size. */
  readonly size: CorpusSize;
  /** The real library, when the run is on one. */
  readonly real?: RealRun;
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

/** How many samples a group takes per tool, for the status's progress. */
const groupSteps = (group: MetricGroup, runs: number, hasPage: boolean): number => {
  if (group === "install") return 1;
  if (group === "start") return runs * 2 + 1;
  if (group === "hmr") return 3;
  if (group === "page") return hasPage ? runs + 2 : 0;
  if (group === "memory") return MEMORY_RUNS * (hasPage ? 2 : 1) + 1;
  if (group === "sweep") return 1;
  return runs + 1;
};

/** A measured result of a unit, from its samples. */
const measured = (unit: "ms" | "bytes" | "count", values: readonly number[]): MetricResult => ({
  kind: "measured",
  unit,
  summary: summary(values)
});

/** The steps a group goes through: a sample taken of each tool in turn. */
type Turns = {
  /** Reports a step. */
  readonly step: (tool: ToolRun, metric: string, run: number, runs: number) => void;
};

/**
 * The order of a round: rotated by one each round, so each tool leads in turn, and reversed every other round, so no
 * tool always follows the same one.
 *
 * @param items - the tools, or anything taking turns.
 * @param run - the round, from 1.
 */
export const roundOrder = <TItem>(items: readonly TItem[], run: number): TItem[] => {
  const rotation = run % items.length;
  const rotated = [...items.slice(rotation), ...items.slice(0, rotation)];
  return run % 2 === 0 ? rotated : rotated.toReversed();
};

/**
 * Takes samples of every tool in turns, the order rotating each round. A tool that fails drops out of the group and
 * has the failure recorded; the others go on.
 *
 * @param tools - the tools.
 * @param failedGroup - the group, the name a failure is recorded under.
 * @param metric - the metric, for the status.
 * @param runs - how many rounds.
 * @param turns - how steps are reported.
 * @param take - takes one sample.
 * @returns each tool's samples, for those that did not fail.
 */
const inTurns = async <TSample>(
  tools: readonly ToolRun[],
  failedGroup: string,
  metric: string,
  runs: number,
  turns: Turns,
  take: (tool: ToolRun) => Promise<TSample>
): Promise<Map<ToolRun, TSample[]>> => {
  const samples = new Map<ToolRun, TSample[]>(tools.map((tool) => [tool, []]));
  for (let run = 1; run <= runs; run += 1) {
    for (const tool of roundOrder(tools, run)) {
      if (!samples.has(tool)) continue;
      turns.step(tool, metric, run, runs);
      try {
        samples.get(tool)?.push(await take(tool));
      } catch (error) {
        tool.metrics[failedGroup] = {
          kind: "failed",
          reason: error instanceof Error ? error.message : String(error)
        };
        samples.delete(tool);
      }
    }
  }
  return samples;
};

/**
 * Writes a metric from samples, for each tool that has them.
 *
 * @param samples - the samples by tool.
 * @param name - the metric.
 * @param unit - its unit.
 * @param value - what a sample contributes; none where the sample has no such thing.
 */
const record = <TSample>(
  samples: ReadonlyMap<ToolRun, readonly TSample[]>,
  name: string,
  unit: "ms" | "bytes",
  value: (sample: TSample) => number | undefined
): void => {
  for (const [tool, values] of samples) {
    const numbers = values.flatMap((sample) => {
      const number = value(sample);
      return number === undefined ? [] : [number];
    });
    if (numbers.length > 0) tool.metrics[name] = measured(unit, numbers);
  }
};

/** What a group of metrics works with. */
type GroupRun = {
  /** The tools. */
  readonly tools: readonly ToolRun[];
  /** The benchmark. */
  readonly request: BenchRequest;
  /** How steps are reported. */
  readonly turns: Turns;
};

/** A server started once on a warm cache, so a group means the same alone and after the others. */
const warmUp = (
  group: MetricGroup,
  tools: readonly ToolRun[],
  metric: string,
  turns: Turns
): Promise<unknown> => inTurns(tools, group, metric, 1, turns, (tool) => measureStart(tool.context, false));

/** The address of a tool's component page. */
const pageAddress = ({ context }: ToolRun): string => context.subject.pageAddress?.(baseOf(context)) ?? "";

/** Records why the tools without a page of a component's stories have none of a group's metrics. */
const markPageless = (tools: readonly ToolRun[], metrics: readonly string[]): readonly ToolRun[] => {
  const paged = tools.filter((tool) => tool.context.subject.pageAddress !== undefined);
  for (const tool of tools.filter((each) => !paged.includes(each))) {
    for (const metric of metrics) {
      const { name } = tool.context.target;
      tool.metrics[metric] = { kind: "absent", reason: `${name} has no page of a component's stories` };
    }
  }
  return paged;
};

/** The install metrics, already measured when the tool was installed. */
const installGroup = async ({ tools, turns }: GroupRun): Promise<void> => {
  for (const tool of tools) {
    turns.step(tool, "install", 1, 1);
    const { target, directory } = tool.context;
    if (tool.install === undefined) {
      tool.metrics["installSize"] = { kind: "absent", reason: "measured on the generated library" };
      continue;
    }
    tool.metrics["installSize"] = measured("bytes", [tool.install.result.size]);
    tool.metrics["installAdded"] = measured("bytes", [tool.install.onBare]);
    tool.metrics["packages"] = measured("count", [tool.install.result.packages]);
    tool.metrics["directDependencies"] = measured("count", [
      await directDependencies(directory, target.mainPackage)
    ]);
  }
};

/** Cold and warm starts. */
const startGroup = async ({ tools, request: { runs }, turns }: GroupRun): Promise<void> => {
  const cold = await inTurns(tools, "start", "coldStart", runs, turns, (tool) =>
    measureStart(tool.context, true)
  );
  record(cold, "coldStart", "ms", (sample) => sample.story);
  record(cold, "sidebarReady", "ms", (sample) => sample.sidebar);
  await warmUp("start", tools, "warmStart", turns);
  const warm = await inTurns(tools, "start", "warmStart", runs, turns, (tool) =>
    measureStart(tool.context, false)
  );
  record(warm, "warmStart", "ms", (sample) => sample.story);
};

/** Edits of a story and of a component. */
const hmrGroup = async ({ tools, request: { edits }, turns }: GroupRun): Promise<void> => {
  await warmUp("hmr", tools, "hmrStory", turns);
  const story = await inTurns(tools, "hmr", "hmrStory", 1, turns, (tool) =>
    measureEdits(tool.context, "story", edits)
  );
  for (const [tool, samples] of story) tool.metrics["hmrStory"] = measured("ms", samples.flat());
  const component = await inTurns(tools, "hmr", "hmrComponent", 1, turns, (tool) =>
    measureEdits(tool.context, "component", edits)
  );
  for (const [tool, samples] of component) tool.metrics["hmrComponent"] = measured("ms", samples.flat());
};

/** A component's page and its table of props. */
const pageGroup = async ({ tools, request: { runs }, turns }: GroupRun): Promise<void> => {
  const paged = markPageless(tools, ["componentPage", "firstPropsTable"]);
  await warmUp("page", paged, "componentPage", turns);
  // the page's own dependencies, which a story's page does not load, before anything is timed
  await inTurns(paged, "page", "componentPage", 1, turns, (tool) =>
    measureComponentPage(tool.context, pageAddress(tool))
  );
  const visits = await inTurns(paged, "page", "componentPage", runs, turns, (tool) =>
    measureComponentPage(tool.context, pageAddress(tool))
  );
  record(visits, "componentPage", "ms", (sample) => sample.stories);
  record(visits, "firstPropsTable", "ms", (sample) => sample.props);
};

/** The server's memory, on a story's page, which every tool has, and on a component's. */
const memoryGroup = async ({ tools, turns }: GroupRun): Promise<void> => {
  await warmUp("memory", tools, "serverMemory", turns);
  const story = await inTurns(tools, "memory", "serverMemory", MEMORY_RUNS, turns, (tool) =>
    measureMemory(tool.context, tool.context.subject.storyAddress(baseOf(tool.context)))
  );
  record(story, "serverMemory", "bytes", (sample) => sample);
  const paged = markPageless(tools, ["serverMemoryDocs"]);
  const docs = await inTurns(paged, "memory", "serverMemoryDocs", MEMORY_RUNS, turns, (tool) =>
    measureMemory(tool.context, pageAddress(tool))
  );
  record(docs, "serverMemoryDocs", "bytes", (sample) => sample);
  // last, since it empties the caches the two above were measured with
  const cold = await inTurns(tools, "memory", "serverMemoryCold", MEMORY_RUNS, turns, (tool) =>
    measureMemory(tool.context, tool.context.subject.storyAddress(baseOf(tool.context)), true)
  );
  record(cold, "serverMemoryCold", "bytes", (sample) => sample);
};

/** The build, and what a first load of it fetches. */
const buildGroup = async ({ tools, request: { runs }, turns }: GroupRun): Promise<void> => {
  const builds = await inTurns(tools, "build", "build", runs, turns, (tool) => measureBuild(tool.context));
  record(builds, "build", "ms", (sample) => sample.time);
  record(builds, "buildSize", "bytes", (sample) => sample.size);
  const loads = await inTurns([...builds.keys()], "build", "firstLoad", 1, turns, (tool) =>
    measureFirstLoad(tool.context)
  );
  record(loads, "shellJs", "bytes", (sample) => sample.shell);
  record(loads, "frameJs", "bytes", (sample) => sample.frame);
  record(loads, "firstLoadJs", "bytes", (sample) => sample.total);
  record(loads, "searchJs", "bytes", (sample) => sample.search);
  for (const [tool, samples] of loads) {
    const { name } = tool.context.target;
    if (samples[0]?.search === undefined)
      tool.metrics["searchJs"] = { kind: "absent", reason: `${name} loads its search with its page` };
    if (samples[0]?.frame !== undefined) continue;
    tool.metrics["frameJs"] = { kind: "absent", reason: `${name} draws stories in its own page` };
  }
};

/** The stories that draw, Forgebook's alone: Storybook is what a story is read against. */
const sweepGroup =
  (found: { result?: SweepResult }) =>
  async ({ tools, turns }: GroupRun): Promise<void> => {
    for (const tool of tools) {
      const { name } = tool.context.target;
      if (name !== "forgebook") {
        tool.metrics["storiesDrawn"] = { kind: "absent", reason: `${name} is what a story is read against` };
        continue;
      }
      turns.step(tool, "storiesDrawn", 1, 1);
      try {
        const result = await sweepStories(tool.context, () => undefined);
        found.result = result;
        tool.metrics["storiesListed"] = measured("count", [result.listed]);
        tool.metrics["storiesDrawn"] = measured("count", [result.drawn]);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        tool.metrics["storiesDrawn"] = { kind: "failed", reason };
      }
    }
  };

/** Each group's work. */
const GROUPS: Readonly<Record<Exclude<MetricGroup, "sweep">, (run: GroupRun) => Promise<void>>> = {
  install: installGroup,
  start: startGroup,
  hmr: hmrGroup,
  page: pageGroup,
  memory: memoryGroup,
  build: buildGroup
};

/**
 * Runs a benchmark.
 *
 * @param request - what to measure.
 * @returns the report.
 */
export const runBench = async (request: BenchRequest): Promise<BenchReport> => {
  const { folders, targets, size, io, groups, runs, real } = request;
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch();
  const report: Partial<Record<ToolName, Record<string, MetricResult>>> = {};
  const versions: Partial<Record<ToolName, Record<string, string>>> = {};
  const prepared: PreparedRun = { browser, report, versions, tools: [] };
  const measuredName =
    real === undefined
      ? await prepareGenerated(request, prepared)
      : await prepareReal(request, real, prepared);
  const { tools } = prepared;

  const total = tools.reduce((all, tool) => {
    const hasPage = tool.context.subject.pageAddress !== undefined;
    return all + groups.reduce((sum, group) => sum + groupSteps(group, runs, hasPage), 0);
  }, 0);
  let done = 0;
  const turns: Turns = {
    step: (tool, metric, run, stepRuns) => {
      request.onStep({ tool: tool.context.target.name, metric, run, runs: stepRuns, done, total });
      done += 1;
    }
  };
  const readings: MachineReading[] = [];
  const warnings: string[] = [];
  const swept: { result?: SweepResult } = {};
  const readNow = async (moment: string): Promise<void> => {
    const reading = await readMachine(folders.work, io);
    if (reading === undefined) return;
    readings.push({ moment, reading });
    warnings.push(...noiseWarnings(reading).map((warning) => `${moment}: ${warning}`));
  };
  try {
    for (const group of groups) {
      await readNow(group);
      const work = group === "sweep" ? sweepGroup(swept) : GROUPS[group];
      await work({ tools, request, turns });
    }
    await readNow("end");
  } finally {
    await browser.close();
  }
  return {
    version: 1,
    startedAt,
    forgebook: request.forgebookLabel,
    corpus: real === undefined ? size : realCorpusInfo(real.corpus),
    measured: measuredName,
    runs,
    throttle: request.throttle,
    machine: machineInfo(process.version),
    readings,
    warnings,
    tools: Object.fromEntries(
      targets.map((target) => [
        target.name,
        { versions: versions[target.name] ?? {}, metrics: report[target.name] ?? {} }
      ])
    ),
    ...(swept.result === undefined ? {} : { sweep: swept.result })
  };
};
