/**
 * The stories `verify` found a problem in, run again on the commit the change starts from, so the verdict counts only
 * what the change brought: an application whose stories already break an accessibility rule would otherwise fail every
 * change, and a red verdict that is always red tells an agent nothing.
 *
 * @remarks
 * The base is checked out with `git worktree add --detach` beside the repository (a hidden folder next to it, named
 * after the base and the process, removed after; one a run left behind is removed by the next), so the working tree is
 * never touched. It has no dependencies of its own: each `node_modules` folder of the working tree gets a twin in it whose
 * entries link to the working tree's, except a workspace package, which links to the same package in the base, so the
 * base runs its own code. Its catalogue is served by a server of its own for the run, which runs the base's configuration.
 * A problem is the same in both when its story, view, kind and rule match and, for an accessibility rule, its element,
 * else its message once addresses, positions and the two folders are taken out; each problem of the base matches one of
 * the change's, so a second copy of an old problem is new.
 *
 * @module
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";

import type { StoryCheckReport, StoryCheckResult, StoryProblem } from "../../src/storyCheck.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { findConfigFile } from "../../src/vite/configFile.ts";
import { gitOutput, gitOutputIn } from "../../src/vite/gitChange.ts";
import { configOf } from "./catalogueCommands.ts";
import { isProcessRunning } from "./commandCacheClaim.ts";
import { runStoriesCheck } from "./storyCheckRun.ts";

/** Folders whose `node_modules` are not looked for: the base's own copies of them hold no package. */
const NOT_WALKED = new Set(["node_modules", ".git"]);

/** How deep folders are searched for a `node_modules` to link: a monorepo's packages sit a few levels down. */
const MAX_DEPTH = 4;

/**
 * The folders of a tree, relative to it, that hold a `node_modules`, at most `MAX_DEPTH` levels down.
 *
 * @param root - the working tree's root.
 */
const modulesFolders = (root: string): string[] => {
  const found: string[] = [];
  const walk = (folder: string, depth: number): void => {
    if (existsSync(join(root, folder, "node_modules"))) found.push(folder);
    if (depth >= MAX_DEPTH) return;
    for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
      if (entry.isDirectory() && !NOT_WALKED.has(entry.name) && !entry.name.startsWith("."))
        walk(join(folder, entry.name), depth + 1);
    }
  };
  walk("", 0);
  return found;
};

/** Where a working tree's package link should point in the base: the same package there, when it is a workspace's. */
const linkTarget = (entry: string, root: string, folder: string): string => {
  if (!lstatSync(entry).isSymbolicLink()) return entry;
  const real = realpathSync(entry);
  const inside = relative(root, real);
  const isWorkspace = !inside.startsWith("..") && !inside.split(sep).includes("node_modules");
  return isWorkspace ? join(folder, inside) : entry;
};

/**
 * Gives a base folder a `node_modules` twin of the working tree's: each entry linked to the working tree's, a workspace
 * package to the base's own.
 *
 * @param from - the working tree's `node_modules`.
 * @param to - the base's, made.
 * @param root - the working tree's root.
 * @param folder - the base's root.
 */
const twinModules = (from: string, to: string, root: string, folder: string): void => {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const entry = join(from, name);
    if (name.startsWith("@") && lstatSync(entry).isDirectory())
      twinModules(entry, join(to, name), root, folder);
    else symlinkSync(linkTarget(entry, root, folder), join(to, name), "junction");
  }
};

/**
 * How the base's folder is removed: tried again for a moment while it is still being written in. A server Vite closes
 * while its first pre-bundle runs (a base with none of the stories asked for closes at once) cancels the run, but the
 * bundler still writes its files into the cache folder inside, and the removal would fail on a folder not empty. The
 * removal waits between tries without holding the process, so what is still writing can finish.
 */
const BASE_REMOVAL = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;

/** The prefix of the folders a base runs in, beside the repository. */
const folderPrefix = (root: string): string => `.${basename(root)}-forgebook-base-`;

/**
 * The environment of the git commands that make, remove and prune the base's worktree: without `GIT_INDEX_FILE`, which
 * git sets for its hooks. A pre-commit hook that runs `verify` would otherwise have the base's checkout written into the
 * index of the commit being made: a relative one fails the checkout, and an absolute one (`git commit -a`) turns the
 * commit into the base's files.
 *
 * @param env - the run's environment.
 */
const worktreeEnv = (
  env: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(Object.entries(env).filter(([name]) => name !== "GIT_INDEX_FILE"));

/** Removes the base folders a run that is gone left beside the repository, and git's record of them. */
const sweep = async (root: string, env: Readonly<Record<string, string | undefined>>): Promise<void> => {
  const prefix = folderPrefix(root);
  for (const name of readdirSync(dirname(root)).filter((each) => each.startsWith(prefix))) {
    const pid = Number(name.split("-").pop());
    if (Number.isInteger(pid) && !isProcessRunning(pid))
      rmSync(join(dirname(root), name), { recursive: true, force: true });
  }
  await gitOutputIn(root, env, "worktree", "prune").catch(() => undefined);
};

/** Positions, query stamps and addresses: what differs between two runs of the same code. */
const RUN_NOISE = [/https?:\/\/[^\s)'"]+/g, /:\d+:\d+/g, /\?[a-z]=[\w.-]+/g];

/** A problem's message with what differs between two runs of the same story taken out. */
const plainMessage = (message: string, folders: readonly string[]): string =>
  RUN_NOISE.reduce(
    (text, noise) => text.replace(noise, ""),
    folders.reduce((text, folder) => text.split(folder).join("<root>"), message)
  );

/**
 * A problem as a key two runs share when it is the same problem: an accessibility rule by its element (its message
 * carries measures, as a contrast's ratio), anything else by its message without what differs between runs.
 *
 * @param result - the story and view it was found in.
 * @param problem - the problem.
 * @param folders - the folders to take out of its message: the working tree's and the base's.
 */
export const problemKey = (
  result: Pick<StoryCheckResult, "storyId" | "view">,
  problem: StoryProblem,
  folders: readonly string[]
): string =>
  [
    result.storyId,
    result.view,
    problem.kind,
    problem.rule ?? "",
    problem.kind === "axe" ? (problem.element ?? "") : plainMessage(problem.message, folders)
  ].join("\u0000");

/** What the base's report says, split: the change's problems, those the base had, and stories the base did not see. */
export type SplitByBase = {
  /** The change's report with only the problems the base did not have. */
  readonly report: StoryCheckReport;
  /** The problems the base had too, by story and view. */
  readonly existing: readonly StoryCheckResult[];
  /** How many stories the base never saw in their final state: their problems all count. */
  readonly unseen: number;
};

/**
 * The head's results split into the problems the change brought and those the base had too, each of the base's
 * problems matching one of the change's.
 *
 * @param head - the report on the change.
 * @param base - the report on the base, for the stories that failed on the change.
 * @param folders - the working tree's folder and the base's, taken out of the messages.
 */
export const splitByBase = (
  head: StoryCheckReport,
  base: StoryCheckReport,
  folders: readonly string[]
): SplitByBase => {
  const left = new Map<string, number>();
  const seen = base.results.filter((result) => result.notVerified === undefined);
  for (const result of seen)
    for (const problem of result.problems) {
      const key = problemKey(result, problem, folders);
      left.set(key, (left.get(key) ?? 0) + 1);
    }
  const results = head.results.map((result) => {
    const brought: StoryProblem[] = [];
    const old: StoryProblem[] = [];
    for (const problem of result.problems) {
      const key = problemKey(result, problem, folders);
      const count = left.get(key) ?? 0;
      if (count > 0) {
        left.set(key, count - 1);
        old.push(problem);
      } else brought.push(problem);
    }
    return { result, brought, old };
  });
  return {
    report: { ...head, results: results.map(({ result, brought }) => ({ ...result, problems: brought })) },
    existing: results
      .filter(({ old }) => old.length > 0)
      .map(({ result, old }) => ({ ...result, problems: old })),
    unseen: base.results.length - seen.length
  };
};

/** The base's run: its report, the folder it ran in and the working tree's root, or why it could not run. */
export type BaseRun =
  | { readonly report: StoryCheckReport; readonly folder: string; readonly root: string }
  | string;

/**
 * Runs stories on the base commit, in a worktree of its own beside the repository, removed after.
 *
 * @param config - the catalogue's configuration on the change.
 * @param base - the base commit, as `git merge-base` gave it.
 * @param ids - the stories to run.
 * @param isAllVariants - whether every variant runs, as on the change.
 * @param runEnv - the run's environment.
 */
export const runOnBase = async (
  config: ResolvedConfig,
  base: string,
  ids: readonly string[],
  isAllVariants: boolean,
  runEnv: Readonly<Record<string, string | undefined>>
): Promise<BaseRun> => {
  const env = worktreeEnv(runEnv);
  const root = (await gitOutput(config.dir, "rev-parse", "--show-toplevel")).trim();
  const folder = join(dirname(root), `${folderPrefix(root)}${base.slice(0, 12)}-${process.pid}`);
  const twins: string[] = [];
  try {
    await sweep(root, env);
    await gitOutputIn(root, env, "worktree", "add", "--detach", "--force", folder, base);
    for (const each of modulesFolders(root)) {
      const twin = join(folder, each, "node_modules");
      if (!existsSync(join(folder, each)) || existsSync(twin)) continue;
      twinModules(join(root, each, "node_modules"), twin, root, folder);
      twins.push(twin);
    }
    const configFile = findConfigFile(join(folder, relative(root, config.dir)));
    if (configFile === undefined) return "the catalogue has no configuration at the base";
    const report = await runStoriesCheck(await configOf(configFile), undefined, { ids, isAllVariants });
    return typeof report === "string" ? report : { report, folder, root };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    // the links go first, so nothing that removes the worktree can follow one into the working tree
    for (const twin of twins) await rm(twin, BASE_REMOVAL);
    await gitOutputIn(root, env, "worktree", "remove", "--force", folder).catch(() => undefined);
    await rm(folder, BASE_REMOVAL);
  }
};
