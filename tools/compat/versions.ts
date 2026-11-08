/**
 * The few version rules the matrix needs: reading `1.2.3-rc.1`, ordering two versions as npm does, and the caret
 * ranges packages write in their peer dependencies. Written here rather than taken from a library because the matrix
 * reads only carets joined by `||`; any other range is refused, so a range the matrix cannot read is never read wrong.
 *
 * @module
 */

/** A version split into its parts. */
type Version = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** The identifiers after `-`, numbers where they are digits only; empty for a release. */
  readonly prerelease: readonly (string | number)[];
};

/** `1.2.3`, `1.2.3-rc.1`, `1.2.3-canary-abc-2026`; build metadata after `+` is ignored, as ordering ignores it. */
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** A version's parts, or `undefined` when the text is not one. */
export const parseVersion = (text: string): Version | undefined => {
  const match = VERSION.exec(text.trim());
  if (match === null) return undefined;
  const [, major = "", minor = "", patch = "", prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease:
      prerelease === undefined
        ? []
        : prerelease.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
  };
};

/** Whether a version carries a prerelease part (`-rc.1`). */
export const isPrerelease = (text: string): boolean => (parseVersion(text)?.prerelease.length ?? 0) > 0;

/** Orders two prerelease identifiers: numbers below words, numbers by value, words by their characters. */
const compareIdentifier = (a: string | number, b: string | number): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/**
 * Orders two versions as npm does: by major, minor and patch, a prerelease before its release, prereleases by their
 * identifiers.
 *
 * @throws when either is not a version.
 */
export const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (left === undefined || right === undefined) throw new Error(`not a version: ${left ? b : a}`);
  const core = left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (core !== 0) return core;
  if (left.prerelease.length === 0 || right.prerelease.length === 0)
    return right.prerelease.length - left.prerelease.length;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const ours = left.prerelease[index];
    const theirs = right.prerelease[index];
    if (ours === undefined) return -1;
    if (theirs === undefined) return 1;
    const order = compareIdentifier(ours, theirs);
    if (order !== 0) return order;
  }
  return 0;
};

/** One caret clause of a range: the versions from `lower` up to, not including, `upper`, and the line they form. */
export type CaretClause = {
  /** The lowest version inside, included. */
  readonly lower: string;
  /** The first version outside, excluded. */
  readonly upper: string;
  /** The line a reader knows: the major, or `0.minor` (`0.0.patch`) below 1.0, where a caret stays within it. */
  readonly line: string;
};

/** `^1`, `^1.2`, `^1.2.3`. */
const CARET = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/**
 * The caret clauses of a range such as `^18.2.0 || ^19.0.0`.
 *
 * @throws when a clause is not a caret, so a range the matrix cannot read stops the run instead of being guessed.
 */
export const caretClauses = (range: string): CaretClause[] =>
  range.split("||").map((clause): CaretClause => {
    const match = CARET.exec(clause.trim());
    if (match === null)
      throw new Error(`the range ${range} has a clause that is not a caret (^x.y.z): ${clause.trim()}`);
    const [, majorText = "0", minorText, patchText] = match;
    const major = Number(majorText);
    const minor = Number(minorText ?? "0");
    const patch = Number(patchText ?? "0");
    const lower = `${major}.${minor}.${patch}`;
    // npm's caret keeps the first number that is not zero, among those written: `^1.2` to 2.0.0, `^0.2` to 0.3.0,
    // `^0.0.3` to 0.0.4; a zero left unwritten is free: `^0` to 1.0.0, `^0.0` to 0.1.0
    if (major > 0 || minorText === undefined) return { lower, upper: `${major + 1}.0.0`, line: `${major}` };
    if (minor > 0 || patchText === undefined) return { lower, upper: `0.${minor + 1}.0`, line: `0.${minor}` };
    return { lower, upper: `0.0.${patch + 1}`, line: `0.0.${patch}` };
  });

/** Whether a released version falls inside a caret clause; a prerelease never does, as npm reads a caret. */
export const satisfiesClause = (version: string, clause: CaretClause): boolean =>
  !isPrerelease(version) &&
  compareVersions(version, clause.lower) >= 0 &&
  compareVersions(version, clause.upper) < 0;

/** The newest released version inside a caret clause, or `undefined` when none was published. */
export const newestInClause = (versions: readonly string[], clause: CaretClause): string | undefined =>
  versions
    .filter((version) => parseVersion(version) !== undefined && satisfiesClause(version, clause))
    .sort(compareVersions)
    .at(-1);
