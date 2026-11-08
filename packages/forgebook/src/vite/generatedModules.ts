/**
 * The modules the plugin generates for a catalogue's pages: the shell's and the frame's entries, the project's own
 * stories' source, the agents' sources, the galleries' previews and the pages' HTML, and the ids imports name them by.
 *
 * @remarks
 * The configuration's data is not among them: it waits for the frames' placement, which only the plugin knows.
 *
 * @module
 */
import { existsSync } from "node:fs";

import type { ConfigEnv } from "vite";

import { checksA11y } from "../catalogue.ts";
import { axeAddress } from "./axeScript.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { builtPlacement } from "./framesConfig.ts";
import {
  agentSourcesModule,
  frameEntry,
  PAGE_ENTRIES,
  PAGE_FILES,
  pageHtml,
  pageModuleOf,
  pageModulePath,
  SWITCH_PREVIEWS_MODULE,
  shellEntry,
  storiesSourceModule,
  switchPreviewsModule
} from "./pages.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** The core's folder, where axe's script is found from. */
const PACKAGE_DIR: string = import.meta.dirname;

/**
 * A module the plugin generates for a catalogue's pages, when the id names one: an entry, the project's own stories'
 * source, or a page's HTML (unless the folder has one of its own). The configuration's data waits for the frames'
 * placement, so the plugin's `load` makes it.
 *
 * @param id - the module's id.
 * @param config - the catalogue's configuration.
 * @param command - whether a dev server runs, or a build: where the frame finds axe's script.
 */
export const generatedModule = (
  id: string,
  config: ResolvedConfig,
  command: ConfigEnv["command"]
): { code: string; moduleType: "js" } | string | undefined => {
  if (id === `\0${SWITCH_PREVIEWS_MODULE}`) return { code: switchPreviewsModule(config), moduleType: "js" };
  const named = pageModuleOf(id, config.dir);
  if (named === undefined) return undefined;
  if (named.kind === "entry") {
    const code =
      named.page === "index.html"
        ? shellEntry(config)
        : frameEntry(config, checksA11y(config.lists) ? axeAddress(command, PACKAGE_DIR) : undefined);
    return { code, moduleType: "js" };
  }
  if (named.kind === "stories-source") return { code: storiesSourceModule(config), moduleType: "js" };
  if (named.kind === "agent-sources") return { code: agentSourcesModule(config), moduleType: "js" };
  return existsSync(id) ? undefined : pageHtml(named.page, config, builtPlacement(config.frames));
};

/**
 * The id of a module the plugin generates for a catalogue's pages, when an import names one: a page or an entry by
 * its address (`/index.html`, `/.forgebook-shell.ts`) or by its path, a source by its path.
 *
 * @param source - the import's specifier.
 * @param dir - the configuration's folder.
 */
export const generatedId = (source: string, dir: string): string | undefined => {
  const byAddress = PAGE_FILES.find((page) => source === `/${PAGE_ENTRIES[page]}`);
  if (byAddress !== undefined) return pageModulePath(dir, PAGE_ENTRIES[byAddress]);
  const pageByAddress = PAGE_FILES.find((page) => source === `/${page}`);
  if (pageByAddress !== undefined) return pageModulePath(dir, pageByAddress);
  return pageModuleOf(source, dir) === undefined ? undefined : VITE_PATHS.normalize(source);
};
