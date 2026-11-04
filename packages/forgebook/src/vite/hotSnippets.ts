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
import type { CloseWatch } from "./closeWatch.ts";
import { FILES_PREFIX } from "./pluginModules.ts";
import { type IndexedStoryFile, storyFileIndex, storyFilesGroupOf } from "./storyFilesModule.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** The id of a module a plugin makes, which names no file. */
const VIRTUAL_ID = /^\0/;

/**
 * What a story file runs to accept its edit: the frame that draws its stories cancels the event and draws them anew;
 * when none does, the files that import it take the edit (one that re-exports its stories draws them). The exports the
 * page drew are kept in the module's hot data, so the version after one that threw while it loaded is matched with
 * them, not with the version that failed.
 *
 * @param file - the story file's path, which it imports itself by.
 */
export const storyFileHot = (file: string): string =>
  [
    `import * as __forgebookShown from ${JSON.stringify(file)};`,
    "if (import.meta.hot) {",
    // what the page drew, kept across versions: one that threw while it loaded drew nothing
    "  import.meta.hot.data.forgebookShown ??= __forgebookShown;",
    "  import.meta.hot.accept((next) => {",
    "    if (next === undefined) return;",
    `    const event = new CustomEvent(${JSON.stringify(STORY_FILE_EVENT)}, {`,
    "      cancelable: true,",
    "      detail: { previous: import.meta.hot.data.forgebookShown, next }",
    "    });",
    "    if (window.dispatchEvent(event)) import.meta.hot.invalidate();",
    "    else import.meta.hot.data.forgebookShown = next;",
    "  });",
    "}"
  ].join(" ");

/**
 * A file's head: its leading comments and its directive prologue (`"use client";`), in any order. The directives must
 * stay its first statements, and the comments hold the pragmas a compiler reads only before the first statement
 * (`@jsxImportSource`, `@jsxRuntime`): after added code, a file written for another JSX runtime compiles for React's.
 */
const HEAD =
  /^(?:\s*(?:\/\/[^\n\r\u2028\u2029]*(?:\r\n|[\n\r\u2028\u2029]|$)|\/\*[\s\S]*?\*\/|(["'])use [^"']*\1;?))*/;

/** What ends a line, and so a line comment, in JavaScript. */
const LINE_END = /[\n\r\u2028\u2029]$/;

/**
 * A story file's code with its accepting code first: it runs before the file's own, so an edit that throws while the
 * file loads still leaves the next one accepted. After the file's head and on its last line, so no line of the file
 * moves and its source map stays true.
 *
 * @param code - the file's code, as the plugins before have made it.
 * @param id - the file's path.
 */
export const withStoryFileHot = (code: string, id: string): string => {
  const head = HEAD.exec(code)?.[0] ?? "";
  // a file that is all head may end in a line comment, which would take the code in: it goes on a line of its own
  let separator = " ";
  if (head === "" || LINE_END.test(head)) separator = "";
  else if (head.length === code.length) separator = "\n";
  return `${head}${separator}${storyFileHot(id)} ${code.slice(head.length)}`;
};

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

/** The patterns' modules a dev server served, with their story files indexed as it served them. */
export type ServedPatterns = {
  /**
   * Keeps a pattern's module as it was served.
   *
   * @param id - the module's id.
   * @param files - its story files, indexed.
   */
  readonly keep: (id: string, files: readonly IndexedStoryFile[]) => void;
  /**
   * The patterns' modules an edit of a story file changed (a story added or renamed, a title), which the open pages
   * read once: the file alone is indexed again, not the pattern's every file. One that cannot be read yet (an edit
   * half typed) changes nothing: its module shows the error, and the next edit is read again.
   *
   * @param file - the edited story file.
   */
  readonly changedBy: (file: string) => readonly string[];
};

/**
 * A story file's index as an edit left it; a message when it cannot be read (an editor writes it anew in place).
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern.
 * @param key - the file's path relative to the declaring module.
 */
const readIndex = (root: string, pattern: string, key: string): ReturnType<typeof storyFileIndex> => {
  try {
    return storyFileIndex(root, pattern, key);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** The patterns' modules a dev server serves, kept to tell an edit that changes a list. */
export const servedPatterns = (): ServedPatterns => {
  const served = new Map<string, ReadonlyMap<string, { readonly key: string; readonly index: string }>>();
  return {
    keep: (id: string, files: readonly IndexedStoryFile[]): void => {
      served.set(
        id,
        new Map(files.map((file) => [file.file, { key: file.key, index: JSON.stringify(file.index) }]))
      );
    },
    changedBy: (file: string): readonly string[] =>
      [...served]
        .filter(([id, files]) => {
          // in Vite's form, as the served files are kept: a Windows path reaches here either way
          const kept = files.get(VITE_PATHS.normalize(file));
          if (kept === undefined) return false;
          const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
          const index = readIndex(root, pattern, kept.key);
          return typeof index !== "string" && JSON.stringify(index) !== kept.index;
        })
        .map(([id]) => id)
  };
};

/**
 * The plugin's hooks for a story file's edit: the file accepts it on a dev server, and an edit that changes a pattern's
 * list (a story added, renamed, a title) reloads the pages, which read the list once. A story file a frame loads is
 * followed closely (`closeWatch.ts`), and the late report of an edit of any file the close watch handed on already is
 * dropped, so an edit is drawn once.
 *
 * @param isServing - whether a dev server runs whose framework draws an edited story file in place.
 * @param changedFilesModules - the patterns' modules the edit changed.
 * @param watching - the dev server's close watch.
 */
export const storyFileHotHooks = (
  isServing: () => boolean,
  changedFilesModules: (file: string) => readonly string[],
  watching: Pick<CloseWatch, "follow" | "isLateReport">
): Pick<Plugin, "transform" | "hotUpdate"> => ({
  transform: {
    // a pattern's module is named after its pattern, which may end like a story file
    filter: { id: { include: STORY_FILE, exclude: VIRTUAL_ID } },
    handler(code: string, id: string): { code: string; map: null } | undefined {
      if (!isServing() || this.environment.name !== "client") return undefined;
      watching.follow(id);
      return { code: withStoryFileHot(code, id), map: null };
    }
  },
  hotUpdate(options: HotUpdateOptions): EnvironmentModuleNode[] | undefined {
    // a file removed or added changes the lists another way (`modulesListing`)
    if (options.type !== "update") return undefined;
    // the system's late report of an edit the close watch handed on already
    if (watching.isLateReport(this.environment.name, options.file)) return [];
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
