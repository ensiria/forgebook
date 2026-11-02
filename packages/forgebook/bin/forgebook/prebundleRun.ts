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
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findConfigFile, type ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite, unresolvedFile, viteCacheFolder } from "./catalogueVite.ts";

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

/** A line of Vite's error about imports it cannot resolve: the name, then the file that imports it. */
const UNRESOLVED_LINE = /^\s+(\S+) \(imported by /gm;

/**
 * The imports Vite's error names as unresolved, when it is that error.
 *
 * @param error - what `optimizeDeps` threw.
 */
export const unresolvedOf = (error: unknown): string[] =>
  error instanceof Error
    ? [...error.message.matchAll(UNRESOLVED_LINE)].flatMap((match) => match[1] ?? [])
    : [];

/**
 * Pre-bundles a catalogue's dependencies in this process: the `prebundle` command, what the child runs.
 *
 * @remarks
 * Vite's `optimizeDeps` fails on an import it cannot resolve (Spectrum's stories import packages that are not
 * installed), where a dev server only warns and pre-bundles the rest. So a failure that names such imports is tried
 * once more with them left out (`unresolvedFile`), which is what the server would have done; any other failure leaves
 * the work to the server, as it always could.
 *
 * @param config - the catalogue's configuration, read.
 * @param isForced - whether to pre-bundle whatever is there.
 */
export const prebundle = async (config: ResolvedConfig, isForced: boolean | undefined): Promise<void> => {
  const { optimizeDeps, resolveConfig } = await import("vite");
  // read again on every first start: a package installed since is pre-bundled like any other
  const file = unresolvedFile(config.dir);
  rmSync(file, { force: true });
  try {
    await optimizeDeps(await resolveConfig(await catalogueVite(config, {}), "serve"), isForced);
  } catch (error) {
    const unresolved = unresolvedOf(error);
    if (unresolved.length === 0) throw error;
    // kept where the server's configuration reads it too: what is left out changes the pre-bundle's hash, and a server
    // whose hash differed would pre-bundle everything again itself
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(unresolved));
    await optimizeDeps(await resolveConfig(await catalogueVite(config, {}), "serve"), isForced);
  }
};
