/**
 * The trace of a story's play function: whether it is running, passed or failed, how long it took, and each step the
 * play named with `step(label, run)`, so the panel's Interactions tab shows where a play stopped.
 *
 * @remarks
 * A play is a test: it throws when the story does not behave. The trace records the throw's message; the frame still
 * lets it reach the page, where the generated tests record it as an error.
 *
 * @module
 */

/** Where a play or one of its steps is; `off`: the reader's switch kept it from running when the story opened. */
export type PlayStatus = "running" | "passed" | "failed" | "off";

/** One step a play named. */
export type PlayStep = {
  /** What the step does, as the play named it. */
  readonly label: string;
  /** Where it is. */
  readonly status: PlayStatus;
  /** How long it took, in ms, once over. */
  readonly ms?: number;
  /** Why it failed. */
  readonly error?: string;
};

/** A play's trace. */
export type PlayTrace = {
  /** Where the play is. */
  readonly status: PlayStatus;
  /** Its named steps, in order. */
  readonly steps: readonly PlayStep[];
  /** How long it took, in ms, once over. */
  readonly ms?: number;
  /** Why it failed. */
  readonly error?: string;
};

/** Whether a value is a status. */
const isStatus = (value: unknown): value is PlayStatus =>
  value === "running" || value === "passed" || value === "failed" || value === "off";

/** Whether a record's optional `ms` and `error` have their types. */
const hasOptionalEnd = (record: Readonly<Record<string, unknown>>): boolean =>
  (record["ms"] === undefined || typeof record["ms"] === "number") &&
  (record["error"] === undefined || typeof record["error"] === "string");

/** Whether a value is a step, as it arrives in a message. */
const isStep = (value: unknown): value is PlayStep => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  return typeof record["label"] === "string" && isStatus(record["status"]) && hasOptionalEnd(record);
};

/**
 * Whether a value is a play's trace, as it arrives in a message.
 *
 * @param value - the message's trace.
 */
export const isPlayTrace = (value: unknown): value is PlayTrace => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  const steps = record["steps"];
  return isStatus(record["status"]) && Array.isArray(steps) && steps.every(isStep) && hasOptionalEnd(record);
};
