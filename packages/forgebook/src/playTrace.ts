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

/** One thing a play did through the tools its context hands it, in the Interactions tab's log. */
export type PlayAction = {
  /** What it did, as a call: `userEvent.click(<button> "Save")`. */
  readonly label: string;
  /** Where it is. */
  readonly status: PlayStatus;
  /** How long it took, in ms, once over. */
  readonly ms?: number;
  /** Why it failed. */
  readonly error?: string;
  /** The named step it ran in, its place in `steps`; none outside one. */
  readonly step?: number;
};

/** A play's trace. */
export type PlayTrace = {
  /** Where the play is. */
  readonly status: PlayStatus;
  /** Its named steps, in order. */
  readonly steps: readonly PlayStep[];
  /** What it did through its context's tools, in order; none when it did nothing through them. */
  readonly actions?: readonly PlayAction[];
  /** What it waits to do next, while it is stepped through; none otherwise. */
  readonly pausedAt?: string;
  /** How long it took, in ms, once over. */
  readonly ms?: number;
  /** Why it failed. */
  readonly error?: string;
};

/** Whether a value is a status. */
const isStatus = (value: unknown): value is PlayStatus =>
  value === "running" || value === "passed" || value === "failed" || value === "off";

/** Whether a record's optional `ms`, `error` and `pausedAt` have their types. */
const hasOptionalEnd = (record: Readonly<Record<string, unknown>>): boolean =>
  (record["ms"] === undefined || typeof record["ms"] === "number") &&
  (record["error"] === undefined || typeof record["error"] === "string") &&
  (record["pausedAt"] === undefined || typeof record["pausedAt"] === "string");

/** Whether a value is a step, as it arrives in a message. */
const isStep = (value: unknown): value is PlayStep => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  return typeof record["label"] === "string" && isStatus(record["status"]) && hasOptionalEnd(record);
};

/** Whether a value is a list of steps or actions, which share their shape. */
const isStepList = (value: unknown): boolean => Array.isArray(value) && value.every(isStep);

/**
 * Whether a value is a play's trace, as it arrives in a message.
 *
 * @param value - the message's trace.
 */
export const isPlayTrace = (value: unknown): value is PlayTrace => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  return (
    isStatus(record["status"]) &&
    isStepList(record["steps"]) &&
    (record["actions"] === undefined || isStepList(record["actions"])) &&
    hasOptionalEnd(record)
  );
};
