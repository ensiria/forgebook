/**
 * What the machine is and how loaded it is, so every result carries the conditions it was taken in.
 *
 * @remarks
 * The load is read from macOS's own commands, the reference machine's. Elsewhere there are no readings, only the
 * description: a CI runner's load is not the run's to judge. Parsing is pure.
 *
 * @module
 */
import { arch, cpus, platform, release, totalmem } from "node:os";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { MachineInfo, MachineReadings } from "./bench.types.ts";

/** Below this idle share a machine is too busy for its timings to be trusted. */
const MIN_IDLE_PERCENT = 85;

/** The raw output of the commands read. */
export type RawReadings = {
  /** `pmset -g batt`. */
  readonly battery: string;
  /** `pmset -g therm`. */
  readonly thermal: string;
  /** `tmutil status`. */
  readonly backup: string;
  /** `mdutil -s` on the volume, which answers for a mount point and not for a folder in it. */
  readonly indexing: string;
  /** `top -l 3 -n 0`. */
  readonly processes: string;
};

/**
 * Reads the commands' output.
 *
 * @param raw - what they printed.
 */
export const parseReadings = (raw: RawReadings): MachineReadings => {
  const idle = [...raw.processes.matchAll(/([\d.]+)% idle/g)].at(-1)?.[1];
  const load = /Load Avg: ([\d.]+)/.exec(raw.processes)?.[1];
  const percent = /(\d+)%;/.exec(raw.battery)?.[1];
  return {
    isOnCharger: raw.battery.includes("AC Power"),
    batteryPercent: percent === undefined ? undefined : Number(percent),
    hasThermalWarning:
      !raw.thermal.includes("No thermal warning") || !raw.thermal.includes("No performance warning"),
    isBackingUp: /Running = 1/.test(raw.backup),
    isIndexed: !raw.indexing.includes("Indexing disabled"),
    idlePercent: idle === undefined ? undefined : Number(idle),
    load: load === undefined ? undefined : Number(load)
  };
};

/**
 * What in the readings may disturb a measurement.
 *
 * @param readings - the machine's readings.
 */
export const noiseWarnings = (readings: MachineReadings): string[] => [
  ...(readings.isOnCharger ? [] : ["on battery"]),
  ...(readings.hasThermalWarning ? ["thermal warning"] : []),
  ...(readings.isBackingUp ? ["backup running"] : []),
  ...(readings.isIndexed ? ["volume indexed"] : []),
  ...(readings.idlePercent !== undefined && readings.idlePercent < MIN_IDLE_PERCENT
    ? [`only ${readings.idlePercent}% idle`]
    : [])
];

/**
 * The machine, described.
 *
 * @param node - Node's version.
 */
export const machineInfo = (node: string): MachineInfo => ({
  platform: `${platform()}-${arch()}`,
  system: release(),
  cpu: cpus()[0]?.model ?? "unknown",
  cpus: cpus().length,
  memory: totalmem(),
  node
});

/** The mount point of a folder's volume. */
const mountPoint = async (directory: string, io: ScriptIo): Promise<string> => {
  const { stdout } = await exec("df", [directory], { io, output: "capture" });
  return stdout.trim().split("\n").at(-1)?.split(/\s+/).at(-1) ?? directory;
};

/**
 * The machine's load now, on macOS.
 *
 * @param directory - the folder measured in, whose volume's indexing is read.
 * @param io - the script's streams.
 * @returns the readings, or nothing on another system.
 */
export const readMachine = async (directory: string, io: ScriptIo): Promise<MachineReadings | undefined> => {
  if (platform() !== "darwin") return undefined;
  const read = async (command: string, args: readonly string[]): Promise<string> => {
    const { stdout } = await exec(command, [...args], { io, check: false, output: "capture" });
    return stdout;
  };
  return parseReadings({
    battery: await read("pmset", ["-g", "batt"]),
    thermal: await read("pmset", ["-g", "therm"]),
    backup: await read("tmutil", ["status"]),
    indexing: await read("mdutil", ["-s", await mountPoint(directory, io)]),
    processes: await read("top", ["-l", "3", "-n", "0"])
  });
};
