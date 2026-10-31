/**
 * The errors the open frames report to the dev server while someone edits: a story that could not be shown and a
 * play that failed, numbered as they come, the last hundred kept, for `forgebook errors` and the MCP tool
 * `recent_errors`.
 *
 * @remarks
 * A frame sends them over Vite's own connection to the dev server (`import.meta.hot`), so a build has none and nothing
 * is sent outside development. Only frames open in a browser report: a command that opens none (`forgebook check`)
 * reports its own problems. Each error is numbered, so a client asks only for those after the last it read. Pure apart
 * from the ring's own state.
 *
 * @module
 */

/** The event a frame sends its errors under. */
export const LIVE_ERROR_EVENT = "forgebook:live-error";

/** What went wrong in a frame. */
export type LiveErrorKind = "render" | "play";

/** An error as a frame reports it. */
export type LiveErrorReport = {
  /** A story that could not be shown, or a play that failed. */
  readonly kind: LiveErrorKind;
  /** The story's id. */
  readonly storyId: string;
  /** The frame's view, as its address's query writes it. */
  readonly view: string;
  /** What went wrong. */
  readonly message: string;
};

/** An error as the dev server keeps it: numbered, with when it came. */
export type LiveError = LiveErrorReport & {
  /** Its number, counted from 1 since the server started. */
  readonly n: number;
  /** When it came, in ISO 8601. */
  readonly at: string;
};

/** The errors kept, and how to add and read them. */
export type LiveErrors = {
  /** Keeps a frame's error, the oldest let go past the limit. */
  readonly add: (report: LiveErrorReport, at: Date) => LiveError;
  /** The errors after a number, oldest first; every one kept for 0. */
  readonly since: (n: number) => LiveError[];
  /** The number of the last error, 0 before any. */
  readonly last: () => number;
};

/**
 * Whether a frame's message is an error report.
 *
 * @param value - what came over the connection.
 */
export const isLiveErrorReport = (value: unknown): value is LiveErrorReport =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value.kind === "render" || value.kind === "play") &&
  "storyId" in value &&
  typeof value.storyId === "string" &&
  "view" in value &&
  typeof value.view === "string" &&
  "message" in value &&
  typeof value.message === "string";

/**
 * A ring of the last errors.
 *
 * @param limit - how many it keeps; a hundred by default.
 */
export const createLiveErrors = (limit = 100): LiveErrors => {
  const kept: LiveError[] = [];
  let last = 0;
  return {
    add: (report: LiveErrorReport, at: Date): LiveError => {
      last += 1;
      const error: LiveError = { ...report, n: last, at: at.toISOString() };
      kept.push(error);
      if (kept.length > limit) kept.shift();
      return error;
    },
    since: (n: number): LiveError[] => kept.filter((error) => error.n > n),
    last: (): number => last
  };
};
