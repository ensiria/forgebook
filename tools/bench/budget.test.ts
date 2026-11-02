/**
 * The check a pull request has to pass.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { BenchReport } from "./bench.types.ts";
import { budgetLine, budgetProblems, parseBudget } from "./budget.ts";

const CORPUS = { components: 20, stories: 100 };

const REPORT: BenchReport = {
  version: 1,
  startedAt: "2026-11-01T00:00:00.000Z",
  forgebook: "abc123",
  corpus: CORPUS,
  measured: "Widget11",
  runs: 3,
  throttle: 1,
  machine: { platform: "linux-x64", system: "6", cpu: "x", cpus: 4, memory: 1, node: "v24" },
  readings: [],
  warnings: [],
  tools: {
    forgebook: {
      versions: {},
      metrics: {
        shellJs: {
          kind: "measured",
          unit: "bytes",
          summary: { median: 1000, min: 1000, max: 1000, samples: 1 }
        },
        build: { kind: "failed", reason: "crashed" }
      }
    }
  }
};

describe("budgetProblems", () => {
  it("has nothing against a run within its limits", () => {
    expect(budgetProblems(REPORT, { corpus: CORPUS, limits: { shellJs: 1000 } })).toEqual([]);
  });

  it("names a heavier Forgebook, with the number and the limit", () => {
    const [problem] = budgetProblems(REPORT, { corpus: CORPUS, limits: { shellJs: 999 } });
    expect(problem).toEqual({ metric: "shellJs", limit: 999, value: 1000 });
    expect(problem === undefined ? "" : budgetLine(problem)).toBe("shellJs: 1000 over the limit of 999");
  });

  it("fails a metric that was not measured, or that failed", () => {
    const problems = budgetProblems(REPORT, { corpus: CORPUS, limits: { build: 1, packages: 1 } });
    expect(problems.map((problem) => problem.metric)).toEqual(["build", "packages"]);
    expect(problems[0]?.value).toBeUndefined();
  });

  it("refuses a run on another corpus, where a limit means nothing", () => {
    expect(() => budgetProblems(REPORT, { corpus: { components: 1, stories: 1 }, limits: {} })).toThrow(
      "the budget is for"
    );
  });
});

describe("parseBudget", () => {
  it("reads a budget, and refuses another file", () => {
    expect(parseBudget(JSON.stringify({ corpus: CORPUS, limits: { build: 1 } })).limits).toEqual({
      build: 1
    });
    expect(() => parseBudget("{}")).toThrow("not a budget file");
  });
});
