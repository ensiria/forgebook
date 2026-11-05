/**
 * The progress of a run, as a file another program can follow.
 *
 * @remarks
 * One JSON line per step, appended, so `tail -F` follows it from anywhere, over SSH too, and a reader that arrives late
 * reads the last line. The harness writes only between measurements: whatever follows the file must not be able to
 * wake up during one. Between measurements a run also says what it is busy with when that takes long (packing, the
 * installs, a library's clone and preparation, the sweep), so a reader can tell a long step from a stuck one.
 *
 * @module
 */
import { appendFileSync } from "node:fs";

import type { ToolName } from "./bench.types.ts";

/** A step of the run. */
export type RunStep = {
  /** The tool being measured. */
  readonly tool: ToolName;
  /** The metric. */
  readonly metric: string;
  /** The run of this metric, from 1. */
  readonly run: number;
  /** How many runs of this metric. */
  readonly runs: number;
  /** The steps done in the whole benchmark. */
  readonly done: number;
  /** The steps of the whole benchmark. */
  readonly total: number;
};

/** What a run is busy with outside its measurements. */
export type ActivityName =
  /** Building and packing Forgebook. */
  | "pack"
  /** Installing a tool, or a library's dependencies. */
  | "install"
  /** Fetching a library's pinned commit. */
  | "clone"
  /** A library's own preparation: what its stories import, built. */
  | "prepare"
  /** Opening every story of a library. */
  | "sweep"
  /** A group of edits, between two of its edits: part of a measurement, written in the pause between samples. */
  | "edit";

/** A long step outside the measurements, written as it starts, and for the sweep as it goes. */
export type RunActivity = {
  /** That the run is busy outside a measurement. */
  readonly state: "working";
  /** With what. */
  readonly activity: ActivityName;
  /** The tool it is for, when it is one tool's. */
  readonly tool?: ToolName;
  /**
   * The items of this step done, when it counts them (the sweep's stories): not the run's steps, which a sample's
   * `done` counts.
   */
  readonly count?: number;
  /** The items of this step in all, when it counts them. */
  readonly of?: number;
};

/** The last line of a run. */
export type RunEnd = {
  /** That the run is over, whatever came of it. */
  readonly state: "finished";
  /** How many warnings about the machine it ended with. */
  readonly warnings: number;
};

/**
 * A writer of steps.
 *
 * @param file - where the lines go; none writes nothing.
 * @param now - the clock, in milliseconds.
 */
export const statusWriter =
  (file: string | undefined, now: () => number) =>
  (step: RunStep | RunActivity | RunEnd): void => {
    if (file === undefined) return;
    appendFileSync(file, `${JSON.stringify({ at: now(), ...step })}\n`);
  };
