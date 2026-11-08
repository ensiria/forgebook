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
 * `_temp_` folders are removed). Two commands' servers at once are kept apart the same way (`commandCacheClaim.ts`).
 *
 * @module
 */
import { join } from "node:path";

import type { InlineConfig, Plugin, UserConfig } from "vite";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { type CacheClaim, claimCommandCache } from "./commandCacheClaim.ts";
import { viteCacheDir } from "./viteCache.ts";

/** The folder, inside the catalogue's Vite cache folder, where the servers commands start keep their cache. */
export const COMMAND_CACHE_FOLDER = "forgebook-commands";

/**
 * Moves the server's cache into {@link COMMAND_CACHE_FOLDER} of the folder Vite would use, or into a folder of its own
 * beside it while another server holds that one (`commandCacheClaim.ts`): run after every other plugin, so a framework's
 * plugin that sets its own cache folder is followed too.
 *
 * @remarks
 * The folder is claimed once per plugin and given back when the last server using it closes. A server Vite restarts (an
 * `.env` file changed) is made anew with the same plugin before the old one closes: counting the servers keeps the
 * claim through the restart, where giving it back at the old server's close would take the folder from the new one.
 * `closeBundle` runs once per environment of a server; its client environment counts it.
 */
const commandCache = (): Plugin => {
  let claim: CacheClaim | undefined;
  let servers = 0;
  return {
    name: "forgebook:command-cache",
    config: {
      order: "post",
      handler: (current: UserConfig): UserConfig => {
        claim ??= claimCommandCache(join(viteCacheDir(current), COMMAND_CACHE_FOLDER));
        servers += 1;
        return { cacheDir: claim.folder };
      }
    },
    closeBundle(): void {
      if (this.environment.name !== "client" || claim === undefined) return;
      servers -= 1;
      if (servers > 0) return;
      claim.release();
      claim = undefined;
    }
  };
};

/** Whether this process started a server for a command. */
let hasStartedServer = false;

/**
 * Ends a command that started a server, once its answer is out: a plugin of the app's build may leave a watcher or a timer
 * behind, which would keep the process, and whoever waits for it, waiting for ever. A command that started none, or a dev
 * server, ends as it would.
 *
 * @param code - the code the command ended with.
 */
export const leaveAfterCommand = (code: number): void => {
  if (hasStartedServer) process.stdout.write("", () => process.exit(code));
};

/**
 * Sends what plugins log to stderr: a command's stdout is its answer (`--json`, the MCP protocol), and a plugin of the app's
 * build that says what it fetches would break it. Nothing of the commands' own goes through `console`.
 */
const keepPluginsOffStdout = (): void => {
  const { error } = console;
  Object.assign(console, { log: error, info: error, debug: error });
};

/**
 * Vite's configuration for a server a command starts: the catalogue's, with a cache of its own.
 *
 * @param config - the catalogue's configuration, read.
 * @param overrides - what the command sets (the port, middleware mode).
 */
export const commandServerVite = (config: ResolvedConfig, overrides: InlineConfig): Promise<InlineConfig> => {
  hasStartedServer = true;
  keepPluginsOffStdout();
  return catalogueVite(
    config,
    { ...overrides, plugins: [...(overrides.plugins ?? []), commandCache()] },
    "serve",
    true
  );
};
