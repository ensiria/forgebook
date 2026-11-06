/**
 * Which package manager a project uses, and its commands: what `forgebook init` prints, and runs with `--install`.
 *
 * @remarks
 * The project's files decide, never who started the command: `npx` starts it in a pnpm project too. `packageManager` is
 * what Corepack obeys, so it comes before a lock file. A workspace package's lock file is at the workspace's root, so the
 * search goes up, but only a folder that declares a workspace counts: a stray lock file in a parent folder decides
 * nothing. It stops at the repository's root.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";
import type { PackageManagerName } from "./newProject.types.ts";

/** The lock files, in the order they are looked for in one folder. */
const LOCK_FILES: readonly (readonly [string, PackageManagerName])[] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"]
];

/** A project's package manager, with what says so. */
export type DetectedPackageManager = {
  /** Its name. */
  readonly name: PackageManagerName;
  /** The file that says so, from the project's folder; none when none does and npm was assumed. */
  readonly detectedFrom: string | undefined;
};

/** The manager a `packageManager` field names (`pnpm@10.19.0`), read from a `package.json`'s text. */
const managerField = (text: string): PackageManagerName | undefined => {
  const name = text.match(/"packageManager"\s*:\s*"(npm|pnpm|yarn|bun)@/)?.[1];
  return name === "npm" || name === "pnpm" || name === "yarn" || name === "bun" ? name : undefined;
};

/** A `package.json`'s text in a folder; empty when it has none. */
const manifestText = (dir: string): string => {
  const manifest = join(dir, "package.json");
  return existsSync(manifest) ? readFileSync(manifest, "utf8") : "";
};

/** Whether a folder declares a workspace. */
const isWorkspace = (dir: string): boolean =>
  existsSync(join(dir, "pnpm-workspace.yaml")) || /"workspaces"\s*:/.test(manifestText(dir));

/** What one folder says of its manager, in the order of trust, with the file that says so. */
const managerIn = (dir: string): readonly [PackageManagerName, string] | undefined => {
  const field = managerField(manifestText(dir));
  if (field !== undefined) return [field, "package.json"];
  for (const [file, name] of LOCK_FILES) if (existsSync(join(dir, file))) return [name, file];
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return ["pnpm", "pnpm-workspace.yaml"];
  return existsSync(join(dir, ".yarnrc.yml")) ? ["yarn", ".yarnrc.yml"] : undefined;
};

/**
 * The package manager of a project.
 *
 * @param projectDir - the project's folder, absolute.
 * @returns the one its files name; npm when none does.
 */
export const detectPackageManager = (projectDir: string): DetectedPackageManager => {
  let dir = projectDir;
  while (true) {
    const found = dir === projectDir || isWorkspace(dir) ? managerIn(dir) : undefined;
    if (found !== undefined)
      return {
        name: found[0],
        detectedFrom: VITE_PATHS.normalize(relative(projectDir, join(dir, found[1])))
      };
    const parent = dirname(dir);
    if (parent === dir || existsSync(join(dir, ".git"))) return { name: "npm", detectedFrom: undefined };
    dir = parent;
  }
};

/**
 * What a package manager must be told to add a package at a workspace's root: pnpm and Yarn 1 stop otherwise. Yarn 2 and
 * later have no such flag, and keep a `.yarnrc.yml`.
 *
 * @param name - the package manager.
 * @param dir - the folder the command runs in.
 */
export const workspaceRootFlags = (name: PackageManagerName, dir: string): readonly string[] => {
  if (!isWorkspace(dir)) return [];
  if (name === "pnpm") return ["--workspace-root"];
  const isClassicYarn =
    name === "yarn" &&
    !existsSync(join(dir, ".yarnrc.yml")) &&
    !/"packageManager"\s*:\s*"yarn@[2-9]/.test(manifestText(dir));
  return isClassicYarn ? ["-W"] : [];
};

/**
 * The arguments that add packages for development, or install what is declared when there are none to add.
 *
 * @param name - the package manager.
 * @param packages - the packages to add.
 * @param rootFlags - what it must be told at a workspace's root (`workspaceRootFlags`).
 */
export const installArguments = (
  name: PackageManagerName,
  packages: readonly string[],
  rootFlags: readonly string[]
): readonly string[] => {
  if (packages.length === 0) return ["install"];
  if (name === "npm") return ["install", "--save-dev", ...packages];
  return ["add", name === "pnpm" ? "--save-dev" : "--dev", ...rootFlags, ...packages];
};

/**
 * How a project's package manager runs the `forgebook` it installed.
 *
 * @param name - the package manager.
 */
export const forgebookRunner = (name: PackageManagerName): string =>
  ({ npm: "npx forgebook", pnpm: "pnpm exec forgebook", yarn: "yarn forgebook", bun: "bunx forgebook" })[
    name
  ];

/**
 * A package manager's command as a process starts it: on Windows it is a `.cmd`, which only a shell starts. The shell is
 * named by its full path, and told not to look in the current folder first, or a project's own `npm.cmd` would run.
 *
 * @param name - the package manager.
 * @param args - its arguments: names from Forgebook's own tables, so nothing a shell would read.
 * @param env - the environment it runs in.
 * @param platform - the system; the running one unless a test names another.
 */
export const spawnedCommand = (
  name: PackageManagerName,
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform
): {
  readonly program: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
} =>
  platform === "win32"
    ? {
        program: env["ComSpec"] ?? "cmd.exe",
        args: ["/d", "/s", "/c", name, ...args],
        env: { ...env, NoDefaultCurrentDirectoryInExePath: "1" }
      }
    : { program: name, args, env };
