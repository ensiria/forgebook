/**
 * The Vite configuration the `forgebook` command runs a catalogue with: its folder as the root, Forgebook's plugin
 * with the configuration already read, and the framework's own plugins; and where the command line puts the frames.
 *
 * @module
 */
import { ScriptError } from "@ensiria/cli-kit/script";
import type { InlineConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { forgebookPlugin } from "../../src/vite/forgebookPlugin.ts";
import { ISOLATED_FRAMES } from "../../src/vite/framesConfig.ts";
import { unresolvedImports } from "./viteCache.ts";

/**
 * Vite's configuration for a catalogue.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, the output folder); its plugins run after the catalogue's.
 */
export const catalogueVite = async (
  config: ResolvedConfig,
  overrides: InlineConfig
): Promise<InlineConfig> => {
  // what a first start's pre-bundling left out, left out here too: it is part of the pre-bundle's hash, and a server
  // whose hash differed would pre-bundle everything again itself
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
    plugins: [
      forgebookPlugin({ config }),
      ...((await config.framework.vitePlugins?.()) ?? []),
      ...(overrides.plugins ?? [])
    ]
  };
};

/**
 * The configuration with the frames' port the command line gives (`--frame-port`), over the file's.
 *
 * @param config - the configuration.
 * @param framePort - the option's value; none when not given.
 * @throws a `ScriptError` when it is not a port, or the frames run on the catalogue's origin.
 */
export const withFramePort = (config: ResolvedConfig, framePort: string | undefined): ResolvedConfig => {
  if (framePort === undefined) return config;
  const port = /^\d+$/.test(framePort) ? Number(framePort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ScriptError(`--frame-port ${framePort} is not a port`);
  if (config.frames.kind === "same-origin")
    throw new ScriptError("--frame-port asks for a port the frames do not use", {
      hint: 'They run on the catalogue\'s origin (frames: "same-origin", or --frames same-origin)'
    });
  return { ...config, frames: { ...config.frames, port } };
};

/** Where the command line can put the stories' frames, as `--frames` names it. */
export const FRAMES_MODES = ["isolated", "same-origin"] as const;

/** A placement `--frames` names. */
export type FramesMode = (typeof FRAMES_MODES)[number];

/**
 * The configuration with the frames where the command line puts them (`--frames`), over the file's: on the catalogue's
 * origin for one run behind a setup that forwards one port, or on their own for a catalogue whose file keeps them on
 * the catalogue's; and to compare the two placements without editing the file.
 *
 * @param config - the configuration.
 * @param mode - the option's value; none when not given.
 */
export const withFramesMode = (config: ResolvedConfig, mode: FramesMode | undefined): ResolvedConfig => {
  if (mode === undefined || mode === config.frames.kind) return config;
  return { ...config, frames: mode === "same-origin" ? { kind: "same-origin" } : ISOLATED_FRAMES };
};

/**
 * The configuration with the build's scripts named after their modules when the command line asks
 * (`--readable-names`), over the file's.
 *
 * @param config - the configuration.
 * @param isAsked - the option's value; none when not given.
 */
export const withReadableNames = (config: ResolvedConfig, isAsked: boolean | undefined): ResolvedConfig =>
  isAsked === true ? { ...config, build: { ...config.build, readableNames: true } } : config;
