/**
 * The folders a run works in: an app's clone at its pinned commit, installed once, and the copies each arm and each
 * measurement start from.
 *
 * @remarks
 * Three bases per app, each made once and committed by the harness: `without`, the app as its repository has it;
 * `with`, the same after Forgebook's packages are added and `forgebook init --agents` ran, what the agent finds in the
 * arm with Forgebook; `measure`, the app with Forgebook set up without the agents' files, where both arms' changes are
 * measured the same way. A run copies its base (a copy-on-write clone where the system has one), so an agent's work
 * never reaches another run. Every command gets only a program's variables (`toolEnvironment`), never the keys of the
 * environment, and installs with lifecycle scripts off.
 *
 * @module
 */
import { constants, existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { fetchClone } from "../bench/prepareCorpus.ts";
import { execProgram, TIME_LIMITS } from "../bench/programs.ts";
import { toolEnvironment } from "../bench/toolEnvironment.ts";
import type { Command, EvalApp } from "./eval.types.ts";

/**
 * Written beside a base once it is complete, holding what made it: a second evaluation reuses it. Beside, not inside:
 * an agent that found it in its copy would learn that it is being evaluated, and how.
 */
const stampFile = (folder: string): string => `${folder}.ready`;

/** What keeps an install from running a package's scripts, for the managers a flag does not reach. */
const NO_SCRIPTS = { npm_config_ignore_scripts: "true", YARN_ENABLE_SCRIPTS: "false" };

/**
 * Git as the harness runs it: no hook, no file-system monitor, no external diff or text conversion, no signature, and an
 * identity that says nothing of an evaluation, since an agent reads the history of its copy. A repository's own
 * configuration could otherwise run a program of its choosing when the harness commits or diffs.
 */
const GIT_CONFIG = [
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "diff.external=",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "user.name=Developer",
  "-c",
  "user.email=developer@example.invalid"
];

/** What a command of the harness needs besides its words. */
export type CommandContext = {
  /** The folder it runs in. */
  readonly cwd: string;
  /** The script's streams. */
  readonly io: ScriptIo;
  /** Variables added to a program's basics. */
  readonly env?: Readonly<Record<string, string>>;
  /** How long it may run, in milliseconds. */
  readonly timeoutMs?: number;
  /** Whether a non-zero exit throws; `true` by default. */
  readonly check?: boolean;
};

/**
 * Runs a command to its end and gives what it printed; a failure throws.
 *
 * @param command - the program and its arguments.
 * @param context - where and how.
 */
export const runCommand = async (command: Command, context: CommandContext): Promise<string> => {
  const [program, ...args] = command;
  if (program === undefined) return "";
  const { stdout } = await execProgram(program, args, {
    cwd: context.cwd,
    io: context.io,
    output: "capture",
    env: toolEnvironment(context.io.env, context.env ?? {}),
    timeoutMs: context.timeoutMs ?? TIME_LIMITS.install,
    check: context.check ?? true
  });
  return stdout;
};

/**
 * Runs Git in a folder with the harness's identity and no hook.
 *
 * @param args - Git's arguments.
 * @param context - where and how.
 */
export const git = (args: readonly string[], context: CommandContext): Promise<string> =>
  runCommand(["git", ...GIT_CONFIG, ...args], { timeoutMs: TIME_LIMITS.query, ...context });

/**
 * Commits everything the folder holds that Git does not ignore, and gives the commit.
 *
 * @param message - the commit's message.
 * @param context - where and how.
 */
export const commitAll = async (message: string, context: CommandContext): Promise<string> => {
  await git(["add", "--all"], context);
  await git(["commit", "--quiet", "--allow-empty", "--no-verify", "-m", message], context);
  return (await git(["rev-parse", "HEAD"], context)).trim();
};

/**
 * Puts back a copy's Git configuration from its base: the agent could change it, and the harness runs Git there after
 * the agent ends.
 *
 * @param base - the base the copy was made from.
 * @param copy - the copy.
 */
export const restoreGitConfig = async (base: string, copy: string): Promise<void> => {
  await cp(join(base, ".git", "config"), join(copy, ".git", "config"));
};

/**
 * Copies a folder, as a copy-on-write clone where the file system can, with symbolic links kept as they are (pnpm's
 * `node_modules` is made of them).
 *
 * @param from - the folder.
 * @param to - the copy, replaced when there.
 */
export const copyFolder = async (from: string, to: string): Promise<void> => {
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
};

/**
 * Where an app's base lives in the work folder.
 *
 * @param work - the work folder.
 * @param app - the app's name.
 * @param base - the base, with what makes it differ when several of one kind exist (`with-claude`).
 */
export const basePath = (work: string, app: string, base: string): string => join(work, "apps", app, base);

/** Whether a base is complete for this definition. */
const isReady = async (folder: string, stamp: string): Promise<boolean> =>
  existsSync(stampFile(folder)) && (await readFile(stampFile(folder), "utf8")) === stamp;

/**
 * The `without` base: the clone at its commit, installed, prepared. Made once per definition.
 *
 * @param app - the app.
 * @param work - the work folder.
 * @param env - variables every command of the app gets (the browsers' folder).
 * @param io - the script's streams.
 * @returns the base's folder, whose `HEAD` is the app's commit.
 */
export const appBase = async (
  app: EvalApp,
  work: string,
  env: Readonly<Record<string, string>>,
  io: ScriptIo
): Promise<string> => {
  const folder = basePath(work, app.name, "without");
  const stamp = JSON.stringify({ commit: app.commit, install: app.install, prepare: app.prepare });
  if (await isReady(folder, stamp)) return folder;
  await mkdir(folder, { recursive: true });
  await fetchClone(app, folder, io, () => undefined);
  const context = { cwd: folder, io, env: { ...env, ...NO_SCRIPTS } };
  await runCommand(app.install, context);
  for (const command of app.prepare) await runCommand(command, { ...context, env });
  await writeFile(stampFile(folder), stamp);
  return folder;
};

/**
 * A base made from another by a step, once per definition: copied, changed, committed.
 *
 * @param from - the base it starts from.
 * @param to - the new base's folder.
 * @param stamp - what makes it, so a changed step makes it again.
 * @param step - the change.
 * @param message - its commit's message, which the agent of the arm may read.
 * @param io - the script's streams.
 */
export const derivedBase = async (
  from: string,
  to: string,
  stamp: string,
  step: (folder: string) => Promise<void>,
  message: string,
  io: ScriptIo
): Promise<string> => {
  if (await isReady(to, stamp)) return to;
  await copyFolder(from, to);
  await step(to);
  await commitAll(message, { cwd: to, io });
  await writeFile(stampFile(to), stamp);
  return to;
};
