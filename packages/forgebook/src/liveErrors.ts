/**
 * The errors the open frames report to the dev server while someone edits: a story that could not be shown and a
 * play that failed, numbered as they come, the last hundred kept, for `forgebook errors` and the MCP tool
 * `recent_errors`.
 *
 * @remarks
 * A frame sends them over Vite's own connection to the dev server (`import.meta.hot`), so a build has none and nothing
 * is sent outside development. Only frames open in a browser report: a command that opens none (`forgebook check`)
 * reports its own problems. Each error is numbered, so a client asks only for those after the last it read. A story's
 * error comes with its stack, which the server maps (`vite/stackLines.ts`): it keeps the place, and answers the frame
 * with the stack mapped, so the frame shows the lines as written. Pure apart from the ring's own state.
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
  /** The error's stack as the browser wrote it, in the lines of the code it ran: the dev server maps it. */
  readonly stack?: string;
};

/** An error as the dev server keeps it, before its number: the place its stack maps to instead of the stack. */
export type KeptErrorReport = Omit<LiveErrorReport, "stack"> & {
  /**
   * Where it was thrown, as `file:line:column` in the file as written, relative to the project: the first place of
   * its stack outside `node_modules`. None when the frame sent no stack or none of it could be mapped.
   */
  readonly place?: string;
};

/** An error as the dev server keeps it: numbered, with when it came. */
export type LiveError = KeptErrorReport & {
  /** Its number, counted from 1 since the server started. */
  readonly n: number;
  /** When it came, in ISO 8601. */
  readonly at: string;
};

/** The errors kept, and how to add and read them. */
export type LiveErrors = {
  /** Keeps a frame's error, the oldest let go past the limit. */
  readonly add: (report: KeptErrorReport, at: Date) => LiveError;
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
  typeof value.message === "string" &&
  (!("stack" in value) || typeof value.stack === "string");

/** The event the dev server answers a frame's stack under, mapped to the lines of the files as written. */
export const MAPPED_STACK_EVENT = "forgebook:mapped-stack";

/** A stack the dev server mapped, for the frame that sent it. */
export type MappedStackAnswer = {
  /** The stack as the frame sent it. */
  readonly sent: string;
  /** The stack mapped. */
  readonly stack: string;
};

/**
 * Whether the dev server's message is a mapped stack.
 *
 * @param value - what came over the connection.
 */
export const isMappedStackAnswer = (value: unknown): value is MappedStackAnswer =>
  typeof value === "object" &&
  value !== null &&
  "sent" in value &&
  typeof value.sent === "string" &&
  "stack" in value &&
  typeof value.stack === "string";

/**
 * A ring of the last errors.
 *
 * @param limit - how many it keeps; a hundred by default.
 */
export const createLiveErrors = (limit = 100): LiveErrors => {
  const kept: LiveError[] = [];
  let last = 0;
  return {
    add: (report: KeptErrorReport, at: Date): LiveError => {
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
