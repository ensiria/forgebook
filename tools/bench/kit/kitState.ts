/**
 * What the bench kit remembers between two launches: the calibration, the profile chosen and each part's outcome, so a
 * run that stopped (a closed window, a restart) resumes where it was.
 *
 * @remarks
 * The file is checked as it is read, and one that does not match is set aside rather than half-trusted: the worst a
 * lost state costs is running a part again. Parsing is pure.
 *
 * @module
 */
import type { KitItemId, KitProfile, PhaseTiming } from "./kitPlan.ts";

/** How a part ended. */
export type ItemOutcome =
  /** Every metric measured. */
  | "done"
  /** A report, with failures or warnings in it: the numbers that exist are kept. */
  | "problems"
  /** No report. */
  | "failed";

/** A part that ran. */
export type ItemState = {
  /** How it ended. */
  readonly outcome: ItemOutcome;
  /** The benchmark's exit code. */
  readonly exitCode: number | null;
  /** Its phases. */
  readonly timing: PhaseTiming;
};

/** The kit's state. */
export type KitState = {
  /** The Forgebook commit the kit runs. */
  readonly commit: string;
  /** The machine the calibration was taken on, so a copied folder does not reuse another's. */
  readonly machine: string;
  /** This machine's calibration, once taken. */
  readonly calibration?: PhaseTiming;
  /** The profile of the current run, once chosen. */
  readonly profile?: KitProfile;
  /** When the current run started, as an ISO date. */
  readonly startedAt?: string;
  /** The estimate shown before it started, in milliseconds. */
  readonly estimateMs?: number;
  /** The parts of the current run that ended. */
  readonly items: Readonly<Partial<Record<KitItemId, ItemState>>>;
  /** The results file written for the current run. */
  readonly archive?: string;
};

/** Whether a value is an object with string keys. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A phase timing, checked. */
const timingOf = (value: unknown): PhaseTiming | undefined =>
  isRecord(value) && typeof value["prepareMs"] === "number" && typeof value["measureMs"] === "number"
    ? { prepareMs: value["prepareMs"], measureMs: value["measureMs"] }
    : undefined;

/** The parts' ids. */
const ITEM_IDS: readonly KitItemId[] = ["generated", "primer", "carbon", "fluentui", "spectrum"];

/** The outcomes. */
const OUTCOMES: readonly ItemOutcome[] = ["done", "problems", "failed"];

/** A part's state, checked. */
const itemOf = (value: unknown): ItemState | undefined => {
  if (!isRecord(value)) return undefined;
  const outcome = OUTCOMES.find((each) => each === value["outcome"]);
  const timing = timingOf(value["timing"]);
  const code = value["exitCode"];
  if (outcome === undefined || timing === undefined || (typeof code !== "number" && code !== null))
    return undefined;
  return { outcome, exitCode: code, timing };
};

/**
 * The state a file holds, if it is the kit's.
 *
 * @param text - the file's text.
 * @returns the state, or nothing for a file that is not a state of the kit.
 */
export const parseState = (text: string): KitState | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || typeof value["commit"] !== "string" || typeof value["machine"] !== "string") {
    return undefined;
  }
  const items: Partial<Record<KitItemId, ItemState>> = {};
  const savedItems = isRecord(value["items"]) ? value["items"] : {};
  for (const id of ITEM_IDS) {
    const item = itemOf(savedItems[id]);
    if (item !== undefined) items[id] = item;
  }
  const calibration = timingOf(value["calibration"]);
  const profile = (["quick", "full"] as const).find((each) => each === value["profile"]);
  const { startedAt, estimateMs, archive } = value;
  return {
    commit: value["commit"],
    machine: value["machine"],
    items,
    ...(calibration === undefined ? {} : { calibration }),
    ...(profile === undefined ? {} : { profile }),
    ...(typeof startedAt === "string" ? { startedAt } : {}),
    ...(typeof estimateMs === "number" ? { estimateMs } : {}),
    ...(typeof archive === "string" ? { archive } : {})
  };
};
