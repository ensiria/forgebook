/**
 * The reading of a machine's load.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  type LinuxRaw,
  noiseWarnings,
  osReleaseName,
  parseLinuxReadings,
  parseReadings,
  parseWindowsReadings
} from "./machine.ts";

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

/** A Windows reading of a desktop on four cores: no battery, Defender on, the indexer at work. */
const WINDOWS = {
  cpus: 4,
  battery: [],
  antivirus: { name: "Windows Defender", state: 397_568 },
  defenderRealTime: true,
  plan: "GUID combinazione per il risparmio di energia: 381b4222-f694-41f0-9685-ff5bb260df2e  (Bilanciato)",
  first: {
    stamp: "133800000000000000",
    processes: [
      { name: "Idle", time: "900000000" },
      { name: "MsMpEng", time: "5000000" },
      { name: "SearchProtocolHost", time: "100" },
      { name: "SearchProtocolHost", time: "200" }
    ]
  },
  second: {
    stamp: "133800000010000000",
    processes: [
      { name: "Idle", time: "936000000" },
      { name: "MsMpEng", time: "5400000" },
      { name: "SearchProtocolHost", time: "1000300" },
      { name: "SearchProtocolHost", time: "1000000" }
    ]
  }
};

describe("parseWindowsReadings", () => {
  it("computes the shares from the raw counters, a second over four cores", () => {
    expect(parseWindowsReadings(WINDOWS)).toEqual({
      isOnCharger: true,
      batteryPercent: undefined,
      hasThermalWarning: undefined,
      isBackingUp: undefined,
      isIndexed: undefined,
      idlePercent: 90,
      load: undefined,
      antivirus: ["Windows Defender"],
      isScanningFiles: true,
      antivirusCpuPercent: 1,
      indexerCpuPercent: 5,
      updatesCpuPercent: 0,
      powerPlan: "balanced"
    });
  });

  it("knows a laptop on battery, and a single entry PowerShell printed as an object", () => {
    const readings = parseWindowsReadings({ ...WINDOWS, battery: { status: 1, charge: 64 } });
    expect(readings?.isOnCharger).toBe(false);
    expect(readings?.batteryPercent).toBe(64);
  });

  it("reads a third-party antivirus that scans while Defender rests", () => {
    const readings = parseWindowsReadings({
      ...WINDOWS,
      defenderRealTime: false,
      antivirus: [{ name: "Other AV", state: 266_240 }]
    });
    expect(readings?.isScanningFiles).toBe(true);
  });

  it("keeps a power plan it does not know by its own name", () => {
    const plan = "Power Scheme GUID: 11111111-2222-3333-4444-555555555555  (Vendor Turbo)";
    expect(parseWindowsReadings({ ...WINDOWS, plan })?.powerPlan).toBe("Vendor Turbo");
  });

  it("gives nothing for what is not the script's document", () => {
    expect(parseWindowsReadings(undefined)).toBeUndefined();
  });

  it("warns of the busy indexer and the power saver plan", () => {
    const plan = "GUID: a1841308-3541-4fab-bc81-f71556f20b4a (Risparmio energia)";
    const readings = parseWindowsReadings({ ...WINDOWS, plan });
    expect(readings === undefined ? [] : noiseWarnings(readings)).toEqual([
      "indexer busy (5% CPU)",
      "power saver plan"
    ]);
  });
});

/** A Linux laptop on the mains, with Tracker indexing and a name holding a space and a parenthesis. */
const LINUX: LinuxRaw = {
  supplies: [
    { type: "Mains", online: "1", status: undefined, capacity: undefined },
    { type: "Battery", online: undefined, status: "Charging", capacity: "80" }
  ],
  loadavg: "0.52 0.40 0.31 1/812 4242",
  before: {
    stat: "cpu  1000 0 500 8000 500 0 0 0 0 0",
    processes: ["812 (tracker-miner-f) S 1 812 812 0 -1 4194560 0 0 0 0 10 5 0 0"]
  },
  after: {
    stat: "cpu  1040 0 520 8920 520 0 0 0 0 0",
    processes: ["812 (tracker-miner-f) S 1 812 812 0 -1 4194560 0 0 0 0 70 5 0 0"]
  }
};

describe("parseLinuxReadings", () => {
  it("reads the mains, the idle share, the load and the indexer", () => {
    expect(parseLinuxReadings(LINUX)).toEqual({
      isOnCharger: true,
      batteryPercent: 80,
      hasThermalWarning: undefined,
      isBackingUp: undefined,
      isIndexed: undefined,
      idlePercent: 94,
      load: 0.52,
      antivirusCpuPercent: 0,
      indexerCpuPercent: 6,
      updatesCpuPercent: 0
    });
  });

  it("knows a laptop on battery, and a desktop with no supply listed", () => {
    const onBattery = parseLinuxReadings({
      ...LINUX,
      supplies: [
        { type: "Mains", online: "0", status: undefined, capacity: undefined },
        { type: "Battery", online: undefined, status: "Discharging", capacity: "50" }
      ]
    });
    expect(onBattery.isOnCharger).toBe(false);
    expect(parseLinuxReadings({ ...LINUX, supplies: [] }).isOnCharger).toBe(true);
  });
});

describe("osReleaseName", () => {
  it("reads the distribution's name, quoted or not", () => {
    expect(osReleaseName('NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n')).toBe("Ubuntu 24.04.1 LTS");
    expect(osReleaseName("PRETTY_NAME=Debian\n")).toBe("Debian");
    expect(osReleaseName("NAME=x\n")).toBeUndefined();
  });
});
