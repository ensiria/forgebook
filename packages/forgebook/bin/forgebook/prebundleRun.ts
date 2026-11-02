/**
 * The dev server's first pre-bundling, in a process of its own.
 *
 * @remarks
 * Vite pre-bundles a catalogue's dependencies once. Rolldown's allocator keeps what it took, a hundred megabytes and
 * more that a process would hold for as long as the server runs, on top of what a first start needs for the docs. In a
 * child they go back when it ends, for a few tens of milliseconds on that one start: the child starts beside the
 * commands, which load Vite in the meantime anyway. Should the child fail, the server pre-bundles as it always could.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
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

/**
 * Pre-bundles a catalogue's dependencies in a child, unless they are there already.
 *
 * @param root - the catalogue's folder.
 * @param configFile - the `--config` given, when one was.
 * @param isForced - whether to pre-bundle whatever is there.
 * @returns a promise that settles when the child ended, however it ended.
 */
export const prebundleInChild = (
  root: string,
  configFile: string | undefined,
  isForced: boolean
): Promise<void> => {
  const script = process.argv[1];
  const isDone = existsSync(join(viteCacheFolder(root), "deps", "_metadata.json"));
  if (script === undefined || (isDone && !isForced)) return Promise.resolve();
  const args = [
    script,
    "prebundle",
    ...(configFile === undefined ? [] : ["--config", configFile]),
    ...(isForced ? ["--force"] : [])
  ];
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { stdio: "ignore" });
    child.once("error", () => done());
    child.once("exit", () => done());
  });
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
