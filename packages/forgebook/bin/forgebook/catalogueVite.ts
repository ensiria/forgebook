/**
 * The Vite configuration the `forgebook` command runs a catalogue with: its folder as the root, Forgebook's plugin
 * with the configuration already read, and the framework's own plugins; and the frames' port the command line gives.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ScriptError } from "@ensiria/cli-kit/script";
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

/**
 * The configuration with the frames' port the command line gives (`--frame-port`), over the file's.
 *
 * @param config - the configuration.
 * @param framePort - the option's value; none when not given.
 * @throws a `ScriptError` when it is not a port, or the configuration keeps the frames on the catalogue's origin.
 */
export const withFramePort = (config: ResolvedConfig, framePort: string | undefined): ResolvedConfig => {
  if (framePort === undefined) return config;
  const port = /^\d+$/.test(framePort) ? Number(framePort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ScriptError(`--frame-port ${framePort} is not a port`);
  if (config.frames.kind === "same-origin")
    throw new ScriptError("--frame-port asks for a port the frames do not use", {
      hint: 'The configuration keeps them on the catalogue\'s origin (frames: "same-origin")'
    });
  return { ...config, frames: { ...config.frames, port } };
};

/**
 * The configuration with the frames on the catalogue's origin when the command line asks for it
 * (`--same-origin-frames`), over the file's: for a setup that forwards one port only, or to compare the two.
 *
 * @param config - the configuration.
 * @param isSameOrigin - whether the option was given.
 */
export const withSameOriginFrames = (config: ResolvedConfig, isSameOrigin: boolean): ResolvedConfig =>
  isSameOrigin ? { ...config, frames: { kind: "same-origin" } } : config;
