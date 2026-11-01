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
import { table } from "@ensiria/cli-kit/layout";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";

import { stopAllServers } from "./measure.ts";
import { packForgebook, publishedForgebook } from "./prepare.ts";
import { parseReport, reportProblems, reportRows } from "./reportTable.ts";
import { METRIC_GROUPS, type MetricGroup, runBench } from "./runBench.ts";
import { statusWriter } from "./statusFile.ts";
import { FORGEBOOK, TARGETS } from "./targets.ts";

/** The share two runs' medians may differ by and still count as reproduced. */
const REPRODUCIBLE_WITHIN = 0.1;

/** The repository's root, from this file. */
const REPOSITORY = resolve(import.meta.dirname, "../..");

/** Whether a word names a group of metrics. */
const isGroup = (word: string): word is MetricGroup => METRIC_GROUPS.some((group) => group === word);

await defineScript({
  name: "bench",
  command: "node tools/bench/bench.mts",
  summary:
    "Measure Forgebook as installed: start, HMR, pages, memory, build and install, on a generated library.",
  icon: "check",
  json: true,
  options: {
    compare: { type: "boolean", description: "Also measure Storybook and Ladle on the same library." },
    components: { type: "number", default: 100, description: "Components of the generated library." },
    stories: { type: "number", default: 500, description: "Stories of the generated library." },
    runs: { type: "number", default: 5, description: "Runs of each time." },
    edits: { type: "number", default: 30, description: "Edits of each file, for HMR." },
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
    "forgebook-version": {
      type: "string",
      valueName: "version",
      description: "Measure this published release instead of this checkout."
    }
  },
  examples: [
    { command: "bench", description: "Forgebook alone, every metric." },
    { command: "bench --compare --json", description: "The three tools, as a report." },
    { command: "bench --metric hmr --runs 3", description: "Only the edits." }
  ],
  run: async ({ options, io, log, style, isJson, onExit }) => {
    onExit(stopAllServers);
    const unknown = options.metric.filter((word) => !isGroup(word));
    if (unknown.length > 0) {
      throw new ScriptError(`unknown --metric: ${unknown.join(", ")}`, { hint: METRIC_GROUPS.join(", ") });
    }
    const groups = options.metric.length === 0 ? [...METRIC_GROUPS] : options.metric.filter(isGroup);
    // read first: this run overwrites the last report, which could otherwise be compared with itself
    const earlier =
      options.against === undefined ? undefined : parseReport(readFileSync(options.against, "utf8"));
    const work = join(REPOSITORY, ".bench");
    mkdirSync(work, { recursive: true });
    const folders = { repository: REPOSITORY, work };
    const version = options["forgebook-version"];
    log.info(version === undefined ? "Packing this checkout's Forgebook" : `Measuring Forgebook ${version}`);
    const forgebookPackages =
      version === undefined ? await packForgebook(folders, io) : publishedForgebook(version);
    const { stdout: commit } = await exec("git", ["rev-parse", "--short", "HEAD"], { cwd: REPOSITORY, io });
    const { stdout: changes } = await exec("git", ["status", "--porcelain"], { cwd: REPOSITORY, io });
    const write = statusWriter(options.status, Date.now);
    const report = await runBench({
      folders,
      targets: options.compare ? TARGETS : [FORGEBOOK],
      forgebookPackages,
      forgebookLabel: version ?? `${commit.trim()}${changes.trim() === "" ? "" : "-dirty"}`,
      size: { components: options.components, stories: options.stories },
      runs: options.runs,
      edits: options.edits,
      groups,
      throttle: options.throttle,
      io,
      onStep: (step) => {
        write(step);
        log.info(`${step.tool} · ${step.metric} · ${step.run}/${step.runs}`);
      }
    });
    write({ state: "finished", warnings: report.warnings.length });
    writeFileSync(join(work, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    for (const warning of report.warnings) log.warn(`not a quiet machine: ${warning}`);
    if (!isJson) {
      const { tools, rows } = reportRows(report);
      io.stdout.write(
        `${table(rows, { columns: ["metric", ...tools].map((header) => ({ header })) }, style)}\n`
      );
    }
    const problems = reportProblems(report, earlier, REPRODUCIBLE_WITHIN);
    for (const problem of problems) log.error(problem);
    if (problems.length > 0) {
      throw new ScriptError(`${problems.length} problems with this run`, {
        hint: `The report is in ${join(work, "report.json")}`
      });
    }
    return report;
  }
}).run();
