/**
 * The files a run changed, sorted by what they are, and the diff the judges read, with what would tell them the arm
 * taken out.
 *
 * @remarks
 * Judges score the product: what ships and its tests. Stories, Forgebook's and the agents' set-up files and lockfiles
 * are left out of their diff, since a story file alone says which arm wrote it; the automatic measures still count
 * them. A word naming the tool in what is left is replaced, and the run is marked, so the analysis can tell whether
 * the blinding held there.
 *
 * @module
 */

/** What a changed file is. */
export type FileKind = "product" | "test" | "story" | "tooling" | "lockfile";

/** Files of Forgebook's or an agent's own set-up, by pattern on the path from the clone's root. */
const TOOLING: readonly RegExp[] = [
  /(^|\/)forgebook\.(config|preview)\.[a-z]+$/,
  /(^|\/)\.mcp\.json$/,
  /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/,
  /^\.(agents|claude|cursor|codex|gemini|forgebook[^/]*)\//,
  /^\.github\/workflows\/forgebook[^/]*$/,
  /^forgebook-shots\//
];

/** Lockfiles: what an install wrote, not what a person reads. */
const LOCKFILES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$/;

/** Story files, in every framework's form. */
const STORY = /\.stories\.[a-z]+$|\.story\.[a-z]+$|\.mdx$/;

/** Test files. */
const TEST = /\.(test|spec|e2e)\.[a-z]+$|(^|\/)__tests__\//;

/** The word that names the tool, in any case. */
const TOOL_WORD = /forgebook/gi;

/** What replaces it in the judges' diff. */
export const REDACTED = "[tool]";

/**
 * What a changed file is.
 *
 * @param path - its path from the clone's root, with forward slashes.
 */
export const fileKind = (path: string): FileKind => {
  if (LOCKFILES.test(path)) return "lockfile";
  if (TOOLING.some((pattern) => pattern.test(path))) return "tooling";
  if (STORY.test(path)) return "story";
  if (TEST.test(path)) return "test";
  return "product";
};

/** One line of `git diff --numstat`. */
export type FileStat = {
  /** The path, the new one for a rename. */
  readonly path: string;
  /** Lines added; none for a binary file. */
  readonly added: number;
  /** Lines removed; none for a binary file. */
  readonly removed: number;
};

/**
 * Reads `git diff --numstat -z` with renames found: each entry `added\tremoved\tpath\0`, or for a rename
 * `added\tremoved\t\0old\0new\0`.
 *
 * @param output - the command's output.
 */
export const parseNumstat = (output: string): FileStat[] => {
  const parts = output.split("\0");
  const stats: FileStat[] = [];
  let index = 0;
  while (index < parts.length) {
    const head = parts[index] ?? "";
    index += 1;
    if (head === "") continue;
    const [added = "-", removed = "-", path = ""] = head.split("\t");
    let file = path;
    if (path === "") {
      // a rename: the old path, then the new one, each its own entry
      file = parts[index + 1] ?? "";
      index += 2;
    }
    stats.push({
      path: file,
      added: added === "-" ? 0 : Number(added),
      removed: removed === "-" ? 0 : Number(removed)
    });
  }
  return stats;
};

/**
 * Whether a product file lies outside a task's scope: neither one of its files nor in one of its folders (a scope
 * entry ending in `/`).
 *
 * @param path - the file.
 * @param scope - the task's scope.
 */
export const isOutsideScope = (path: string, scope: readonly string[]): boolean =>
  !scope.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) : path === entry));

/** Whether judges see a file of this kind. */
export const isForJudges = (kind: FileKind): boolean => kind === "product" || kind === "test";

/**
 * A diff for the judges: every word naming the tool replaced.
 *
 * @param diff - the diff of the files judges see.
 * @returns the text, and how many words were replaced.
 */
export const redactedDiff = (diff: string): { readonly text: string; readonly redactions: number } => {
  let redactions = 0;
  const text = diff.replace(TOOL_WORD, () => {
    redactions += 1;
    return REDACTED;
  });
  return { text, redactions };
};
