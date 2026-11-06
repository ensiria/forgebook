/**
 * What a bundler's error says, as Forgebook reports it: its file, line and column when they are known, and its reason,
 * without the plugin that raised it, the stack and the code frame a terminal or an overlay has room for.
 *
 * @remarks
 * Shared by `forgebook build`, on what the build throws, and by a frame, on what the dev server says of a module it
 * could not serve. Both hold the same text: Vite's transform and the build run the same parser.
 *
 * @module
 */

/** Where in a file a bundler places an error, when it does; its column counts from 0. */
export type BundlerErrorPlace = {
  /** The file, absolute. */
  readonly id?: string | undefined;
  /** Its line and column. */
  readonly loc?:
    | { readonly file?: string | undefined; readonly line: number; readonly column: number }
    | undefined;
};

/** The place at the head of a code frame (`╭─[ src/Broken.tsx:1:48 ]`), which a parse error alone names its file in. */
const FRAME_PLACE = /╭─\[\s*(.+?)\s*\]/;

/** A line that says nothing of the reason: a count of errors, a stack's, a code frame's. */
const NOISE = /^(?:(?:Transform|Build) failed with \d+ errors?:?$|at .*:\d+:\d+\)?$|[╭│╰─┬]|\d+\s*[│|])/;

/** The plugin or tool that raised an error, before its reason (`[PARSE_ERROR]`, `[plugin forgebook]`). */
const RAISED_BY = /^\[[^\]]+\]\s*/;

/**
 * An error's place, as an editor counts: `file:line:column`, or the file alone.
 *
 * @param place - what the error says of it.
 * @param message - its message, without colours.
 */
const placeOf = ({ id, loc }: BundlerErrorPlace, message: string): string | undefined => {
  const framed = FRAME_PLACE.exec(message)?.[1];
  if (framed !== undefined) return framed;
  const file = loc?.file ?? id;
  if (file === undefined || loc === undefined) return file;
  return `${file}:${loc.line}:${loc.column + 1}`;
};

/**
 * A bundler's error as lines: its place and reason first.
 *
 * @param message - its message, without colours.
 * @param place - what the error says of its place.
 * @returns the lines; none when the message says nothing.
 */
export const bundlerErrorLines = (message: string, place: BundlerErrorPlace = {}): readonly string[] => {
  const lines = message
    .split("\n")
    .map((line) => line.replace(RAISED_BY, "").trim())
    .filter((line) => line !== "" && !NOISE.test(line));
  const where = placeOf(place, message);
  const [first, ...rest] = lines;
  if (first === undefined || where === undefined || first.startsWith(where)) return lines;
  return [`${where}: ${first}`, ...rest];
};
