/**
 * The files a list of patterns names, as Vite's `import.meta.glob` and fast-glob read one: the union of its patterns,
 * less what its `!` patterns match, whatever their order. Used for a catalogue's story files and docs pages, by the
 * plugin and by the testing package, so both list the same files.
 *
 * @remarks
 * A `!` pattern is matched by the same engine as the others (Node's `globSync`), from the same folder, so it follows
 * the same syntax: `!src/**\/legacy/*.stories.tsx` leaves out what `src/**\/legacy/*.stories.tsx` would list, and one
 * that matches a folder (`!src/drafts`) leaves out every file in it, as fast-glob does. A file two
 * patterns list is listed once, by the first, whose static start begins its title (as Storybook's first specifier
 * does). A list of `!` patterns alone lists nothing, which is a mistake, never what its author meant: it is refused.
 *
 * @module
 */
import { globSync, statSync } from "node:fs";

import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** What starts a pattern that leaves files out. */
const NEGATION = "!";

/**
 * Whether a pattern leaves files out (`!src/**\/legacy/*`) rather than listing them. One that starts with an extglob's
 * `!(…)` lists the names its group does not match, as fast-glob reads it.
 *
 * @param pattern - the pattern.
 */
export const isNegated = (pattern: string): boolean =>
  pattern.startsWith(NEGATION) && !pattern.startsWith(`${NEGATION}(`);

/**
 * Why a list of patterns lists nothing by construction, or none: every pattern in it is a `!` one, which only leaves
 * files out of what the others list.
 *
 * @param patterns - the patterns.
 */
export const patternsProblem = (patterns: readonly string[]): string | undefined =>
  patterns.length > 0 && patterns.every(isNegated)
    ? `every pattern is a \`!\` one (${patterns.map((pattern) => `"${pattern}"`).join(", ")}), which only leaves files out of what the others list: add a pattern that lists files beside them`
    : undefined;

/** The folder of a project's dependencies. */
const DEPENDENCIES = "node_modules";

/**
 * What a pattern leaves out: the dependencies, unless it names them. A `**` from a monorepo's root would otherwise walk
 * every package's, seconds on the server's thread for files nobody asked for, as Storybook's own globs skip them.
 *
 * @param pattern - the pattern.
 */
const excludedFrom = (pattern: string): ((name: string) => boolean) =>
  pattern.includes(DEPENDENCIES) ? (): boolean => false : (name: string): boolean => name === DEPENDENCIES;

/**
 * The paths one pattern matches, as Node's `globSync` gives them (backslashes on Windows), relative to the folder.
 *
 * @param root - the folder the pattern is relative to.
 * @param pattern - the pattern, without a `!`.
 */
export type FindFiles = (root: string, pattern: string) => readonly string[];

/** The files a pattern matches on the disk, the dependencies left out unless it names them. */
const globbed: FindFiles = (root: string, pattern: string): readonly string[] =>
  globSync(pattern, { cwd: root, exclude: excludedFrom(pattern) });

/**
 * Whether a file is left out: a `!` pattern matched it, or one of the folders it is in (`!src/drafts`), as fast-glob
 * leaves out a folder's every file.
 *
 * @param key - the file's key (`./src/drafts/x.stories.tsx`).
 * @param left - the keys of the files and folders the `!` patterns matched.
 */
const isLeftOut = (key: string, left: ReadonlySet<string>): boolean => {
  const segments = key.split("/");
  return segments.some((_segment, at) => at > 0 && left.has(segments.slice(0, at + 1).join("/")));
};

/**
 * A pattern without its trailing slashes (`src/drafts/`): the glob gives the folder it names without them. A loop,
 * not a regular expression, whose backtracking a long run of slashes would make quadratic.
 *
 * @param pattern - the pattern.
 */
const withoutTrailingSlashes = (pattern: string): string => {
  let end = pattern.length;
  while (end > 0 && pattern[end - 1] === "/") end -= 1;
  return pattern.slice(0, end);
};

/** A file a list of patterns lists, with the pattern that lists it. */
export type ListedFile = {
  /** Its path relative to the patterns' folder, starting with `./` or `../`, with forward slashes. */
  readonly key: string;
  /** The first pattern that lists it: its static start begins the file's title when its meta writes none. */
  readonly pattern: string;
};

/**
 * The files a list of patterns lists, each once, sorted by key.
 *
 * @param root - the folder the patterns are relative to: the declaring module's.
 * @param patterns - the patterns (`../src/**\/*.stories.tsx`, `!../src/**\/legacy/*`), in any order.
 * @param find - what matches one pattern; the disk's by default, another system's in a test.
 * @param paths - the path functions; the running system's unless a test names another.
 * @throws when every pattern is a `!` one (`patternsProblem`).
 */
export const listedFiles = (
  root: string,
  patterns: readonly string[],
  find: FindFiles = globbed,
  paths: VitePaths = VITE_PATHS
): ListedFile[] => {
  const problem = patternsProblem(patterns);
  if (problem !== undefined) throw new Error(problem);
  // with forward slashes on every system, so a file has the same key wherever the catalogue runs
  const keysOf = (pattern: string): readonly string[] =>
    find(root, pattern).map((file) => paths.relativeKey(root, file));
  const listing = patterns.filter((each) => !isNegated(each));
  // a `!` pattern that names the dependencies leaves out only what a listing one names there: walked otherwise, it
  // would read every package's folder for files no pattern lists
  const isWalkedFor = (pattern: string): boolean =>
    !pattern.includes(DEPENDENCIES) || listing.some((each) => each.includes(DEPENDENCIES));
  const left = new Set(
    patterns
      .filter((each) => isNegated(each) && isWalkedFor(each))
      .flatMap((pattern) => keysOf(withoutTrailingSlashes(pattern.slice(NEGATION.length))))
  );
  const listed = new Map<string, string>();
  for (const pattern of listing)
    for (const key of keysOf(pattern))
      if (!isLeftOut(key, left) && !listed.has(key)) listed.set(key, pattern);
  // by code unit, as a plain `sort()` orders the keys: the keys are unique
  return [...listed]
    .sort(([first], [second]) => (first < second ? -1 : 1))
    .map(([key, pattern]) => ({ key, pattern }));
};

/**
 * The patterns of a list that list no file, left out by the `!` ones as they are when the catalogue lists its files. Each
 * is read on its own: a mistaken pattern beside one that works is as silent as a list that lists nothing.
 *
 * @param root - the folder the patterns are relative to.
 * @param patterns - the patterns.
 */
export const unmatchedPatterns = (root: string, patterns: readonly string[]): readonly string[] => {
  const leftOut = patterns.filter(isNegated);
  // a pattern can match folders alone (`stories/**` over empty ones), which hold no story
  const isFile = ({ key }: ListedFile): boolean =>
    statSync(VITE_PATHS.resolve(root, key), { throwIfNoEntry: false })?.isFile() === true;
  return patterns
    .filter((pattern) => !isNegated(pattern))
    .filter((pattern) => !listedFiles(root, [pattern, ...leftOut]).some(isFile));
};
