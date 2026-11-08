/**
 * The working half of `cold-suite`: packs this checkout, installs the generated library with the README's test setup in
 * a work folder, and runs the suite from cold caches, again and again.
 *
 * @remarks
 * Cold means what a CI job without a cache has: no Vite pre-bundle, no Forgebook index (kept in Vite's cache folder), no
 * results of an earlier run. The install and the browser are kept, as a CI job restores them or pays them once; the
 * time measured is Playwright's, its frame page's server included. A run's failures are run again alone with
 * `--last-failed`, the first time any appear, so a test that fails once is told from one that always fails.
 *
 * @module
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { cpus, loadavg, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { buildCorpus, projectFiles } from "../bench/corpus.ts";
import { contentSize } from "../bench/diskUsage.ts";
import { type BenchFolders, packForgebook } from "../bench/prepare.ts";
import { execProgram, TIME_LIMITS } from "../bench/programs.ts";
import { coldRun, FORGEBOOK_SUITE_PACKAGES, reportedTests, suiteFiles } from "./coldSuite.ts";
import type { ColdMachine, ColdRun } from "./coldSuite.types.ts";

/** How long one run of the suite may take, in milliseconds: an hour, far past any library's run on a slow PC. */
const RUN_LIMIT_MS = 60 * 60_000;

/** The Playwright configuration the README's setup writes, from the library's folder. */
const CONFIG = "test/stories/playwright.config.ts";

/** What a cold run needs: the library's folder and Playwright's workers. */
export type RunRequest = {
  /** The library's folder. */
  readonly library: string;
  /** Playwright's workers; its configuration's when none. */
  readonly workers: number | undefined;
  /** The run's name, for its report's file. */
  readonly label: string;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** What a library needs to be prepared. */
export type PrepareRequest = {
  /** The repository and the work folder. */
  readonly folders: BenchFolders;
  /** The generated library's size. */
  readonly size: { readonly components: number; readonly stories: number };
  /** The frame page's port. */
  readonly port: number;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** Writes files under a folder. */
const writeFiles = async (folder: string, files: Readonly<Record<string, string>>): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      const file = join(folder, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    })
  );
};

/**
 * Packs this checkout, writes the library and installs it with its browser.
 *
 * @param request - the folders, the size, the port and the streams.
 * @returns the library's folder.
 */
export const prepareLibrary = async ({ folders, size, port, io }: PrepareRequest): Promise<string> => {
  const packages = await packForgebook(folders, io, FORGEBOOK_SUITE_PACKAGES);
  const library = join(folders.work, "library");
  await rm(library, { recursive: true, force: true });
  await writeFiles(library, {
    ...projectFiles(buildCorpus(size), "csf3"),
    ...suiteFiles({ packages, port })
  });
  const options = { cwd: library, io, output: "capture" as const, timeoutMs: TIME_LIMITS.install };
  await execProgram("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], options);
  await execProgram("npm", ["exec", "--", "forgebook", "browser"], options);
  return library;
};

/** Removes what a CI job without a cache would not have. */
const coldCaches = async (library: string): Promise<void> => {
  for (const path of ["node_modules/.vite", "node_modules/.vite-temp", "test-results"]) {
    await rm(join(library, path), { recursive: true, force: true });
  }
};

/** Playwright's arguments for a run, its JSON report kept beside the list it prints. */
const playwrightArgs = (workers: number | undefined, more: readonly string[]): string[] => [
  "exec",
  "--",
  "playwright",
  "test",
  "-c",
  CONFIG,
  "--reporter=list,json",
  ...(workers === undefined ? [] : ["--workers", String(workers)]),
  ...more
];

/** One Playwright run, timed, its JSON report written to a file. */
const timedRun = async (
  { library, workers, label, io }: RunRequest,
  more: readonly string[]
): Promise<{
  readonly report: string;
  readonly seconds: number;
  readonly code: number | null;
  readonly list: string;
}> => {
  const report = join(library, "..", "reports", `${label}.json`);
  await mkdir(dirname(report), { recursive: true });
  const startedAt = performance.now();
  const result = await execProgram("npm", playwrightArgs(workers, more), {
    cwd: library,
    io,
    // `CI` as every CI service sets it, so the suite runs as it does there: retries included
    env: { ...io.env, CI: "true", PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    output: "capture",
    check: false,
    timeoutMs: RUN_LIMIT_MS
  });
  return {
    report,
    seconds: (performance.now() - startedAt) / 1000,
    code: result.code,
    list: `${result.stdout}${result.stderr}`
  };
};

/**
 * Runs the suite once from cold caches.
 *
 * @param request - the library, the workers, the run's name and the streams.
 */
export const runCold = async (request: RunRequest): Promise<ColdRun> => {
  await coldCaches(request.library);
  const { report, seconds, code, list } = await timedRun(request, []);
  const tests = reportedTests(JSON.parse(await readFile(report, "utf8")));
  return coldRun(tests, {
    seconds,
    exitCode: code,
    jsonReportBytes: await contentSize(report),
    listOutputBytes: Buffer.byteLength(list),
    resultsBytes: await contentSize(join(request.library, "test-results")).catch(() => 0)
  });
};

/**
 * Runs the last run's failures again, alone, caches kept: the titles of those that pass.
 *
 * @param request - the library, the workers, the run's name and the streams.
 */
export const rerunFailures = async (request: RunRequest): Promise<Set<string>> => {
  const { report } = await timedRun(request, ["--last-failed"]);
  const tests = reportedTests(JSON.parse(await readFile(report, "utf8")));
  return new Set(tests.filter((test) => test.hasPassed).map((test) => test.title));
};

/** The machine, read before the first run. */
export const thisMachine = (): ColdMachine => ({
  platform: process.platform,
  cpu: cpus()[0]?.model ?? "unknown",
  cpus: cpus().length,
  memoryGiB: Math.round(totalmem() / 1024 ** 3),
  loadBefore: Math.round((loadavg()[0] ?? 0) * 10) / 10
});
