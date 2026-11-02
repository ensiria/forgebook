/**
 * The Vite configuration the `forgebook` command runs a catalogue with: its folder as the root, Forgebook's plugin
 * with the configuration already read, and the framework's own plugins.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { InlineConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { forgebookPlugin } from "../../src/vite/forgebookPlugin.ts";

/**
 * Vite's cache folder for a root: beside the nearest `package.json`, as Vite places it.
 *
 * @param root - the root.
 */
export const viteCacheFolder = (root: string): string => {
  let folder = root;
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) return join(root, ".vite");
    folder = parent;
  }
  return join(folder, "node_modules", ".vite");
};

/**
 * The file a first start's pre-bundling writes the imports it could not resolve in, which the dev server leaves out
 * as the pre-bundling did (`prebundleRun.ts`).
 *
 * @param root - the catalogue's folder.
 */
export const unresolvedFile = (root: string): string =>
  join(viteCacheFolder(root), "forgebook", "unresolved.json");

/**
 * The imports a first start's pre-bundling could not resolve; none when it resolved them all.
 *
 * @param root - the catalogue's folder.
 */
const unresolvedImports = (root: string): string[] => {
  try {
    const value: unknown = JSON.parse(readFileSync(unresolvedFile(root), "utf8"));
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Vite's configuration for a catalogue.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, the output folder).
 */
export const catalogueVite = async (
  config: ResolvedConfig,
  overrides: InlineConfig
): Promise<InlineConfig> => {
  const unresolved = unresolvedImports(config.dir);
  return {
    ...overrides,
    ...(unresolved.length === 0
      ? {}
      : {
          optimizeDeps: {
            ...overrides.optimizeDeps,
            exclude: [...(overrides.optimizeDeps?.exclude ?? []), ...unresolved]
          }
        }),
    root: config.dir,
    // the configuration file is Forgebook's: a vite.config beside it is not read
    configFile: false,
    plugins: [forgebookPlugin({ config }), ...((await config.framework.vitePlugins?.()) ?? [])]
  };
};
