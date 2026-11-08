/**
 * Tests of `cold-suite`'s pure half: the README's setup written for the generated library, and what a Playwright JSON
 * report says of a run.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { coldRun, failureKinds, percentile, reportedTests, reportRows, suiteFiles } from "./coldSuite.ts";
import type { ColdSuiteReport } from "./coldSuite.types.ts";

/** A report as Playwright writes one: a file's suite, a describe, two tests, the second passing on its retry. */
const REPORT = {
  config: {},
  suites: [
    {
      title: "../../node_modules/@forgebook/testing/dist/src/browserTests.js",
      specs: [],
      suites: [
        {
          title: "Feedback/Widget5",
          specs: [
            {
              title: "Story 0 · light",
              tests: [{ status: "expected", results: [{ status: "passed", duration: 1200 }] }]
            },
            {
              title: "Story 1 · dark",
              tests: [
                {
                  status: "flaky",
                  results: [
                    { status: "failed", duration: 3000 },
                    { status: "passed", duration: 900 }
                  ]
                }
              ]
            },
            {
              title: "Story 2 · narrow",
              tests: [{ status: "unexpected", results: [{ status: "failed", duration: 25_000 }] }]
            }
          ]
        }
      ]
    }
  ],
  stats: { expected: 1, unexpected: 1, flaky: 1 }
};

/** The facts of a run measured around its report. */
const FACTS = { seconds: 12.5, exitCode: 1, jsonReportBytes: 4096, listOutputBytes: 512, resultsBytes: 0 };

describe("suiteFiles", () => {
  const files = suiteFiles({ packages: { forgebook: "file:/packs/forgebook-1.0.0.tgz" }, port: 41_000 });

  it("writes the README's six test files and the source module", () => {
    expect(Object.keys(files).toSorted()).toEqual([
      "package.json",
      "stories/index.ts",
      "test/stories/frame.html",
      "test/stories/frame.tsx",
      "test/stories/playwright.config.ts",
      "test/stories/stories.spec.ts",
      "test/stories/storyFiles.ts",
      "test/stories/testServer.ts",
      "test/stories/vite.config.ts"
    ]);
  });

  it("gives the frame page its port and the next one to the visual browser", () => {
    expect(files["test/stories/testServer.ts"]).toContain("port: 41000, browserPort: 41001");
  });

  it("installs the tarballs and overrides what they name with them", () => {
    const manifest: unknown = JSON.parse(files["package.json"] ?? "");
    expect(manifest).toMatchObject({
      devDependencies: { forgebook: "file:/packs/forgebook-1.0.0.tgz", "@playwright/test": "1.64.1" },
      overrides: { forgebook: "file:/packs/forgebook-1.0.0.tgz" }
    });
  });

  it("keeps the spec and the configuration as the README writes them", () => {
    const readme = readFileSync(
      join(import.meta.dirname, "..", "..", "packages", "testing", "README.md"),
      "utf8"
    );
    for (const path of ["test/stories/stories.spec.ts", "test/stories/playwright.config.ts"]) {
      expect(readme).toContain(files[path]?.trim());
    }
  });
});

describe("reportedTests", () => {
  it("lists every test with its describe's title, the file's left out", () => {
    expect(reportedTests(REPORT).map((test) => test.title)).toEqual([
      "Feedback/Widget5 › Story 0 · light",
      "Feedback/Widget5 › Story 1 · dark",
      "Feedback/Widget5 › Story 2 · narrow"
    ]);
  });

  it("counts a test that passed on a retry as passed, and keeps each try's time", () => {
    const [, retried, failed] = reportedTests(REPORT);
    expect(retried).toMatchObject({ hasPassed: true, isFlaky: true, durations: [3000, 900] });
    expect(failed?.hasPassed).toBe(false);
  });

  it("refuses what is not a report", () => {
    expect(() => reportedTests({ errors: [] })).toThrow(/no suites/);
  });
});

describe("percentile", () => {
  it("takes the nearest rank, a value that was measured", () => {
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("coldRun", () => {
  it("counts the tests and times their first tries", () => {
    const run = coldRun(reportedTests(REPORT), FACTS);
    expect(run).toMatchObject({
      tests: 3,
      passed: 2,
      failed: ["Feedback/Widget5 › Story 2 · narrow"],
      retried: ["Feedback/Widget5 › Story 1 · dark"],
      medianTestMs: 3000,
      p95TestMs: 25_000,
      seconds: 12.5
    });
  });
});

describe("failureKinds", () => {
  it("calls a failure that passed alone flaky, and one that failed again broken", () => {
    const run = coldRun(reportedTests(REPORT), FACTS);
    const other = { ...run, failed: ["Feedback/Widget5 › Story 0 · light"], retried: [] };
    expect(failureKinds([run, other], new Set(["Feedback/Widget5 › Story 0 · light"]))).toEqual({
      flaky: ["Feedback/Widget5 › Story 1 · dark", "Feedback/Widget5 › Story 0 · light"],
      broken: ["Feedback/Widget5 › Story 2 · narrow"]
    });
  });
});

describe("reportRows", () => {
  it("gives a row per run and the median of their times", () => {
    const run = coldRun(reportedTests(REPORT), FACTS);
    const report: ColdSuiteReport = {
      schema: 1,
      forgebook: "abc1234",
      library: { components: 1, stories: 3 },
      machine: { platform: "linux", cpu: "cpu", cpus: 4, memoryGiB: 16, loadBefore: 0.5 },
      runs: [run, { ...run, seconds: 10 }, { ...run, seconds: 20 }],
      flaky: [],
      broken: []
    };
    const rows = reportRows(report);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(["run 1", "12.5 s", "2/3", "3000 ms", "25000 ms", "4.0 KiB", "0.5 KiB"]);
    expect(rows[3]?.[1]).toBe("12.5 s");
  });
});
