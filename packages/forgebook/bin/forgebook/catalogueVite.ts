/**
 * The Vite configuration the `forgebook` command runs a catalogue with: its folder as the root, Forgebook's plugin
 * with the configuration already read, and the framework's own plugins.
 *
 * @module
 */
import type { InlineConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { forgebookPlugin } from "../../src/vite/forgebookPlugin.ts";
import { catalogueCacheDir } from "./catalogueCache.ts";

/**
 * Vite's configuration for a catalogue.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, the output folder).
 */
export const catalogueVite = async (
  config: ResolvedConfig,
  overrides: InlineConfig
): Promise<InlineConfig> => ({
  ...overrides,
  root: config.dir,
  cacheDir: catalogueCacheDir(config.dir),
  // the configuration file is Forgebook's: a vite.config beside it is not read
  configFile: false,
  plugins: [forgebookPlugin({ config }), ...((await config.framework.vitePlugins?.()) ?? [])]
});
