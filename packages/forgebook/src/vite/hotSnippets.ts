/**
 * The code the dev server adds to a story file, to its docs, code and page modules and to a pattern's files module, so
 * an edit reaches the open pages without a reload (`hotModules.ts` reads what it sends), and the plugin's hooks that add
 * it to a story file and reload the pages for an edit that changes a pattern's list.
 *
 * @remarks
 * Each module imports itself, as React's Fast Refresh does, to hand the page what it gave before beside what its
 * successor gives: the page knows which value it drew, not which file it came from. Only the dev server adds them; a
 * build has no hot updates.
 *
 * @module
 */
import type { EnvironmentModuleNode, HotUpdateOptions, Plugin } from "vite";

import { RENEWED_MODULE_EVENT, STORY_FILE_EVENT } from "../hotModules.ts";
import { STORY_FILE } from "./autoTitle.ts";

/** The id of a module a plugin makes, which names no file. */
const VIRTUAL_ID = /^\0/;

/**
 * What a story file runs to accept its edit: the frame that draws its stories cancels the event and draws them anew;
 * when none does, the files that import it take the edit (one that re-exports its stories draws them).
 *
 * @param file - the story file's path, which it imports itself by.
 */
export const storyFileHot = (file: string): string =>
  [
    `import * as __forgebookShown from ${JSON.stringify(file)};`,
    "if (import.meta.hot) {",
    "  import.meta.hot.accept((next) => {",
    "    if (next === undefined) return;",
    `    const event = new CustomEvent(${JSON.stringify(STORY_FILE_EVENT)}, {`,
    "      cancelable: true,",
    "      detail: { previous: __forgebookShown, next }",
    "    });",
    "    if (window.dispatchEvent(event)) import.meta.hot.invalidate();",
    "  });",
    "}"
  ].join("\n");

/**
 * What a story file's docs, code or page module runs to hand its new default export to the shell that read the old one.
 *
 * @param id - the module's id, which it imports itself by.
 */
export const renewedModuleHot = (id: string): string =>
  [
    `import * as __forgebookRenewed from ${JSON.stringify(id)};`,
    "if (import.meta.hot) {",
    "  import.meta.hot.accept((next) => {",
    "    if (next === undefined) return;",
    `    window.dispatchEvent(new CustomEvent(${JSON.stringify(RENEWED_MODULE_EVENT)}, {`,
    "      detail: { previous: __forgebookRenewed.default, next: next.default }",
    "    }));",
    "  });",
    "}"
  ].join("\n");

/**
 * A module as a dev server serves it: a story file's docs, code or page module hands its edit to the shell.
 *
 * @param id - the module's id.
 * @param module - the module.
 * @param queries - the queries of the modules that hand their edits on.
 * @param isServing - whether a dev server serves it: a build has no hot updates.
 */
export const renewedModule = <TModule extends { readonly code: string }>(
  id: string,
  module: TModule,
  queries: readonly string[],
  isServing: boolean
): TModule =>
  isServing && queries.some((query) => id.endsWith(query))
    ? { ...module, code: `${module.code}\n${renewedModuleHot(id)}` }
    : module;

/**
 * What a pattern's files module runs: it takes the edits its story files hand on, which change nothing it holds. An
 * edit that changes its list reloads the pages from the server, and its pages keep the module they read.
 */
export const FILES_MODULE_HOT = "if (import.meta.hot) import.meta.hot.accept();";

/**
 * The plugin's hooks for a story file's edit: the file accepts it on a dev server, and an edit that changes a pattern's
 * list (a story added, renamed, a title) reloads the pages, which read the list once.
 *
 * @param isServing - whether a dev server runs.
 * @param changedFilesModules - the patterns' modules the edit changed.
 */
export const storyFileHotHooks = (
  isServing: () => boolean,
  changedFilesModules: (file: string) => readonly string[]
): Pick<Plugin, "transform" | "hotUpdate"> => ({
  transform: {
    // a pattern's module is named after its pattern, which may end like a story file
    filter: { id: { include: STORY_FILE, exclude: VIRTUAL_ID } },
    handler(code: string, id: string): { code: string; map: null } | undefined {
      if (!isServing() || this.environment.name !== "client") return undefined;
      return { code: `${code}\n${storyFileHot(id)}`, map: null };
    }
  },
  hotUpdate(options: HotUpdateOptions): EnvironmentModuleNode[] | undefined {
    if (this.environment.name !== "client" || !STORY_FILE.test(options.file)) return undefined;
    const changed = changedFilesModules(options.file);
    if (changed.length === 0) return undefined;
    const graph = this.environment.moduleGraph;
    for (const id of changed) {
      const module = graph.getModuleById(id);
      if (module !== undefined) graph.invalidateModule(module);
    }
    this.environment.hot.send({ type: "full-reload" });
    return [];
  }
});
