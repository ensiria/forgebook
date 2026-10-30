/**
 * The `--json` document of `forgebook-heights`: how many stories were measured, which failed and why, and where the
 * heights went.
 *
 * @module
 */

/** A story that could not be measured. */
export type HeightFailure = {
  /** The story's id. */
  readonly story: string;
  /** Why: its error, or that it did not answer in time. */
  readonly reason: string;
};

/** What `forgebook-heights` reports. */
export type HeightsReport = {
  /** The file the heights were written to. */
  readonly out: string;
  /** The widths measured at, in CSS px. */
  readonly widths: readonly number[];
  /** How many stories the catalogue has. */
  readonly stories: number;
  /** How many were measured. */
  readonly measured: number;
  /** The ones that failed, left out of the file. */
  readonly failures: readonly HeightFailure[];
};
