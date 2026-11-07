/**
 * Puts a real corpus on disk: the clone at its pinned commit, the library's own dependencies, and Forgebook beside its
 * stories.
 *
 * @remarks
 * The clone is fetched shallow and without its large files, runs no hook, and is installed with lifecycle scripts off.
 * Its code still runs: a library that pins its package manager in the repository (Yarn's release file) installs with
 * that file, `prepare` builds what its stories import, and its stories and Storybook run in the measurements. So every
 * command gets only the variables a program needs (`toolEnvironment.ts`), never the tokens of the environment, and a
 * definition names only public repositories at pinned commits. Forgebook goes in a folder of its own inside the catalogue's folder, with the versions of its target, and
 * without React: a story and the frame must share the library's one copy, or a hook has two Reacts to choose from.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { execProgram, PREPARE_SILENCE_MS, TIME_LIMITS } from "./programs.ts";
import { DEFINITION_FILE } from "./realCorpus.ts";
import type { CorpusPaths, RealCorpus } from "./realCorpus.types.ts";
import type { RunActivity } from "./statusFile.ts";
import { toolEnvironment } from "./toolEnvironment.ts";

/** Written in the clone once its dependencies are in, holding what was installed: a second run skips the install. */
const INSTALLED_STAMP = ".forgebook-bench-installed";

/** Git without hooks, whatever the clone says. */
const GIT = ["-c", "core.hooksPath=/dev/null"];

/** What keeps an install from running a package's scripts, for the package managers npm's flag does not reach. */
const NO_SCRIPTS = {
  npm_config_ignore_scripts: "true",
  YARN_ENABLE_SCRIPTS: "false"
};

/**
 * Fetches the commit alone, or finds it there, and puts the clone back on it: shallow, without large files, with no
 * hook and no credentials asked.
 *
 * @param source - the repository and its pinned commit.
 * @param clone - the clone's folder, made when missing.
 * @param io - the script's streams.
 * @param onActivity - told when the checkout starts.
 */
export const fetchClone = async (
  { repository, commit }: Pick<RealCorpus, "repository" | "commit">,
  clone: string,
  io: ScriptIo,
  onActivity: (activity: RunActivity) => void
): Promise<void> => {
  const git = (...args: readonly string[]): ReturnType<typeof execProgram> =>
    execProgram("git", [...GIT, ...args], {
      cwd: clone,
      io,
      output: "capture",
      // a clone's checkout of a large monorepo takes long on a slow disk too, so every step gets the fetch's limit
      timeoutMs: TIME_LIMITS.fetch,
      // no prompt for credentials and no system configuration: a pinned public commit needs neither
      env: toolEnvironment(io.env, {
        GIT_LFS_SKIP_SMUDGE: "1",
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_NOSYSTEM: "1"
      })
    });
  if (!existsSync(join(clone, ".git"))) {
    await mkdir(clone, { recursive: true });
    await git("init", "--quiet");
    await git("remote", "add", "origin", repository);
  }
  // a new pinned commit, or a run stopped before its fetch ended, leaves the clone without it
  const hasCommit = await git("cat-file", "-e", `${commit}^{commit}`).then(
    () => true,
    () => false
  );
  if (!hasCommit) {
    await git("remote", "set-url", "origin", repository);
    await git("fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", commit);
  }
  // a line again: the fetch and the checkout of a large monorepo each take their own long while
  onActivity({ state: "working", activity: "clone" });
  await git("checkout", "--quiet", "--force", commit);
  await git("reset", "--quiet", "--hard", commit);
  const { stdout } = await git("rev-parse", "HEAD");
  if (stdout.trim() !== commit) throw new Error(`the clone is at ${stdout.trim()}, not ${commit}`);
};

/** Runs a command of the definition from the clone's root. */
const runCommand = async (
  [program, ...args]: readonly string[],
  clone: string,
  env: Readonly<Record<string, string>>,
  limits: { readonly timeoutMs: number; readonly silenceMs?: number },
  io: ScriptIo
): Promise<void> => {
  if (program === undefined) return;
  await execProgram(program, args, {
    cwd: clone,
    io,
    output: "capture",
    env: toolEnvironment(io.env, env),
    ...limits
  });
};

/** What an install is made of: the commit and the commands, so a changed definition installs again. */
export const installStamp = ({ commit, install, prepare }: RealCorpus): string =>
  JSON.stringify({ commit, install, prepare: prepare ?? [] });

/** Installs the library's dependencies, once for a commit and its commands, and builds what its stories need. */
const installLibrary = async (
  corpus: RealCorpus,
  clone: string,
  io: ScriptIo,
  onActivity: (activity: RunActivity) => void
): Promise<void> => {
  const stamp = join(clone, INSTALLED_STAMP);
  const done = existsSync(stamp) ? (await readFile(stamp, "utf8")).trim() : "";
  if (done === installStamp(corpus)) return;
  await rm(stamp, { force: true });
  onActivity({ state: "working", activity: "install" });
  await runCommand(corpus.install, clone, NO_SCRIPTS, { timeoutMs: TIME_LIMITS.install }, io);
  const commands = corpus.prepare ?? [];
  for (const [index, command] of commands.entries()) {
    // a line per command: each is bounded by its own limit, so the silence a watcher allows covers one
    onActivity({ state: "working", activity: "prepare", count: index, of: commands.length });
    await runCommand(
      command,
      clone,
      {},
      { timeoutMs: TIME_LIMITS.prepare, silenceMs: PREPARE_SILENCE_MS },
      io
    );
  }
  await writeFile(stamp, `${installStamp(corpus)}\n`);
};

/**
 * Refuses an edited file that is not a plain file of the clone: a link there would have the edits write wherever it
 * points.
 *
 * @throws naming the file.
 */
const checkEditedFiles = async ({ edits }: RealCorpus, { catalogue }: CorpusPaths): Promise<void> => {
  for (const { file } of [edits.story, edits.component]) {
    const stats = await lstat(join(catalogue, file));
    if (!stats.isFile()) throw new Error(`${file} is not a plain file of the clone`);
  }
};

/**
 * The manifest of the folder Forgebook runs from: its packages and Vite, and nothing of the library's.
 *
 * @param packages - Forgebook's packages: tarballs or a published version.
 * @param vite - Vite's version, the one Forgebook's target pins.
 */
export const benchManifest = (
  packages: Readonly<Record<string, string>>,
  vite: string
): Readonly<Record<string, unknown>> => {
  const story = packages["@forgebook/story-format"];
  return {
    name: "forgebook-bench",
    private: true,
    type: "module",
    dependencies: { ...packages, vite },
    // the tarball of this checkout, not the published version the packed core asks for
    ...(story === undefined ? {} : { overrides: { "@forgebook/story-format": story } })
  };
};

/** Vite's version in Forgebook's target. */
const pinnedVite = async (repository: string): Promise<string> => {
  const manifest: unknown = JSON.parse(
    await readFile(join(repository, "tools/bench/targets/forgebook/package.json"), "utf8")
  );
  if (typeof manifest === "object" && manifest !== null && "dependencies" in manifest) {
    const { dependencies } = manifest;
    if (typeof dependencies === "object" && dependencies !== null && "vite" in dependencies)
      return String(dependencies.vite);
  }
  throw new Error("Forgebook's target pins no Vite");
};

/** Installs Forgebook in its folder, and copies the corpus's configuration there. */
const installForgebook = async (
  { definition, bench }: CorpusPaths,
  packages: Readonly<Record<string, string>>,
  repository: string,
  io: ScriptIo
): Promise<void> => {
  await rm(bench, { recursive: true, force: true });
  await mkdir(bench, { recursive: true });
  const manifest = benchManifest(packages, await pinnedVite(repository));
  await writeFile(join(bench, "package.json"), JSON.stringify(manifest, null, 2));
  // no peers: they would bring a second React, and a library older than Forgebook's peer range is measured as it is
  const flags = ["--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel=error"];
  await execProgram("npm", ["install", ...flags], {
    cwd: bench,
    io,
    output: "capture",
    timeoutMs: TIME_LIMITS.install
  });
  const files = await readdir(definition);
  await Promise.all(
    files
      .filter((file) => file !== DEFINITION_FILE)
      .map((file) => cp(join(definition, file), join(bench, file), { recursive: true }))
  );
};

/** What `prepareCorpus` works with. */
export type CorpusRequest = {
  /** The corpus. */
  readonly corpus: RealCorpus;
  /** Where it lives. */
  readonly paths: CorpusPaths;
  /** Forgebook's packages. */
  readonly packages: Readonly<Record<string, string>>;
  /** This repository's root. */
  readonly repository: string;
  /** Told when a long step starts. */
  readonly onActivity: (activity: RunActivity) => void;
};

/**
 * Puts a corpus on disk, ready to run.
 *
 * @param request - what to prepare.
 * @param io - the script's streams.
 */
export const prepareCorpus = async (
  { corpus, paths, packages, repository, onActivity }: CorpusRequest,
  io: ScriptIo
): Promise<void> => {
  onActivity({ state: "working", activity: "clone" });
  await fetchClone(corpus, paths.clone, io, onActivity);
  await checkEditedFiles(corpus, paths);
  await installLibrary(corpus, paths.clone, io, onActivity);
  onActivity({ state: "working", activity: "install", tool: "forgebook" });
  await installForgebook(paths, packages, repository, io);
};
