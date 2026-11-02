/**
 * The reading of a machine's load.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { noiseWarnings, parseReadings } from "./machine.ts";

const QUIET = {
  battery:
    " -InternalBattery-0 (id=22544483)\t100%; charged; 0:00 remaining present: true\nNow drawing from 'AC Power'",
  thermal:
    "Note: No thermal warning level has been recorded\nNote: No performance warning level has been recorded",
  backup: "{\n    Running = 0;\n}",
  indexing: "/Volumes/Bench:\n\tIndexing disabled.",
  processes:
    "Load Avg: 1.20, 1.5, 1.6\nCPU usage: 2.0% user, 3.0% sys, 95.0% idle\nCPU usage: 1.0% user, 1.0% sys, 98.0% idle"
};

describe("parseReadings", () => {
  it("reads a quiet machine", () => {
    expect(parseReadings(QUIET)).toEqual({
      isOnCharger: true,
      batteryPercent: 100,
      hasThermalWarning: false,
      isBackingUp: false,
      isIndexed: false,
      idlePercent: 98,
      load: 1.2
    });
  });

  it("takes the last idle sample, since top's first one covers the time before it ran", () => {
    expect(parseReadings(QUIET).idlePercent).toBe(98);
  });
});

describe("noiseWarnings", () => {
  it("has nothing to say about a quiet machine", () => {
    expect(noiseWarnings(parseReadings(QUIET))).toEqual([]);
  });

  it("names each thing that would disturb a measurement", () => {
    const warnings = noiseWarnings(
      parseReadings({
        battery: "Now drawing from 'Battery Power'\n 40%; discharging",
        thermal: "CPU_Speed_Limit = 80",
        backup: "Running = 1;",
        indexing: "Indexing enabled.",
        processes: "Load Avg: 9.0, 1, 1\nCPU usage: 40.0% user, 30.0% sys, 30.0% idle"
      })
    );
    expect(warnings).toEqual([
      "on battery",
      "thermal warning",
      "backup running",
      "volume indexed",
      "only 30% idle"
    ]);
  });
});
