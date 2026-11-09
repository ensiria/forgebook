/**
 * What Forgebook's plugin sets in Vite's configuration for a catalogue: its folder as the root, what to pre-bundle, the
 * pages as the build's inputs, the build's script names, no single-page fallback, and the dev server's reads kept to
 * each origin.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { UserConfig } from "vite";

import { packageResolver, type ResolvedConfig } from "./configFile.ts";
import { pageModulePath } from "./pages.ts";
import { prebundled, type ScanFindings, scannedEntries, scanOptions } from "./prebundled.ts";
import { refsDefine } from "./refsConfig.ts";

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
 * @param findings - where the dependency scan's warnings and problems go.
 */
export const catalogueConfig = (
  config: ResolvedConfig,
  userConfig: UserConfig,
  findings: Omit<ScanFindings, "root"> = {}
): UserConfig => ({
  root: config.dir,
  // a hoisted workspace can keep a package's React in its folder while the adapter, at the root, reads another copy, and
  // every component then fails with "invalid hook call": the catalogue's folder decides
  resolve: { dedupe: ["react", "react-dom"] },
  // a catalogue that composes no other has every part of composition removed from its shell (`shell/composition.ts`)
  define: refsDefine(config.refs),
  // the pages are generated, so Vite's scanner cannot find what they import: it is named here, and the
  // story files (the project's and the sources') are scanned for what their components import
  optimizeDeps: {
    include: prebundled(config, packageResolver(config.dir)),
    entries: scannedEntries(config, packageResolver(config.dir), readTextFile),
    rolldownOptions: scanOptions({
      root: config.dir,
      isJsxInScripts: config.framework.compilesJsxInScripts === true,
      ...findings
    })
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
  // the plugin serves the catalogue's pages itself, so the only page a single-page fallback could answer with is the
  // app's own `index.html`: a story's missing image would get it, and the server would load the whole app its scripts
  // reach, pre-bundle again what the stories never import, and reload every frame open (unless the app chose its own)
  ...(userConfig.appType === undefined ? { appType: "mpa" } : {}),
  // Vite lets any localhost page read the server: neither origin needs another's reads, and the guards
  // would be the only wall left between the frames and the catalogue (unless the app chose its own)
  ...(config.frames.kind === "isolated" && userConfig.server?.cors === undefined
    ? { server: { cors: false } }
    : {})
});
