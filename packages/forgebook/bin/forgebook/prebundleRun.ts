/**
 * A catalogue's dependencies pre-bundled as `forgebook dev` would on a first start: what the pre-bundling child runs
 * (`prebundleChild.ts`), and `forgebook prebundle`.
 *
 * @module
 */
import { rmSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { keepUnresolved, unresolvedFile, unresolvedImports } from "./viteCache.ts";

/** A line of Vite's error about imports it cannot resolve: the name, then the file that imports it. */
const UNRESOLVED_LINE = /^\s+(\S+) \(imported by /gm;

/**
 * The imports Vite's error names as unresolved, when it is that error; its colours, which Vite adds on Windows and in
 * CI, taken out first.
 *
 * @param error - what `optimizeDeps` threw.
 */
export const unresolvedOf = (error: unknown): string[] =>
  error instanceof Error
    ? [...stripVTControlCharacters(error.message).matchAll(UNRESOLVED_LINE)].flatMap(
        (match) => match[1] ?? []
      )
    : [];

/**
 * Pre-bundles a catalogue's dependencies in this process.
 *
 * @remarks
 * Vite's `optimizeDeps` fails on an import it cannot resolve (stories that import a package not installed), where a
 * dev server only warns and pre-bundles the rest. So a failure that names such imports is tried once more with them
 * left out too, kept in a file every later server of the catalogue reads (`unresolvedFile`), which is what the server
 * would have done; any other failure is thrown, and the server does the work, as it always could. What an earlier
 * pre-bundling left out stays out unless it is forced: it is part of the pre-bundle's hash.
 *
 * @param config - the catalogue's configuration, read.
 * @param isForced - whether to pre-bundle whatever is there, finding again what does not resolve.
 */
export const prebundle = async (config: ResolvedConfig, isForced: boolean): Promise<void> => {
  const { optimizeDeps, resolveConfig } = await import("vite");
  if (isForced) rmSync(unresolvedFile(config.dir), { force: true });
  try {
    await optimizeDeps(await resolveConfig(await catalogueVite(config, {}), "serve"), isForced);
  } catch (error) {
    const unresolved = unresolvedOf(error);
    if (unresolved.length === 0) throw error;
    keepUnresolved(config.dir, [...new Set([...unresolvedImports(config.dir), ...unresolved])]);
    await optimizeDeps(await resolveConfig(await catalogueVite(config, {}), "serve"), isForced);
  }
};
