/**
 * The report as a table, and what two reports are compared on.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { BenchReport } from "./bench.types.ts";
import { parseReport, reportRows, timeMedians } from "./reportTable.ts";

const REPORT: BenchReport = {
  version: 1,
  startedAt: "2026-11-01T00:00:00.000Z",
  forgebook: "abc123",
  corpus: { components: 10, stories: 50 },
  throttle: 1,
  machine: { platform: "darwin-arm64", system: "25", cpu: "M4", cpus: 16, memory: 1, node: "v24" },
  readings: {},
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

describe("timeMedians", () => {
  it("keeps only the times, since sizes are exact", () => {
    expect(timeMedians(REPORT)).toEqual({ "forgebook coldStart": 1200 });
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
