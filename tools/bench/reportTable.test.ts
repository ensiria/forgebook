/**
 * The report as a table, and what two reports are compared on.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { BenchReport } from "./bench.types.ts";
import {
  parseReport,
  reportMarkdown,
  reportMismatches,
  reportProblems,
  reportRows,
  timeMedians
} from "./reportTable.ts";

const REPORT: BenchReport = {
  version: 1,
  startedAt: "2026-11-01T00:00:00.000Z",
  forgebook: "abc123",
  corpus: { components: 10, stories: 50 },
  measured: "Widget7",
  runs: 5,
  throttle: 1,
  machine: { platform: "darwin-arm64", system: "25", cpu: "M4", cpus: 16, memory: 1, node: "v24" },
  readings: [],
  warnings: [],
  tools: {
    forgebook: {
      versions: {},
      metrics: {
        coldStart: {
          kind: "measured",
          unit: "ms",
          summary: { median: 1200, min: 1100, max: 1300, samples: 5 }
        },
        installSize: {
          kind: "measured",
          unit: "bytes",
          summary: { median: 2048, min: 2048, max: 2048, samples: 1 }
        }
      }
    },
    ladle: {
      versions: {},
      metrics: { componentPage: { kind: "absent", reason: "ladle has no page" } }
    }
  }
};

describe("reportRows", () => {
  it("has a row per metric and a cell per tool, n/a where a tool has no such thing", () => {
    const { tools, rows } = reportRows(REPORT);
    expect(tools).toEqual(["forgebook", "ladle"]);
    expect(rows).toContainEqual(["coldStart", "1200 ms (1100–1300)", "–"]);
    expect(rows).toContainEqual(["componentPage", "–", "n/a"]);
  });
});

describe("reportRows at parity", () => {
  it("heads Forgebook's column with the features it ran, so it stands apart from its defaults", () => {
    expect(reportRows({ ...REPORT, features: "parity" }).headings).toEqual(["forgebook at parity", "ladle"]);
    expect(reportRows(REPORT).headings).toEqual(["forgebook", "ladle"]);
    expect(reportMarkdown({ ...REPORT, features: "parity" }).split("\n")[0]).toBe(
      "| metric | forgebook at parity | ladle |"
    );
  });
});

describe("reportMarkdown", () => {
  it("writes a table a job summary can draw, with nothing cut", () => {
    const lines = reportMarkdown(REPORT).split("\n");
    expect(lines[0]).toBe("| metric | forgebook | ladle |");
    expect(lines[1]).toBe("| --- | --- | --- |");
    expect(lines).toContain("| coldStart | 1200 ms (1100–1300) | – |");
  });
});

describe("timeMedians", () => {
  it("keeps only the times, since sizes are exact", () => {
    expect(timeMedians(REPORT)).toEqual({ "forgebook coldStart": 1200 });
  });
});

describe("reportMismatches", () => {
  const later = { ...REPORT, startedAt: "2026-11-02T00:00:00.000Z" };

  it("has nothing against a later run of the same thing", () => {
    expect(reportMismatches(REPORT, later)).toEqual([]);
  });

  it("refuses a run compared with itself, which would prove nothing", () => {
    expect(reportMismatches(REPORT, REPORT)).toEqual(["startedAt differs"]);
  });

  it("refuses another corpus", () => {
    expect(reportMismatches(REPORT, { ...later, corpus: { components: 1, stories: 1 } })).toEqual([
      "corpus differs"
    ]);
  });

  it("refuses Forgebook measured with other features, a report before the choice reading as its defaults", () => {
    expect(reportMismatches(REPORT, { ...later, features: "parity" })).toEqual(["features differs"]);
    expect(reportMismatches(REPORT, { ...later, features: "default" })).toEqual([]);
  });

  it("refuses Forgebook's frames measured on another origin", () => {
    expect(reportMismatches({ ...REPORT, frames: "isolated" }, { ...later, frames: "same-origin" })).toEqual([
      "frames differs"
    ]);
  });
});

describe("reportProblems", () => {
  const later = { ...REPORT, startedAt: "2026-11-02T00:00:00.000Z" };
  const failed: BenchReport = {
    ...later,
    tools: { ladle: { versions: {}, metrics: { build: { kind: "failed", reason: "crashed" } } } }
  };

  it("has nothing to say about a clean run", () => {
    expect(reportProblems(later, REPORT, 0.1)).toEqual([]);
  });

  it("names a metric that failed", () => {
    expect(reportProblems(failed, undefined, 0.1)).toEqual(["ladle build failed: crashed"]);
  });

  it("names a time the second run lost", () => {
    expect(reportProblems(failed, REPORT, 0.1)).toContain("forgebook coldStart: 1200 → 0 ms");
  });
});

describe("parseReport", () => {
  it("reads back what a run wrote", () => {
    expect(parseReport(JSON.stringify(REPORT)).forgebook).toBe("abc123");
  });

  it("refuses another file", () => {
    expect(() => parseReport('{"name":"x"}')).toThrow("not a benchmark report");
  });
});
