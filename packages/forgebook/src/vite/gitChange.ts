/**
 * A change, as git names it: the commit it starts from, the diff, and the files git does not track yet.
 *
 * @remarks
 * `since` comes from a request, so it is resolved as a commit before anything else: passed on as it is, git takes
 * `--output=…` for an option and overwrites a file. The diff asks for one fixed form whatever the user's git settings,
 * since colours, external diff tools and other prefixes all read as an empty change, which is a check passing with
 * nothing checked. A change starts where the branch left `since`, or what `since` gained afterwards is read as this
 * change's.
 *
 * @module
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** The largest output read, in bytes: a change this size is for a person, not for this check. */
const MAX_OUTPUT = 64 * 1024 * 1024;

const run = promisify(execFile);

/** A change. */
export type GitChange = {
  /** Its unified diff, with no context. */
  readonly diff: string;
  /** The files it deletes, relative to the repository. */
  readonly deleted: readonly string[];
  /** The new files git does not track yet, relative to the repository. */
  readonly untracked: readonly string[];
};

/**
 * Runs git in a folder.
 *
 * @param dir - a folder of the repository.
 * @param args - its arguments.
 * @returns what it wrote.
 */
export const gitOutput = async (dir: string, ...args: readonly string[]): Promise<string> =>
  (await run("git", ["-c", "core.quotePath=false", ...args], { cwd: dir, maxBuffer: MAX_OUTPUT })).stdout;

/** The lines of a list git wrote. */
const listed = (text: string): readonly string[] => text.split("\n").filter((line) => line !== "");

/**
 * The commit a change starts from.
 *
 * @param dir - a folder of the repository.
 * @param since - a commit, as asked.
 * @returns its hash, or none when it names no commit.
 */
export const changeBase = async (dir: string, since: string): Promise<string | undefined> => {
  try {
    const commit = (
      await gitOutput(dir, "rev-parse", "--verify", "--quiet", "--end-of-options", `${since}^{commit}`)
    ).trim();
    return (await gitOutput(dir, "merge-base", commit, "HEAD")).trim();
  } catch {
    return undefined;
  }
};

/**
 * The files a change touches, tracked or new.
 *
 * @param dir - a folder of the repository.
 * @param base - the commit it starts from.
 * @returns the repository's folder, and the files relative to it.
 */
export const changedFiles = async (
  dir: string,
  base: string
): Promise<{ readonly root: string; readonly files: readonly string[] }> => {
  const root = (await gitOutput(dir, "rev-parse", "--show-toplevel")).trim();
  const tracked = listed(await gitOutput(dir, "diff", "--no-ext-diff", "--name-only", base, "--"));
  const untracked = listed(await gitOutput(dir, "ls-files", "--others", "--exclude-standard", "--full-name"));
  return { root, files: [...new Set([...tracked, ...untracked])] };
};

/**
 * Reads a change.
 *
 * @param dir - a folder of the repository.
 * @param since - a commit, as asked.
 * @returns the change, or why it cannot be read.
 */
export const gitChange = async (dir: string, since: string): Promise<GitChange | string> => {
  const base = await changeBase(dir, since);
  if (base === undefined) return `"${since}" names no commit here`;
  const form = ["--no-ext-diff", "--no-textconv", "--no-color", "--src-prefix=a/", "--dst-prefix=b/"];
  return {
    diff: await gitOutput(dir, "diff", ...form, "--unified=0", base, "--"),
    deleted: listed(await gitOutput(dir, "diff", ...form, "--name-only", "--diff-filter=D", base, "--")),
    untracked: listed(await gitOutput(dir, "ls-files", "--others", "--exclude-standard", "--full-name"))
  };
};
