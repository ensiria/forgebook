/**
 * Prepares what is measured: the packed Forgebook, each tool's clean install, and the generated project.
 *
 * @remarks
 * Forgebook is measured as packed and installed, never from the workspace: there its packages are sources served
 * module by module, which is not the program users run. Each target is installed with npm, as the README tells people
 * to, with the versions its folder pins. Everything lands in a work folder outside the repository, so nothing the
 * repository installs can resolve in its place and hide a dependency missing from a package.
 *
 * @module
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { ToolName } from "./bench.types.ts";
import { type Corpus, projectFiles } from "./corpus.ts";
import { diskUsage } from "./diskUsage.ts";
import { execProgram, TIME_LIMITS } from "./programs.ts";
import type { Target } from "./targets.ts";

/** Forgebook's packages a catalogue installs. */
const FORGEBOOK_PACKAGES = ["story-format", "forgebook", "react"] as const;

/** A target's installed state. */
export type InstallResult = {
  /** The size of `node_modules` on disk, in bytes. */
  readonly size: number;
  /** How many packages. */
  readonly packages: number;
};

/** Where the benchmark works. */
export type BenchFolders = {
  /** The repository's root. */
  readonly repository: string;
  /** The work folder, outside it. */
  readonly work: string;
};

/**
 * Builds and packs the Forgebook of this checkout.
 *
 * @param folders - where to work.
 * @param io - the script's streams.
 * @returns the tarball of each package, by name.
 */
export const packForgebook = async (
  { repository, work }: BenchFolders,
  io: ScriptIo
): Promise<Readonly<Record<string, string>>> => {
  const packs = join(work, "packs");
  await rm(packs, { recursive: true, force: true });
  await mkdir(packs, { recursive: true });
  await execProgram("pnpm", ["build"], {
    cwd: repository,
    io,
    output: "capture",
    timeoutMs: TIME_LIMITS.pack
  });
  for (const name of FORGEBOOK_PACKAGES) {
    await execProgram("pnpm", ["pack", "--pack-destination", packs], {
      cwd: join(repository, "packages", name),
      io,
      output: "capture",
      timeoutMs: TIME_LIMITS.pack
    });
  }
  const files = await readdir(packs);
  const tarball = (prefix: string): string => {
    const file = files.find((each) => new RegExp(`^${prefix}-\\d`).test(each));
    if (file === undefined) throw new Error(`no tarball for ${prefix}`);
    return `file:${join(packs, file)}`;
  };
  return {
    forgebook: tarball("forgebook"),
    "@forgebook/react": tarball("forgebook-react"),
    "@forgebook/story-format": tarball("forgebook-story-format")
  };
};

/**
 * The published packages of a version, for measuring a release instead of this checkout.
 *
 * @param version - the release (`0.1.8`).
 */
export const publishedForgebook = (version: string): Readonly<Record<string, string>> => ({
  forgebook: version,
  "@forgebook/react": version
});

/**
 * A clean install of a target.
 *
 * @param source - the target's folder in the repository.
 * @param directory - where to install.
 * @param packages - packages to add to its manifest, Forgebook's; none keeps its lockfile.
 * @param io - the script's streams.
 */
export const installTarget = async (
  source: string,
  directory: string,
  packages: Readonly<Record<string, string>> | undefined,
  io: ScriptIo
): Promise<InstallResult> => {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await cp(source, directory, { recursive: true });
  const flags = ["--no-audit", "--no-fund", "--loglevel=error"];
  if (packages === undefined) {
    await execProgram("npm", ["ci", ...flags], {
      cwd: directory,
      io,
      output: "capture",
      timeoutMs: TIME_LIMITS.install
    });
  } else {
    const manifest: unknown = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    if (typeof manifest !== "object" || manifest === null)
      throw new Error("the target's manifest is no object");
    const story = packages["@forgebook/story-format"];
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        ...manifest,
        dependencies: {
          ...("dependencies" in manifest && typeof manifest.dependencies === "object"
            ? manifest.dependencies
            : {}),
          ...packages
        },
        // the tarball of this checkout, not the published version the packed core asks for
        ...(story === undefined ? {} : { overrides: { "@forgebook/story-format": story } })
      })
    );
    await execProgram("npm", ["install", ...flags], {
      cwd: directory,
      io,
      output: "capture",
      timeoutMs: TIME_LIMITS.install
    });
  }
  const { stdout } = await execProgram("npm", ["ls", "--all", "--parseable"], {
    cwd: directory,
    io,
    output: "capture",
    check: false,
    timeoutMs: TIME_LIMITS.query
  });
  return {
    size: await diskUsage(join(directory, "node_modules")),
    packages: stdout.trim().split("\n").length - 1
  };
};

/** What `installOnBare` needs besides the folders. */
export type OnBareOptions = {
  /** Packages to add, Forgebook's. */
  readonly packages: Readonly<Record<string, string>> | undefined;
  /** The bare project's size, in bytes. */
  readonly bareSize: number;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** A package manifest's dependencies. */
const dependenciesOf = (manifest: unknown): Readonly<Record<string, unknown>> => {
  if (typeof manifest !== "object" || manifest === null || !("dependencies" in manifest)) return {};
  const { dependencies } = manifest;
  return typeof dependencies === "object" && dependencies !== null ? { ...dependencies } : {};
};

/**
 * What a tool adds to a project that already has Vite and React: installed there, not subtracted, since a tool with
 * its own Vite keeps both.
 *
 * @param source - the tool's folder in the repository.
 * @param bare - the bare project's folder in the repository.
 * @param directory - where to install; removed afterwards.
 * @param options - what else it needs.
 * @returns the bytes added. The bare project's part stays locked; the tool's own additions float, as a user's would.
 */
export const installOnBare = async (
  source: string,
  bare: string,
  directory: string,
  { packages, bareSize, io }: OnBareOptions
): Promise<number> => {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await cp(join(bare, "package-lock.json"), join(directory, "package-lock.json"));
  const read = async (folder: string): Promise<unknown> =>
    JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
  const story = packages?.["@forgebook/story-format"];
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: "bench-on-bare",
      private: true,
      dependencies: {
        ...dependenciesOf(await read(bare)),
        ...dependenciesOf(await read(source)),
        ...packages
      },
      ...(story === undefined ? {} : { overrides: { "@forgebook/story-format": story } })
    })
  );
  await execProgram("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
    cwd: directory,
    io,
    output: "capture",
    timeoutMs: TIME_LIMITS.install
  });
  const size = await diskUsage(join(directory, "node_modules"));
  await rm(directory, { recursive: true, force: true });
  return size - bareSize;
};

/**
 * Writes the generated project and the tool's configuration into an installed target.
 *
 * @param target - the tool.
 * @param corpus - the library.
 * @param directory - the target's folder.
 */
export const writeProject = async (target: Target, corpus: Corpus, directory: string): Promise<void> => {
  await rm(join(directory, "src"), { recursive: true, force: true });
  const files = { ...projectFiles(corpus, target.form), ...target.configFiles };
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      const file = join(directory, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    })
  );
};

/**
 * The version of an installed package.
 *
 * @param directory - the target's folder.
 * @param name - the package.
 */
export const installedVersion = async (directory: string, name: string): Promise<string> => {
  const manifest: unknown = JSON.parse(
    await readFile(join(directory, "node_modules", name, "package.json"), "utf8")
  );
  if (typeof manifest === "object" && manifest !== null && "version" in manifest)
    return String(manifest.version);
  return "unknown";
};

/**
 * How many dependencies an installed package declares.
 *
 * @param directory - the target's folder.
 * @param name - the package.
 */
export const directDependencies = async (directory: string, name: string): Promise<number> => {
  const manifest: unknown = JSON.parse(
    await readFile(join(directory, "node_modules", name, "package.json"), "utf8")
  );
  if (typeof manifest !== "object" || manifest === null || !("dependencies" in manifest)) return 0;
  return typeof manifest.dependencies === "object" && manifest.dependencies !== null
    ? Object.keys(manifest.dependencies).length
    : 0;
};

/** The folder a tool's manifest lives in, from the repository's root. */
export const targetSource = (repository: string, name: ToolName | "bare"): string =>
  join(repository, "tools/bench/targets", name);
