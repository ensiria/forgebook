/**
 * The bench kit's folder, its saved state and the checks before a run: what every part of the kit shares.
 *
 * @module
 */
import { existsSync, readFileSync, statfsSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { join, resolve } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { confirm } from "@ensiria/cli-kit/prompts";
import { ScriptError } from "@ensiria/cli-kit/script";

import { machineInfo } from "../machine.ts";
import { execProgram } from "../programs.ts";
import {
  type KitItemId,
  type KitProfile,
  type PhaseTiming,
  type Reference,
  requirements
} from "./kitPlan.ts";
import { type KitState, parseState } from "./kitState.ts";

/** The repository's root, from this file. */
export const REPOSITORY = resolve(import.meta.dirname, "../../..");

/** The benchmark's entry. */
export const BENCH = join(REPOSITORY, "tools/bench/bench.mts");

/** The reference machine's durations, beside this file. */
export const REFERENCE_FILE = join(import.meta.dirname, "reference.json");

/** The file whose presence asks the launcher to remove the kit's folder once this process ended. */
export const CLEAN_MARKER = "clean-requested";

/** The first port the benchmark's servers take: the default, which nothing else on such a PC uses. */
export const PORT = "62100";

/** A gigabyte, in bytes. */
export const GB = 1024 ** 3;

/** The folders and files of the kit's own folder. */
export type KitPaths = {
  /** The kit's folder. */
  readonly home: string;
  /** Where the benchmark works. */
  readonly work: string;
  /** Where the calibration works. */
  readonly calibration: string;
  /** The status files. */
  readonly status: string;
  /** The logs. */
  readonly logs: string;
  /** The reports kept, by part. */
  readonly reports: string;
  /** The state. */
  readonly state: string;
};

/** The kit's paths under its folder. */
export const kitPaths = (home: string): KitPaths => ({
  home,
  work: join(home, "work"),
  calibration: join(home, "calibration"),
  status: join(home, "status"),
  logs: join(home, "logs"),
  reports: join(home, "reports"),
  state: join(home, "state.json")
});

/** What the questions need. */
export type Asker = {
  /** The script's streams. */
  readonly io: ScriptIo;
  /** Its logger. */
  readonly log: Logger;
  /** Whether `--yes` answers every question with its default. */
  readonly isYes: boolean;
};

/** This machine, as a key: a calibration copied with the folder to another machine is not reused. */
export const machineKey = (): string => {
  const info = machineInfo(process.version);
  return `${info.platform}|${info.cpu}|${info.cpus}|${info.memory}`;
};

/** Saves the state. */
export const saveState = (paths: KitPaths, state: KitState): void => {
  writeFileSync(paths.state, `${JSON.stringify(state, null, 2)}\n`);
};

/** The state saved, if it belongs to this commit and machine; a fresh one otherwise. */
export const loadState = (paths: KitPaths, commit: string, log: Logger): KitState => {
  const fresh: KitState = { commit, machine: machineKey(), items: {} };
  if (!existsSync(paths.state)) return fresh;
  const saved = parseState(readFileSync(paths.state, "utf8"));
  if (saved === undefined) {
    log.warn("Lo stato salvato non è leggibile: riparto da capo.");
    return fresh;
  }
  if (saved.commit !== commit || saved.machine !== fresh.machine) return fresh;
  return saved;
};

/** The reference machine's durations, checked. */
export const loadReference = (): Reference | undefined => {
  if (!existsSync(REFERENCE_FILE)) return undefined;
  const value: unknown = JSON.parse(readFileSync(REFERENCE_FILE, "utf8"));
  if (typeof value !== "object" || value === null) return undefined;
  const timing = (entry: unknown): PhaseTiming | undefined =>
    typeof entry === "object" &&
    entry !== null &&
    "prepareMs" in entry &&
    "measureMs" in entry &&
    typeof entry.prepareMs === "number" &&
    typeof entry.measureMs === "number"
      ? { prepareMs: entry.prepareMs, measureMs: entry.measureMs }
      : undefined;
  const calibration = "calibration" in value ? timing(value.calibration) : undefined;
  const machine = "machine" in value && typeof value.machine === "string" ? value.machine : undefined;
  if (calibration === undefined || machine === undefined) return undefined;
  const items: Partial<Record<KitItemId, PhaseTiming>> = {};
  const saved =
    "items" in value && typeof value.items === "object" && value.items !== null ? value.items : {};
  for (const id of ["generated", "primer", "carbon", "fluentui", "spectrum"] as const) {
    const entry = id in saved ? timing(Reflect.get(saved, id)) : undefined;
    if (entry !== undefined) items[id] = entry;
  }
  return { machine, calibration, items };
};

/** The bytes free on the disk of a folder. */
export const freeDisk = (folder: string): number => {
  const { bavail, bsize } = statfsSync(folder);
  return bavail * bsize;
};

/** Gigabytes, for a person. */
export const gigabytes = (bytes: number): string => `${(bytes / GB).toFixed(1).replace(".", ",")} GB`;

/**
 * Checks the disk and the memory a profile needs.
 *
 * @throws when either is below the minimum: starting would fail hours later.
 */
export const checkMachine = async (profile: KitProfile, paths: KitPaths, asker: Asker): Promise<void> => {
  const needs = requirements(profile);
  const disk = freeDisk(paths.home);
  const memory = totalmem();
  asker.log.info(`Spazio libero: ${gigabytes(disk)}. Memoria: ${gigabytes(memory)}.`);
  if (disk < needs.disk) {
    throw new ScriptError(`Spazio su disco insufficiente: servono ${gigabytes(needs.disk)} liberi.`, {
      hint: "Libera spazio sul disco e rilancia."
    });
  }
  if (memory < needs.minimumMemory) {
    throw new ScriptError(
      `Memoria insufficiente per questo profilo: servono ${gigabytes(needs.minimumMemory)}.`
    );
  }
  if (memory < needs.memory) {
    asker.log.warn(
      `Con meno di ${gigabytes(needs.memory)} di memoria qualche misura può fallire per memoria esaurita.`
    );
    const isGoing = await confirm({ message: "Continuo lo stesso?", default: true }, asker);
    if (!isGoing) throw new ScriptError("Fermato prima di iniziare.");
  }
};

/** The commit of this checkout. */
export const checkoutCommit = async (io: ScriptIo): Promise<string> => {
  const { stdout } = await execProgram("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY,
    io,
    output: "capture"
  });
  return stdout.trim();
};

/** A part's name, for a person. */
export const ITEM_NAMES: Readonly<Record<KitItemId, string>> = {
  generated: "libreria generata, 500 storie (Forgebook, Storybook, Ladle)",
  primer: "Primer (GitHub)",
  carbon: "Carbon (IBM)",
  fluentui: "Fluent UI (Microsoft)",
  spectrum: "React Spectrum (Adobe)"
};

/** A launch of the kit: its folders, its questions, and its state, saved on every change. */
export type Session = {
  /** The kit's folders. */
  readonly paths: KitPaths;
  /** What the questions need. */
  readonly asker: Asker;
  /** Where the results file goes. */
  readonly desktop: string;
  /** The state now. */
  readonly state: () => KitState;
  /** Changes the state and saves it. */
  readonly update: (change: Partial<KitState>) => void;
  /** Replaces the state and saves it. */
  readonly replace: (state: KitState) => void;
};
