/**
 * The shapes of the benchmark: what a metric gives, and the `--json` document.
 *
 * @module
 */

import type { SweepResult } from "./sweep.ts";

/** A tool the benchmark can drive. */
export type ToolName = "forgebook" | "storybook" | "ladle";

/** Where Forgebook's frames run: on an origin of their own, its default, or on the catalogue's. */
export type FramesMode = "isolated" | "same-origin";

/** What a metric's samples come to. Times in milliseconds, sizes in bytes. */
export type Summary = {
  /** The middle sample. */
  readonly median: number;
  /** The smallest sample. */
  readonly min: number;
  /** The largest sample. */
  readonly max: number;
  /** How many samples. */
  readonly samples: number;
  /** The 95th percentile, only with 20 samples or more: with fewer it is just the largest. */
  readonly p95?: number;
};

/** A metric's outcome for one tool: its summary, why this tool has no such number, or what went wrong. */
export type MetricResult =
  | { readonly kind: "measured"; readonly unit: "ms" | "bytes" | "count"; readonly summary: Summary }
  | { readonly kind: "absent"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };

/** One tool's results, by metric. */
export type ToolResult = {
  /** The versions installed, by package. */
  readonly versions: Readonly<Record<string, string>>;
  /** Every metric asked for. */
  readonly metrics: Readonly<Record<string, MetricResult>>;
};

/**
 * What a machine said about its load, before a tool's measurements. A reading a system cannot give is left out, or
 * `undefined`, never guessed: macOS gives the first seven, Windows and Linux what they have of them and the rest.
 */
export type MachineReadings = {
  /** Whether it runs from the mains: a machine without a battery always does. */
  readonly isOnCharger: boolean;
  /** The battery's charge, 0 to 100; none without a battery. */
  readonly batteryPercent: number | undefined;
  /** Whether the system reports a thermal or performance limit; only macOS says. */
  readonly hasThermalWarning: boolean | undefined;
  /** Whether a backup is running (Time Machine); only macOS says. */
  readonly isBackingUp: boolean | undefined;
  /** Whether the volume measured on is indexed (Spotlight); only macOS says. */
  readonly isIndexed: boolean | undefined;
  /** Idle CPU over the last second of the reading, 0 to 100. */
  readonly idlePercent: number | undefined;
  /** The one-minute load; Windows has none. */
  readonly load: number | undefined;
  /** The antivirus products the system knows, by name (Windows). */
  readonly antivirus?: readonly string[];
  /** Whether an antivirus scans files as they are opened (Windows): every file a tool reads pays for it. */
  readonly isScanningFiles?: boolean;
  /** The share of the whole machine the antivirus used over the last second, 0 to 100. */
  readonly antivirusCpuPercent?: number;
  /** The share the file indexer used (Windows Search; Tracker or Baloo on Linux), 0 to 100. */
  readonly indexerCpuPercent?: number;
  /** The share system updates used (Windows Update; apt, PackageKit on Linux), 0 to 100. */
  readonly updatesCpuPercent?: number;
  /** The power plan (Windows): `balanced`, `high performance`, `power saver`, or the plan's own name. */
  readonly powerPlan?: string;
};

/** The machine's load at a moment of the run. */
export type MachineReading = {
  /** When: the group about to start, or `end`. */
  readonly moment: string;
  /** What it read. */
  readonly reading: MachineReadings;
};

/** The machine a run took place on. */
export type MachineInfo = {
  /** `process.platform` and `process.arch`. */
  readonly platform: string;
  /** The system's version. */
  readonly system: string;
  /** The CPU's model. */
  readonly cpu: string;
  /** Logical CPUs. */
  readonly cpus: number;
  /** Memory, in bytes. */
  readonly memory: number;
  /** Node's version. */
  readonly node: string;
  /**
   * The system's own name and edition (`Microsoft Windows 11 Pro`, `Ubuntu 24.04.1 LTS`), where `system` alone is a
   * kernel's number; absent on macOS, whose reports name it by `system`.
   */
  readonly os?: string;
};

/** The real library a run took place on. */
export type RealCorpusInfo = {
  /** The corpus's name. */
  readonly name: string;
  /** The repository. */
  readonly repository: string;
  /** The commit. */
  readonly commit: string;
  /** Its licence's SPDX id. */
  readonly licence: string;
};

/** The `--json` document. */
export type BenchReport = {
  /** The shape's version, raised when a field changes meaning. */
  readonly version: 1;
  /** When the run started, as an ISO date. */
  readonly startedAt: string;
  /** The commit the Forgebook packages were packed from, or the published version measured. */
  readonly forgebook: string;
  /** The corpus measured: on a real library, `components` counts its story files, as its definition states them. */
  readonly corpus: {
    readonly components: number;
    readonly stories: number;
    readonly real?: RealCorpusInfo;
  };
  /** The component the story metrics were taken on. */
  readonly measured: string;
  /** The runs of each time. */
  readonly runs: number;
  /** The CPU throttle of the browser, 1 for none. */
  readonly throttle: number;
  /**
   * Where Forgebook's frames ran: on an origin of their own, or on the catalogue's. Absent from a report of a Forgebook
   * that had no such choice, whose frames always shared the catalogue's origin.
   */
  readonly frames?: FramesMode;
  /** The machine. */
  readonly machine: MachineInfo;
  /** Its load before each group and at the end, where it can be read. */
  readonly readings: readonly MachineReading[];
  /** What may have disturbed the run; empty for a quiet machine. */
  readonly warnings: readonly string[];
  /** The results by tool. */
  readonly tools: Readonly<Partial<Record<ToolName, ToolResult>>>;
  /** What became of every story, with the `sweep` group. */
  readonly sweep?: SweepResult;
};
