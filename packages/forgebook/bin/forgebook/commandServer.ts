/**
 * The Vite configuration of a dev server a command starts for itself (`forgebook stories`, `story`, `mcp`, the story
 * checks), beside the `forgebook dev` the user may be running in the same folder.
 *
 * @remarks
 * Two Vite servers on one cache folder rewrite each other's pre-bundled dependencies: each one's optimizer replaces the
 * whole `deps` folder when it commits, and a `--force` start deletes it, so the other server's frames ask for files
 * that are gone or of another bundle and fail as outdated. A command's server therefore keeps its cache in a folder of
 * its own inside the one the dev server uses: still warm from one command to the next, never the dev server's, and
 * outside its watcher (Vite ignores everything under its cache folder) and its cleanup (only the `deps` folder and
 * `_temp_` folders are removed).
 *
 * @module
 */
import { join } from "node:path";

import type { InlineConfig, Plugin, UserConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { viteCacheDir } from "./viteCache.ts";

/** The folder, inside the catalogue's Vite cache folder, where the servers commands start keep their cache. */
export const COMMAND_CACHE_FOLDER = "forgebook-commands";

/**
 * Moves the server's cache into {@link COMMAND_CACHE_FOLDER} of the folder Vite would use: run after every other
 * plugin, so a framework's plugin that sets its own cache folder is followed too.
 */
const commandCache = (): Plugin => ({
  name: "forgebook:command-cache",
  config: {
    order: "post",
    handler: (current: UserConfig): UserConfig => ({
      cacheDir: join(viteCacheDir(current), COMMAND_CACHE_FOLDER)
    })
  }
});

/**
 * Vite's configuration for a server a command starts: the catalogue's, with a cache of its own.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, middleware mode).
 */
export const commandServerVite = (config: ResolvedConfig, overrides: InlineConfig): Promise<InlineConfig> =>
  catalogueVite(config, { ...overrides, plugins: [...(overrides.plugins ?? []), commandCache()] });
