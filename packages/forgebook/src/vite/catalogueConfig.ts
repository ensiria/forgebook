/**
 * What Forgebook's plugin sets in Vite's configuration for a catalogue: its folder as the root, what to pre-bundle, the
 * pages as the build's inputs, the build's script names, and the dev server's reads kept to each origin.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { UserConfig } from "vite";

import { packageResolver, type ResolvedConfig } from "./configFile.ts";
import { pageModulePath } from "./pages.ts";
import { prebundled, scannedEntries } from "./prebundled.ts";

/**
 * A file's text, or none when it cannot be read.
 *
 * @param file - the file.
 */
const readTextFile = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * Whether an app's configuration names its build's output itself, which the plugin then leaves as it is.
 *
 * @param userConfig - the configuration so far.
 */
const hasOwnOutput = (userConfig: UserConfig): boolean =>
  userConfig.build?.rolldownOptions?.output !== undefined ||
  userConfig.build?.rollupOptions?.output !== undefined;

/**
 * What the plugin sets in Vite's configuration for a catalogue: its folder as the root, what to pre-bundle, the pages
 * as the build's inputs, and the dev server's reads kept to each origin.
 *
 * @param config - the catalogue's configuration.
 * @param userConfig - the configuration so far, whose own `server.cors` and build output the plugin leaves alone.
 */
export const catalogueConfig = (config: ResolvedConfig, userConfig: UserConfig): UserConfig => ({
  root: config.dir,
  // the pages are generated, so Vite's scanner cannot find what they import: it is named here, and the
  // story files (the project's and the sources') are scanned for what their components import
  optimizeDeps: {
    include: prebundled(config, packageResolver(config.dir)),
    entries: scannedEntries(config, packageResolver(config.dir), readTextFile)
  },
  build: {
    rolldownOptions: {
      input: {
        index: pageModulePath(config.dir, "index.html"),
        frame: pageModulePath(config.dir, "frame.html")
      },
      // a catalogue names each story file's scripts once per loader: a name of its hash alone is a tenth of
      // what the index weighs, and a catalogue whose builds are read by name keeps Vite's (`readableNames`)
      ...(config.build.readableNames || hasOwnOutput(userConfig)
        ? {}
        : { output: { chunkFileNames: "assets/[hash].js", hashCharacters: "base36" } })
    }
  },
  // Vite lets any localhost page read the server: neither origin needs another's reads, and the guards
  // would be the only wall left between the frames and the catalogue (unless the app chose its own)
  ...(config.frames.kind === "isolated" && userConfig.server?.cors === undefined
    ? { server: { cors: false } }
    : {})
});
