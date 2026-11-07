/**
 * A change, as git names it: the commit it starts from, the diff, and the files git does not track yet.
 *
 * @remarks
 * `since` comes from a request, so it is resolved as a commit before anything else: passed on as it is, git takes
 * `--output=…` for an option and overwrites a file. The diff asks for one fixed form whatever the user's git settings,
 * since colours, external diff tools and other prefixes all read as an empty change, which is a check passing with
 * nothing checked. A change starts where the branch left `since`, or what `since` gained afterwards is read as this
 * change's. A branch's committed work counts as its change, so a check run after a commit does not find nothing and
 * pass: `branchStart` names the default branch to start from, and a clone with no history to find the start in is told
 * apart from a name that means nothing.
 *
 * @module
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** The largest output read, in bytes: a change this size is for a person, not for this check. */
const MAX_OUTPUT = 64 * 1024 * 1024;

const run = promisify(execFile);

/** A change. */
export type GitChange = {
  /** The commit it is measured from. */
  readonly base: string;
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

/**
 * The names of a list git wrote with `-z`: otherwise it quotes a name that holds a quotation mark or a tab, which then
 * matches no file and no rule.
 */
const listed = (text: string): readonly string[] => text.split("\0").filter((name) => name !== "");

/** The new files git does not track, in the whole repository: from a subfolder it would list that folder's only. */
const untrackedFiles = async (root: string): Promise<readonly string[]> =>
  listed(await gitOutput(root, "ls-files", "-z", "--others", "--exclude-standard", "--full-name"));

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
 * Why a change has no start, in words that say what to do: a shallow clone, which is CI's default, knows the commit and
 * not what it shares with this one.
 *
 * @param dir - a folder of the repository.
 * @param since - a commit, as asked.
 */
export const noBaseReason = async (dir: string, since: string): Promise<string> => {
  try {
    await gitOutput(dir, "rev-parse", "--verify", "--quiet", "--end-of-options", `${since}^{commit}`);
    return `"${since}" shares no history with this commit here: in a shallow clone, fetch the whole history (fetch-depth: 0)`;
  } catch {
    return `"${since}" names no commit here`;
  }
};

/** The branches a repository's work usually starts from, when its remote names none. */
const USUAL_DEFAULT_BRANCHES = ["origin/main", "origin/master", "main", "master"];

/**
 * Where a branch's work starts when nobody says: the default branch, or `HEAD` when there is none to start from. On the
 * default branch itself that is what is not pushed.
 *
 * @param dir - a folder of the repository.
 * @returns the name to compare with.
 */
export const branchStart = async (dir: string): Promise<string> => {
  const named = await gitOutput(dir, "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").catch(
    () => ""
  );
  for (const branch of [named.trim(), ...USUAL_DEFAULT_BRANCHES]) {
    if (branch !== "" && (await changeBase(dir, branch)) !== undefined) return branch;
  }
  return "HEAD";
};

/** The files a change touches. */
export type ChangedFiles = {
  /** The repository's folder. */
  readonly root: string;
  /** The files, tracked or new, relative to it. */
  readonly files: readonly string[];
  /** Those it deletes. */
  readonly deleted: readonly string[];
};

/**
 * The files a change touches, tracked or new.
 *
 * @param dir - a folder of the repository.
 * @param base - the commit it starts from.
 * @returns the repository's folder, the files relative to it, and which of them it deletes.
 */
export const changedFiles = async (dir: string, base: string): Promise<ChangedFiles> => {
  const root = (await gitOutput(dir, "rev-parse", "--show-toplevel")).trim();
  const names = ["--no-ext-diff", "--no-relative", "--name-only", "-z"];
  const tracked = listed(await gitOutput(dir, "diff", ...names, base, "--"));
  const deleted = listed(await gitOutput(dir, "diff", ...names, "--diff-filter=D", base, "--"));
  return { root, files: [...new Set([...tracked, ...(await untrackedFiles(root))])], deleted };
};

/**
 * The changed files as the catalogue's graph names them: absolute, under the catalogue's folder as configured, in Vite's
 * form. Git names real paths (with forward slashes on Windows too), and a folder reached through a link has another.
 *
 * @param dir - the catalogue's folder, as configured.
 * @param realDir - the same folder with its links followed.
 * @param root - the repository's folder, as git names it.
 * @param files - the files, relative to the repository.
 * @param paths - the path functions; the running system's unless a test names another.
 */
export const catalogueChangedFiles = (
  dir: string,
  realDir: string,
  root: string,
  files: readonly string[],
  paths: VitePaths = VITE_PATHS
): string[] => files.map((file) => paths.join(dir, paths.relative(realDir, paths.join(root, file))));

/**
 * Reads a change.
 *
 * @param dir - a folder of the repository.
 * @param since - a commit, as asked.
 * @returns the change, or why it cannot be read.
 */
export const gitChange = async (dir: string, since: string): Promise<GitChange | string> => {
  const base = await changeBase(dir, since);
  if (base === undefined) return noBaseReason(dir, since);
  const form = [
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    "--no-relative",
    "--src-prefix=a/",
    "--dst-prefix=b/"
  ];
  const root = (await gitOutput(dir, "rev-parse", "--show-toplevel")).trim();
  return {
    base,
    diff: await gitOutput(dir, "diff", ...form, "--unified=0", base, "--"),
    deleted: listed(
      await gitOutput(dir, "diff", ...form, "--name-only", "-z", "--diff-filter=D", base, "--")
    ),
    untracked: await untrackedFiles(root)
  };
};
