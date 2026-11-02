/**
 * The dev server's first pre-bundling, in a process of its own.
 *
 * @remarks
 * Vite pre-bundles a catalogue's dependencies once. Rolldown's allocator keeps what it took, a hundred megabytes and
 * more that a process would hold for as long as the server runs, on top of what a first start needs for the docs. In a
 * child they go back when it ends, for a few tens of milliseconds on that one start: the child starts beside the
 * commands, which load Vite in the meantime anyway (`prebundleEarly`). Should the child fail, the server pre-bundles as
 * it always could.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findConfigFile, type ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";

/**
 * Vite's cache folder for a root: beside the nearest `package.json`, as Vite places it.
 *
 * @param root - the root.
 */
const viteCacheFolder = (root: string): string => {
  let folder = root;
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) return join(root, ".vite");
    folder = parent;
  }
  return join(folder, "node_modules", ".vite");
};

/** The child's entry, beside this module and with its extension. */
const CHILD_URL = new URL(`./prebundleChild${extname(import.meta.url)}`, import.meta.url);

/** What the child is started with, as JSON. */
export type PrebundleChildData = {
  /** The configuration file. */
  readonly configFile: string;
  /** Whether to pre-bundle whatever is there. */
  readonly isForced: boolean;
};

/** The pre-bundling started, by what it was started for: the command finds the one its entry started. */
let started: { readonly key: string; readonly done: Promise<void> } | undefined;

/**
 * Pre-bundles a catalogue's dependencies in a child, unless they are there already; a second call for the same
 * configuration waits for the first.
 *
 * @param configFile - the catalogue's configuration file.
 * @param isForced - whether to pre-bundle whatever is there.
 * @returns a promise that settles when the child ended, however it ended.
 */
export const prebundleInChild = (configFile: string, isForced: boolean): Promise<void> => {
  const key = JSON.stringify([configFile, isForced]);
  if (started?.key === key) return started.done;
  const isDone = existsSync(join(viteCacheFolder(dirname(configFile)), "deps", "_metadata.json"));
  if (isDone && !isForced) return Promise.resolve();
  const data: PrebundleChildData = { configFile, isForced };
  const done = new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(CHILD_URL), JSON.stringify(data)], {
      stdio: "ignore"
    });
    child.once("error", () => resolve());
    child.once("exit", () => resolve());
  });
  started = { key, done };
  return done;
};

/**
 * Starts the pre-bundling before the commands load, for `forgebook dev` run in the catalogue's folder: the child then
 * works while this process loads the commands, the configuration and Vite. Any other form (`--config`) is left to the
 * command, which starts it once it has read its options.
 *
 * @param args - the command line's arguments, read only for that one form.
 */
export const prebundleEarly = (args: readonly string[]): void => {
  if (args[0] !== "dev" || args.some((arg) => arg.startsWith("--config"))) return;
  const configFile = findConfigFile(process.cwd());
  if (configFile !== undefined) void prebundleInChild(configFile, args.includes("--force"));
};

/**
 * Pre-bundles a catalogue's dependencies in this process: the `prebundle` command, what the child runs.
 *
 * @param config - the catalogue's configuration, read.
 * @param isForced - whether to pre-bundle whatever is there.
 */
export const prebundle = async (config: ResolvedConfig, isForced: boolean | undefined): Promise<void> => {
  const { optimizeDeps, resolveConfig } = await import("vite");
  await optimizeDeps(await resolveConfig(await catalogueVite(config, {}), "serve"), isForced);
};
