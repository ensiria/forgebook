/**
 * The pure half of `cold-suite`: the files of a library set up as `@forgebook/testing`'s README says, and what a
 * Playwright JSON report says of a run.
 *
 * @remarks
 * The library is the benchmark's generated one (`bench/corpus.ts`), so a number here and a number there are about the
 * same stories. The test files are the README's, word for word but for the names and the ports: what is measured is
 * what a user who followed the guide gets in CI.
 *
 * @module
 */
import type { ColdRun, ColdSuiteReport } from "./coldSuite.types.ts";

/** The source id and name the library's stories are listed under. */
const SOURCE = { id: "cold-library", name: "Cold library" } as const;

/** Where the generated library's stories are, from the source module's folder. */
const STORIES_PATTERN = "../src/components/*.stories.tsx";

/** What the suite runs on: the packages to install, by name, and the ports of its frame page. */
export type SuiteSetup = {
  /** Each package's version or tarball, by name: Forgebook's and the test runner's. */
  readonly packages: Readonly<Record<string, string>>;
  /** The frame page's port. */
  readonly port: number;
};

/**
 * The packages a library on React with the generated suite installs beside Forgebook's, pinned. No type checker: the
 * run strips types, as a CI job running the tests does.
 */
export const SUITE_PACKAGES: Readonly<Record<string, string>> = {
  "@playwright/test": "1.64.1",
  react: "19.3.0",
  "react-dom": "19.3.0",
  vite: "8.3.5"
};

/** The Forgebook packages the suite needs, by folder under `packages/`. */
export const FORGEBOOK_SUITE_PACKAGES: readonly string[] = ["story-format", "forgebook", "react", "testing"];

/**
 * The files the README's setup writes, plus the manifest: the source module and the six files of `test/stories/`.
 *
 * @param setup - the packages and the port.
 */
export const suiteFiles = ({ packages, port }: SuiteSetup): Readonly<Record<string, string>> => ({
  "package.json": `${JSON.stringify(
    {
      name: "cold-library",
      private: true,
      type: "module",
      devDependencies: { ...SUITE_PACKAGES, ...packages },
      // a tarball's own dependency on another Forgebook package names a version, which only the tarball has
      overrides: packages
    },
    null,
    2
  )}\n`,
  "stories/index.ts": `/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "${STORIES_PATTERN}?forgebook-files";

export const source: StorySource = {
  id: "${SOURCE.id}",
  name: "${SOURCE.name}",
  files: [files],
  sheets: { required: [], theme: [], restyled: [] }
};
`,
  "test/stories/storyFiles.ts": `import { join } from "node:path";

import type { StoryFilesOptions } from "@forgebook/testing/story-files";

export const STORY_FILES: StoryFilesOptions = {
  sourceId: "${SOURCE.id}",
  name: "${SOURCE.name}",
  root: join(import.meta.dirname, "..", "..", "stories"),
  patterns: ["${STORIES_PATTERN}"]
};
`,
  "test/stories/testServer.ts": `import type { StoryTestServer } from "@forgebook/testing/playwright";

export const STORY_SERVER: StoryTestServer = { dir: import.meta.dirname, port: ${port}, browserPort: ${port + 1} };
`,
  "test/stories/playwright.config.ts": `import { storyTestConfig } from "@forgebook/testing/playwright";

import { STORY_SERVER } from "./testServer";

export default storyTestConfig(STORY_SERVER);
`,
  "test/stories/stories.spec.ts": `import { storyBrowserTests } from "@forgebook/testing/browser";

import { STORY_FILES } from "./storyFiles";

storyBrowserTests(STORY_FILES);
`,
  "test/stories/frame.html": `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Stories</title></head>
  <body><div id="root"></div><script type="module" src="./frame.tsx"></script></body>
</html>
`,
  "test/stories/frame.tsx": `import "@forgebook/testing/fonts.css";
import { mountFrame } from "@forgebook/react/frame";

import { source } from "../../stories/index";

const root = document.getElementById("root");
if (root !== null) void mountFrame(root, { sources: [source] });
`,
  "test/stories/vite.config.ts": `import { react } from "@forgebook/react/vite";
import { storyTestViteConfig } from "@forgebook/testing/vite";

export default storyTestViteConfig(import.meta.dirname, react());
`
});

/** One test of a report: its title and how its tries went. */
export type ReportedTest = {
  /** The describe blocks' titles and the test's, joined by ` › `. */
  readonly title: string;
  /** Whether its last try passed. */
  readonly hasPassed: boolean;
  /** Whether it passed only on a retry, which Playwright reports as flaky. */
  readonly isFlaky: boolean;
  /** Each try's time, in milliseconds. */
  readonly durations: readonly number[];
};

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field that is a list, or an empty one. */
const listField = (node: Readonly<Record<string, unknown>>, field: string): readonly unknown[] => {
  const value = node[field];
  return Array.isArray(value) ? value : [];
};

/** A field that is text, or an empty one. */
const textField = (node: Readonly<Record<string, unknown>>, field: string): string => {
  const value = node[field];
  return typeof value === "string" ? value : "";
};

/** The tests of one spec (a `test()` call), each project's once. */
const specTests = (spec: Readonly<Record<string, unknown>>, titles: readonly string[]): ReportedTest[] =>
  listField(spec, "tests")
    .filter(isRecord)
    .map((test) => {
      const results = listField(test, "results").filter(isRecord);
      const last = results.at(-1);
      return {
        title: [...titles, textField(spec, "title")].join(" › "),
        // `expected` and `flaky` passed in the end; `skipped` and `unexpected` did not run or failed
        hasPassed: last !== undefined && (last["status"] === "passed" || test["status"] === "flaky"),
        isFlaky: test["status"] === "flaky",
        durations: results.map((result) => (typeof result["duration"] === "number" ? result["duration"] : 0))
      };
    });

/** The tests under a suite and the suites it holds. */
const suiteTests = (suite: Readonly<Record<string, unknown>>, titles: readonly string[]): ReportedTest[] => [
  ...listField(suite, "specs")
    .filter(isRecord)
    .flatMap((spec) => specTests(spec, titles)),
  ...listField(suite, "suites")
    .filter(isRecord)
    .flatMap((child) => suiteTests(child, [...titles, textField(child, "title")]))
];

/**
 * The tests of a Playwright JSON report, in its order. The file's own suite is left out of a title: every test of the
 * suite is in the one generated spec.
 *
 * @param report - the report, parsed.
 * @throws when it is not a report: a run that wrote half of one is a failed run, not one with no tests.
 */
export const reportedTests = (report: unknown): ReportedTest[] => {
  if (!isRecord(report) || !Array.isArray(report["suites"])) {
    throw new Error("not a Playwright JSON report: it has no suites");
  }
  return report["suites"].filter(isRecord).flatMap((file) => suiteTests(file, []));
};

/**
 * A percentile of numbers, the nearest rank: no value that was not measured.
 *
 * @param values - the numbers, in any order.
 * @param share - the percentile, from 0 to 1.
 */
export const percentile = (values: readonly number[], share: number): number => {
  const sorted = values.toSorted((first, second) => first - second);
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(share * sorted.length)));
  return sorted[rank - 1] ?? 0;
};

/** What a run is measured by beyond its report: the time, the exit and the sizes. */
export type RunFacts = Omit<
  ColdRun,
  "tests" | "passed" | "failed" | "retried" | "medianTestMs" | "p95TestMs"
>;

/**
 * One run from its report and what was measured around it.
 *
 * @param tests - the report's tests.
 * @param facts - the time, the exit code and the sizes.
 */
export const coldRun = (tests: readonly ReportedTest[], facts: RunFacts): ColdRun => {
  const firstTries = tests.flatMap((test) => test.durations.slice(0, 1));
  return {
    ...facts,
    tests: tests.length,
    passed: tests.filter((test) => test.hasPassed).length,
    failed: tests.filter((test) => !test.hasPassed).map((test) => test.title),
    retried: tests.filter((test) => test.isFlaky).map((test) => test.title),
    medianTestMs: Math.round(percentile(firstTries, 0.5)),
    p95TestMs: Math.round(percentile(firstTries, 0.95))
  };
};

/**
 * Which failures are flaky: a test that passed on a retry, or failed every try of a run and passed when run again alone.
 * A test that failed again alone is broken, whatever other runs did.
 *
 * @param runs - the runs.
 * @param rerun - the tests that passed when every run's failures were run again.
 */
export const failureKinds = (
  runs: readonly ColdRun[],
  rerun: ReadonlySet<string>
): Pick<ColdSuiteReport, "flaky" | "broken"> => {
  const failed = [...new Set(runs.flatMap((run) => run.failed))];
  const retried = runs.flatMap((run) => run.retried);
  return {
    flaky: [...new Set([...retried, ...failed.filter((title) => rerun.has(title))])],
    broken: failed.filter((title) => !rerun.has(title))
  };
};

/** Bytes as a person reads them. */
const sizeText = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

/**
 * The report's runs as table rows, one per run and a median row last.
 *
 * @param report - the report.
 */
export const reportRows = (report: ColdSuiteReport): string[][] => {
  const row = (label: string, run: ColdRun): string[] => [
    label,
    `${run.seconds.toFixed(1)} s`,
    `${run.passed}/${run.tests}`,
    `${run.medianTestMs} ms`,
    `${run.p95TestMs} ms`,
    sizeText(run.jsonReportBytes),
    sizeText(run.listOutputBytes)
  ];
  const rows = report.runs.map((run, index) => row(`run ${index + 1}`, run));
  const seconds = percentile(
    report.runs.map((run) => run.seconds),
    0.5
  );
  return [...rows, ["median", `${seconds.toFixed(1)} s`, "", "", "", "", ""]];
};

/** The table's headings, in the rows' order. */
export const REPORT_HEADINGS: readonly string[] = [
  "run",
  "wall time",
  "passed",
  "test median",
  "test p95",
  "JSON report",
  "list output"
];
