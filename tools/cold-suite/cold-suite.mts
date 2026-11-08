#!/usr/bin/env node
/**
 * The `cold-suite` command: `@forgebook/testing`'s generated browser tests on a generated library, from cold caches, as
 * a CI job without a cache runs them. See its README for what is measured.
 *
 * @module
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { formatJson } from "@ensiria/cli-kit/files";
import { table } from "@ensiria/cli-kit/layout";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";

import { execProgram, TIME_LIMITS } from "../bench/programs.ts";
import { failureKinds, REPORT_HEADINGS, reportRows } from "./coldSuite.ts";
import type { ColdRun, ColdSuiteReport } from "./coldSuite.types.ts";
import { prepareLibrary, rerunFailures, runCold, thisMachine } from "./coldSuiteRun.ts";

/** The repository's root, from this file. */
const REPOSITORY = resolve(import.meta.dirname, "../..");

await defineScript({
  name: "cold-suite",
  command: "node tools/cold-suite/cold-suite.mts",
  summary:
    "Run @forgebook/testing's generated browser tests from cold caches: time, report size, flaky tests.",
  icon: "check",
  json: true,
  options: {
    components: { type: "number", default: 50, description: "Components of the generated library." },
    stories: { type: "number", default: 250, description: "Stories of the generated library." },
    runs: { type: "number", default: 3, description: "Cold runs of the suite." },
    workers: {
      type: "number",
      description: "Playwright's workers; one per CPU, the suite's own setting, by default."
    },
    port: {
      type: "number",
      default: 62_300,
      description: "The frame page's port, and the next one: two runs on one machine need their own."
    },
    work: {
      type: "string",
      valueName: "folder",
      description: "Where to install and generate, outside the repository; beside it by default."
    }
  },
  examples: [
    { command: "cold-suite", description: "Three cold runs on 250 stories, one worker per CPU." },
    {
      command: "cold-suite --workers 4 --json",
      description: "As a CI runner with four CPUs runs it, as a report."
    }
  ],
  run: async ({ options, io, log, style, isJson }) => {
    const work = resolve(options.work ?? join(REPOSITORY, "..", "forgebook-cold-suite"));
    mkdirSync(work, { recursive: true });
    const git = { cwd: REPOSITORY, io, timeoutMs: TIME_LIMITS.query };
    const { stdout: commit } = await execProgram("git", ["rev-parse", "--short", "HEAD"], git);
    const { stdout: changes } = await execProgram("git", ["status", "--porcelain"], git);
    log.info("Packing this checkout and installing the library");
    const library = await prepareLibrary({
      folders: { repository: REPOSITORY, work },
      size: { components: options.components, stories: options.stories },
      port: options.port,
      io
    });
    const machine = thisMachine();
    const runs: ColdRun[] = [];
    const passedAlone = new Set<string>();
    for (let index = 1; index <= options.runs; index += 1) {
      const request = { library, workers: options.workers, label: `run-${index}`, io };
      log.info(`Cold run ${index}/${options.runs}`);
      const run = await runCold(request);
      runs.push(run);
      if (run.failed.length === 0) continue;
      log.warn(`${run.failed.length} tests failed; running them again alone`);
      for (const title of await rerunFailures({ ...request, label: `run-${index}-again` }))
        passedAlone.add(title);
    }
    const report: ColdSuiteReport = {
      schema: 1,
      forgebook: `${commit.trim()}${changes.trim() === "" ? "" : "-dirty"}`,
      library: { components: options.components, stories: options.stories },
      ...(options.workers === undefined ? {} : { workers: options.workers }),
      machine,
      runs,
      ...failureKinds(runs, passedAlone)
    };
    writeFileSync(join(work, "report.json"), formatJson(report));
    io.stdout.write(
      isJson
        ? formatJson(report)
        : `${table(reportRows(report), { columns: REPORT_HEADINGS.map((header) => ({ header })) }, style)}\n`
    );
    for (const title of report.flaky) log.warn(`flaky: ${title}`);
    for (const title of report.broken) log.error(`fails every time: ${title}`);
    const failures = report.flaky.length + report.broken.length;
    if (failures > 0) {
      throw new ScriptError(`${failures} tests failed in a run`, {
        hint: `The report is in ${join(work, "report.json")}`
      });
    }
  }
}).run();
