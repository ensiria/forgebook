/**
 * Puts a real corpus on disk: the clone at its pinned commit, the library's own dependencies, and Forgebook beside its
 * stories.
 *
 * @remarks
 * The clone's content is data. It is fetched shallow and without its large files, runs no hook, and is installed with
 * lifecycle scripts off; `prepare`, when a definition has one, is the only code of the library that runs before its
 * stories. Forgebook goes in a folder of its own inside the catalogue's folder, with the versions of its target, and
 * without React: a story and the frame must share the library's one copy, or a hook has two Reacts to choose from.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { NO_DAEMONS } from "./leftovers.ts";
import { execProgram } from "./programs.ts";
import { DEFINITION_FILE } from "./realCorpus.ts";
import type { CorpusPaths, RealCorpus } from "./realCorpus.types.ts";

/** Written in the clone once its dependencies are in, holding the commit: a second run skips the install. */
const INSTALLED_STAMP = ".forgebook-bench-installed";

/** Git without hooks, whatever the clone says. */
const GIT = ["-c", "core.hooksPath=/dev/null"];

/** What keeps an install from running a package's scripts, for the package managers npm's flag does not reach. */
const NO_SCRIPTS = {
  npm_config_ignore_scripts: "true",
  YARN_ENABLE_SCRIPTS: "false",
  YARN_ENABLE_TELEMETRY: "0"
};

/** Fetches the commit alone, or finds it there, and puts the clone back on it. */
const fetchClone = async ({ repository, commit }: RealCorpus, clone: string, io: ScriptIo): Promise<void> => {
  const git = (...args: readonly string[]): ReturnType<typeof execProgram> =>
    execProgram("git", [...GIT, ...args], {
      cwd: clone,
      io,
      output: "capture",
      env: { ...io.env, GIT_LFS_SKIP_SMUDGE: "1" }
    });
  if (!existsSync(join(clone, ".git"))) {
    await mkdir(clone, { recursive: true });
    await git("init", "--quiet");
    await git("remote", "add", "origin", repository);
    await git("fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", commit);
  }
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
  io: ScriptIo
): Promise<void> => {
  if (program === undefined) return;
  await execProgram(program, args, {
    cwd: clone,
    io,
    output: "capture",
    env: { ...io.env, ...NO_DAEMONS, ...env }
  });
};

/** Installs the library's dependencies, once for a commit, and builds what its stories need. */
const installLibrary = async (corpus: RealCorpus, clone: string, io: ScriptIo): Promise<void> => {
  const stamp = join(clone, INSTALLED_STAMP);
  const done = existsSync(stamp) ? (await readFile(stamp, "utf8")).trim() : "";
  if (done === corpus.commit) return;
  await runCommand(corpus.install, clone, NO_SCRIPTS, io);
  for (const command of corpus.prepare ?? []) await runCommand(command, clone, {}, io);
  await writeFile(stamp, `${corpus.commit}\n`);
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
  await execProgram("npm", ["install", ...flags], { cwd: bench, io, output: "capture" });
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
};

/**
 * Puts a corpus on disk, ready to run.
 *
 * @param request - what to prepare.
 * @param io - the script's streams.
 */
export const prepareCorpus = async (
  { corpus, paths, packages, repository }: CorpusRequest,
  io: ScriptIo
): Promise<void> => {
  await fetchClone(corpus, paths.clone, io);
  await installLibrary(corpus, paths.clone, io);
  await installForgebook(paths, packages, repository, io);
};
