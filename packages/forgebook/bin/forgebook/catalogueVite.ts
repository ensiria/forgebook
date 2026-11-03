/**
 * The Vite configuration the `forgebook` command runs a catalogue with: its folder as the root, Forgebook's plugin
 * with the configuration already read, and the framework's own plugins; and the frames' port the command line gives.
 *
 * @module
 */
import { ScriptError } from "@ensiria/cli-kit/script";
import type { InlineConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { forgebookPlugin } from "../../src/vite/forgebookPlugin.ts";

/**
 * Vite's configuration for a catalogue.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, the output folder); its plugins run after the catalogue's.
 */
export const catalogueVite = async (
  config: ResolvedConfig,
  overrides: InlineConfig
): Promise<InlineConfig> => ({
  ...overrides,
  root: config.dir,
  // the configuration file is Forgebook's: a vite.config beside it is not read
  configFile: false,
  plugins: [
    forgebookPlugin({ config }),
    ...((await config.framework.vitePlugins?.()) ?? []),
    ...(overrides.plugins ?? [])
  ]
});

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
