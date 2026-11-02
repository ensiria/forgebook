#!/usr/bin/env node
/**
 * The `bench` command: measures Forgebook as a user gets it, on a generated library, and with `--compare` Storybook
 * and Ladle on the same library. See its README for what each number means.
 *
 * @module
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { table } from "@ensiria/cli-kit/layout";
import type { OutputStyle } from "@ensiria/cli-kit/log.types";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";

import type { BenchReport } from "./bench.types.ts";
import { budgetLines, parseBudget } from "./budget.ts";
import { stopLeftovers } from "./leftovers.ts";
import { stopAllServers } from "./measure.ts";
import { type BenchFolders, packForgebook, publishedForgebook } from "./prepare.ts";
import { type RealRun, realTargets } from "./prepareRun.ts";
import { corpusPaths, DEFINITION_FILE, definitionFolder, parseCorpus } from "./realCorpus.ts";
import { parseReport, reportMarkdown, reportProblems, reportRows } from "./reportTable.ts";
import { METRIC_GROUPS, type MetricGroup, runBench } from "./runBench.ts";
import { statusWriter } from "./statusFile.ts";
import { FORGEBOOK, TARGETS, type Target } from "./targets.ts";

/** The share two runs' medians may differ by and still count as reproduced. */
const REPRODUCIBLE_WITHIN = 0.1;

/** The repository's root, from this file. */
const REPOSITORY = resolve(import.meta.dirname, "../..");

/** The report as a table for a terminal. */
const plainTable = (report: BenchReport, style: OutputStyle): string => {
  const { tools, rows } = reportRows(report);
  return table(rows, { columns: ["metric", ...tools].map((header) => ({ header })) }, style);
};

/** Whether a word names a group of metrics. */
const isGroup = (word: string): word is MetricGroup => METRIC_GROUPS.some((group) => group === word);

/** A file an option names, parsed, or nothing when the option is not given. */
const readOptional = <TResult,>(
  path: string | undefined,
  parse: (text: string) => TResult
): TResult | undefined => (path === undefined ? undefined : parse(readFileSync(path, "utf8")));

/** The folder of this repository's corpora. */
const CORPORA = join(import.meta.dirname, "corpora");

/** The groups a real library is measured on when none is named: its install is the library's, not the tool's. */
const REAL_GROUPS: readonly MetricGroup[] = ["sweep", "start", "hmr", "page", "memory", "build"];

/** The real library `--corpus` names, read and checked before any work. */
const realRun = (argument: string | undefined, work: string): RealRun | undefined => {
  if (argument === undefined) return undefined;
  const definition = definitionFolder(argument, CORPORA, process.cwd());
  const file = join(definition, DEFINITION_FILE);
  const corpus = parseCorpus(readFileSync(file, "utf8"), file);
  return { corpus, paths: corpusPaths(corpus, definition, work) };
};

/** Why a run on a real library found another number of stories than its definition states; nothing when it agrees. */
const countProblems = ({ sweep, corpus }: BenchReport): readonly string[] => {
  if (sweep === undefined || corpus.real === undefined) return [];
  const missing = corpus.stories - sweep.listed;
  const lost = sweep.listed - sweep.drawn;
  return [
    ...(missing === 0 ? [] : [`${missing} of ${corpus.stories} stories were not listed`]),
    ...(lost === 0 ? [] : [`${lost} of ${sweep.listed} stories did not draw`])
  ];
};

/** The tools a run measures. */
const toolsOf = (real: RealRun | undefined, isCompared: boolean): readonly Target[] => {
  if (real !== undefined) return realTargets(real.corpus, real.paths.clone, isCompared);
  return isCompared ? TARGETS : [FORGEBOOK];
};

/** The groups a run measures: the ones named, or all of them. */
const metricGroups = (words: readonly string[], isReal: boolean): MetricGroup[] => {
  const unknown = words.filter((word) => !isGroup(word));
  if (unknown.length > 0) {
    throw new ScriptError(`unknown --metric: ${unknown.join(", ")}`, { hint: METRIC_GROUPS.join(", ") });
  }
  if (words.length > 0) return words.filter(isGroup);
  return isReal ? [...REAL_GROUPS] : METRIC_GROUPS.filter((group) => group !== "sweep");
};

/** The Forgebook measured: a published release, or this checkout, packed and named by its commit. */
const forgebookUnderTest = async (
  version: string | undefined,
  folders: BenchFolders,
  io: ScriptIo,
  warn: (message: string) => void
): Promise<{ readonly packages: Readonly<Record<string, string>>; readonly label: string }> => {
  if (version !== undefined) return { packages: publishedForgebook(version), label: version };
  const packages = await packForgebook(folders, io);
  const { stdout: commit } = await exec("git", ["rev-parse", "--short", "HEAD"], { cwd: REPOSITORY, io });
  const { stdout: changes } = await exec("git", ["status", "--porcelain"], { cwd: REPOSITORY, io });
  // a published number names a commit: what makes it not one is said, or nobody can tell why
  if (changes.trim() !== "")
    warn(`the checkout has changes, so the report reads -dirty:\n${changes.trimEnd()}`);
  return { packages, label: `${commit.trim()}${changes.trim() === "" ? "" : "-dirty"}` };
};

await defineScript({
  name: "bench",
  command: "node tools/bench/bench.mts",
  summary:
    "Measure Forgebook as installed: start, HMR, pages, memory, build and install, on a generated library.",
  icon: "check",
  json: true,
  options: {
    compare: {
      type: "boolean",
      description:
        "Also measure Storybook and Ladle on the same library; on --corpus, the library's own Storybook."
    },
    corpus: {
      type: "string",
      valueName: "name-or-folder",
      description:
        "Run on a real library at a pinned commit: a name under tools/bench/corpora, or a folder holding corpus.json."
    },
    components: { type: "number", default: 100, description: "Components of the generated library." },
    stories: { type: "number", default: 500, description: "Stories of the generated library." },
    runs: { type: "number", default: 5, description: "Runs of each time." },
    port: {
      type: "number",
      default: 62_100,
      description: "The first port the tools' servers listen on: two runs on one machine need their own."
    },
    edits: { type: "number", default: 60, description: "Edits of each file, for HMR." },
    markdown: { type: "boolean", description: "Print the results as a Markdown table." },
    work: {
      type: "string",
      valueName: "folder",
      description: "Where to install and generate, outside the repository; beside it by default."
    },
    metric: {
      type: "string",
      multiple: true,
      valueName: "group",
      description: `Only these groups: ${METRIC_GROUPS.join(", ")}.`
    },
    throttle: {
      type: "number",
      default: 1,
      description: "Slow the browser's CPU by this factor; Node is not slowed."
    },
    status: {
      type: "string",
      valueName: "file",
      description: "Append a JSON line per step, written only between measurements, for something to follow."
    },
    against: {
      type: "string",
      valueName: "report",
      description:
        "Fail when a time's median moved more than 10 % from this report of the same corpus, machine and commit."
    },
    budget: {
      type: "string",
      valueName: "file",
      description: "Fail when a metric of Forgebook is over this file's limit, or missing from the run."
    },
    "forgebook-version": {
      type: "string",
      valueName: "version",
      description: "Measure this published release instead of this checkout."
    }
  },
  examples: [
    { command: "bench", description: "Forgebook alone, every metric." },
    { command: "bench --compare --json", description: "The three tools, as a report." },
    {
      command: "bench --corpus primer --work /tmp/bench",
      description: "Forgebook on Primer's stories: every story opened, then the timings."
    },
    { command: "bench --metric hmr --runs 3", description: "Only the edits." }
  ],
  run: async ({ options, io, log, style, isJson, onExit }) => {
    const startedAt = Date.now();
    onExit(stopAllServers);
    // read first: this run overwrites the last report, which could otherwise be compared with itself
    const earlier = readOptional(options.against, parseReport);
    const budget = readOptional(options.budget, parseBudget);
    const work = resolve(options.work ?? join(REPOSITORY, "..", "forgebook-bench"));
    const real = realRun(options.corpus, work);
    const groups = metricGroups(options.metric, real !== undefined);
    mkdirSync(work, { recursive: true });
    const folders = { repository: REPOSITORY, work };
    const version = options["forgebook-version"];
    log.info(version === undefined ? "Packing this checkout's Forgebook" : `Measuring Forgebook ${version}`);
    const { packages: forgebookPackages, label: forgebookLabel } = await forgebookUnderTest(
      version,
      folders,
      io,
      (message) => log.warn(message)
    );
    const write = statusWriter(options.status, Date.now);
    // also when the run dies: a reader must not wait for a step that will not come
    const removeEnd = onExit(() => write({ state: "finished", warnings: 0 }));
    // whatever happens: a tool's daemon left running would weigh on every later run
    const stopLeft = async (): Promise<void> => {
      for (const left of await stopLeftovers(work, startedAt, io))
        log.warn(`stopped a process the run left running: ${left.pid} ${left.command}`);
    };
    let report: Awaited<ReturnType<typeof runBench>>;
    try {
      report = await runBench({
        folders,
        targets: toolsOf(real, options.compare),
        ...(real === undefined ? {} : { real }),
        forgebookPackages,
        forgebookLabel,
        size: { components: options.components, stories: options.stories },
        runs: options.runs,
        edits: options.edits,
        groups,
        port: options.port,
        throttle: options.throttle,
        io,
        onStep: (step) => {
          write(step);
          log.info(`${step.tool} · ${step.metric} · ${step.run}/${step.runs}`);
        }
      });
    } finally {
      await stopLeft();
    }
    removeEnd();
    write({ state: "finished", warnings: report.warnings.length });
    const reportFile = real === undefined ? "report.json" : `report-${real.corpus.name}.json`;
    writeFileSync(join(work, reportFile), `${JSON.stringify(report, null, 2)}\n`);
    for (const warning of report.warnings) log.warn(`not a quiet machine: ${warning}`);
    if (options.markdown) {
      io.stdout.write(`${reportMarkdown(report)}\n`);
    } else if (!isJson) {
      io.stdout.write(`${plainTable(report, style)}\n`);
    }
    const problems = [
      ...reportProblems(report, earlier, REPRODUCIBLE_WITHIN),
      ...budgetLines(report, budget),
      ...countProblems(report)
    ];
    for (const problem of problems) log.error(problem);
    if (problems.length > 0) {
      throw new ScriptError(`${problems.length} problems with this run`, {
        hint: `The report is in ${join(work, reportFile)}`
      });
    }
    return report;
  }
}).run();
