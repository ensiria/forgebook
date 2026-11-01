/**
 * The progress of a run, as a file another program can follow.
 *
 * @remarks
 * One JSON line per step, appended, so `tail -F` follows it from anywhere, over SSH too, and a reader that arrives late
 * reads the last line. The harness writes only between measurements: whatever follows the file must not be able to
 * wake up during one.
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

/**
 * A writer of steps.
 *
 * @param file - where the lines go; none writes nothing.
 * @param now - the clock, in milliseconds.
 */
export const statusWriter =
  (file: string | undefined, now: () => number) =>
  (step: RunStep): void => {
    if (file === undefined) return;
    appendFileSync(file, `${JSON.stringify({ at: now(), ...step })}\n`);
  };
