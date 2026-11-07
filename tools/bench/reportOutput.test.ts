/**
 * The report a run writes when it ends, with its problems or without.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { BenchReport } from "./bench.types.ts";
import { finishedReport, reportOutput } from "./reportOutput.ts";
import { parseReport } from "./reportTable.ts";

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
        }
      }
    }
  }
};

const TABLE = (): string => "a table";

describe("reportOutput", () => {
  it("prints the whole report with --json when the run found problems, with the problems in it", () => {
    const report = finishedReport(REPORT, ["1 of 872 stories did not draw"]);
    const printed = parseReport(reportOutput(report, "json", TABLE));
    expect(printed.problems).toEqual(["1 of 872 stories did not draw"]);
    expect(printed.tools.forgebook?.metrics["coldStart"]).toEqual(
      REPORT.tools.forgebook?.metrics["coldStart"]
    );
  });

  it("says a clean run had no problems", () => {
    const printed = parseReport(reportOutput(finishedReport(REPORT, []), "json", TABLE));
    expect(printed.problems).toEqual([]);
  });

  it("prints a table otherwise, problems or not", () => {
    const report = finishedReport(REPORT, ["forgebook build failed"]);
    expect(reportOutput(report, "table", TABLE)).toBe("a table\n");
    expect(reportOutput(report, "markdown", TABLE)).toContain("coldStart");
  });
});
