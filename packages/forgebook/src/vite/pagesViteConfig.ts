/**
 * The Vite configuration a catalogue's pages need: their root and entries, what to pre-bundle before the first page,
 * the build's chunk names, and the dev server's CORS when the frames run on an origin of their own.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { UserConfig } from "vite";

import { packageResolver, type ResolvedConfig } from "./configFile.ts";
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
 * The Vite configuration a catalogue's pages need.
 *
 * @param config - the catalogue's configuration.
 * @param userConfig - the app's own Vite configuration.
 */
export const pagesViteConfig = (config: ResolvedConfig, userConfig: UserConfig): UserConfig => ({
  root: config.dir,
  // the pages are generated, so Vite's scanner cannot find what they import: it is named here, and the
  // story files (the project's and the sources') are scanned for what their components import
  optimizeDeps: {
    include: prebundled(config, packageResolver(config.dir)),
    entries: scannedEntries(config, packageResolver(config.dir), readTextFile)
  },
  build: {
    rolldownOptions: {
      input: { index: join(config.dir, "index.html"), frame: join(config.dir, "frame.html") },
      // a catalogue names each file several times over, once per loader: a name of its hash alone is a
      // tenth of what the index weighs; a catalogue whose builds are read by name keeps Vite's names
      ...(config.build.readableNames ? {} : { output: { chunkFileNames: "assets/[hash].js" } })
    }
  },
  // Vite lets any localhost page read the server: neither origin needs another's reads, and the guards
  // would be the only wall left between the frames and the catalogue (unless the app chose its own)
  ...(config.frames.kind === "isolated" && userConfig.server?.cors === undefined
    ? { server: { cors: false } }
    : {})
});
