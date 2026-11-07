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
import type { DevEnvironment, EnvironmentModuleNode, HotUpdateOptions, Plugin } from "vite";

import { codeLiteral } from "../codeLiteral.ts";
import {
  RENEWED_MODULE_EVENT,
  STORY_FILE_EVENT,
  STORY_FILE_READ_EVENT,
  type StoryFileRead
} from "../hotModules.ts";
import { STORY_FILE } from "./autoTitle.ts";
import type { CloseWatch } from "./closeWatch.ts";
import { FILES_PREFIX } from "./pluginModules.ts";
import type { ScriptProblems } from "./scriptProblems.ts";
import {
  type RefusedStoryFile,
  type StoryFilesRead,
  storyFileIndex,
  storyFilesGroupOf
} from "./storyFilesModule.ts";
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
    `import * as __forgebookShown from ${codeLiteral(file)};`,
    "if (import.meta.hot) {",
    // what the page drew, kept across versions: one that threw while it loaded drew nothing
    "  import.meta.hot.data.forgebookShown ??= __forgebookShown;",
    "  import.meta.hot.accept((next) => {",
    "    if (next === undefined) return;",
    `    const event = new CustomEvent(${codeLiteral(STORY_FILE_EVENT)}, {`,
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
    `import * as __forgebookRenewed from ${codeLiteral(id)};`,
    "if (import.meta.hot) {",
    "  import.meta.hot.accept((next) => {",
    "    if (next === undefined) return;",
    `    window.dispatchEvent(new CustomEvent(${codeLiteral(RENEWED_MODULE_EVENT)}, {`,
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
 * What a pattern's files module runs: it takes the edits its story files hand on, which change nothing it holds, as
 * an edit that changes its list reloads the pages from the server. What an edit says of a file that cannot be read
 * goes on to the page, unless it is the fix of a file the page was served without: it has no story to redraw, so it
 * reloads to list them. Those files are kept in the module's hot data, so a version served after the page's first does not count.
 *
 * @param refused - the story files the module was served without.
 */
export const filesModuleHot = (refused: readonly RefusedStoryFile[]): string =>
  [
    "if (import.meta.hot) {",
    "  import.meta.hot.accept();",
    `  import.meta.hot.data.forgebookRefused ??= ${codeLiteral(refused.map(({ file }) => file))};`,
    `  import.meta.hot.on(${codeLiteral(STORY_FILE_READ_EVENT)}, (read) => {`,
    "    if (read.problem === undefined && import.meta.hot.data.forgebookRefused.includes(read.file)) window.location.reload();",
    `    else window.dispatchEvent(new CustomEvent(${codeLiteral(STORY_FILE_READ_EVENT)}, { detail: read }));`,
    "  });",
    "}"
  ].join("\n");

/** What an edit of a story file changed. */
export type StoryFileEdit = {
  /** The patterns' modules it changed (a story added or renamed, a title), which the open pages read once. */
  readonly changed: readonly string[];
  /** The patterns' modules that say the file can or cannot be read, which a page opened from now on must read anew. */
  readonly renewed: readonly string[];
  /** Whether the file can be read, when that changed. */
  readonly read?: StoryFileRead;
};

/** The patterns' modules a dev server served, with their story files indexed as it served them. */
export type ServedPatterns = {
  /**
   * Keeps a pattern's module as it was served.
   *
   * @param id - the module's id.
   * @param read - its story files.
   */
  readonly keep: (id: string, read: StoryFilesRead) => void;
  /**
   * What an edit of a story file changed; the file alone is indexed again, not the pattern's every file. An edit that
   * leaves it unreadable (half typed) changes no list, so the frame that draws it keeps its story and draws the fix in
   * place, whose index is then compared with the last one that could be read.
   *
   * @param file - the edited story file.
   */
  readonly edited: (file: string) => StoryFileEdit;
  /**
   * The patterns' modules that list a story file.
   *
   * @param file - the story file.
   */
  readonly listing: (file: string) => readonly string[];
};

/** A story file as a dev server last knows it. */
type ServedFile = {
  /** Its path relative to the declaring module. */
  readonly key: string;
  /** The pattern that lists it. */
  readonly pattern: string;
  /** Its index when last read, as text; none when it never could be. */
  readonly index: string | undefined;
  /** Why it cannot be read, as the last edit left it; none when it can. */
  readonly problem: string | undefined;
};

/**
 * A story file's index as an edit left it, or why it cannot be read; none when its text cannot be had (an editor writes
 * it anew in place), which says nothing yet.
 *
 * @param root - the declaring module's folder.
 * @param served - the file.
 */
const readIndex = (root: string, served: ServedFile): ReturnType<typeof storyFileIndex> | undefined => {
  try {
    return storyFileIndex(root, served.pattern, served.key);
  } catch {
    return undefined;
  }
};

/**
 * What a pattern's module keeps of its story files: as read now, a problem known before staying until an edit changes it
 * (`edited` tells the pages), and a file that cannot be read keeping the index of its last good read.
 *
 * @param read - the story files.
 * @param before - the files as last known.
 */
const servedFiles = (
  { files, refused }: StoryFilesRead,
  before: ReadonlyMap<string, ServedFile> | undefined
): Map<string, ServedFile> => {
  const served = new Map<string, ServedFile>();
  for (const { key, pattern, file, index } of files) {
    const problem = before?.get(file)?.problem;
    served.set(file, { key, pattern, index: JSON.stringify(index), problem });
  }
  for (const { key, pattern, file, problem } of refused) {
    const known = before?.get(file);
    served.set(file, {
      key,
      pattern,
      index: known?.index,
      problem: known === undefined ? problem : known.problem
    });
  }
  return served;
};

/**
 * What an edit of a story file changed in one pattern's module, noted in what the module keeps.
 *
 * @param id - the module's id.
 * @param files - what it keeps.
 * @param file - the edited file, in Vite's form.
 */
const editedIn = (
  id: string,
  files: Map<string, ServedFile>,
  file: string
): { readonly isChanged: boolean; readonly read?: StoryFileRead } => {
  const kept = files.get(file);
  if (kept === undefined) return { isChanged: false };
  const index = readIndex(storyFilesGroupOf(id.slice(FILES_PREFIX.length)).root, kept);
  if (index === undefined) return { isChanged: false };
  const problem = typeof index === "string" ? index : undefined;
  const isChanged = typeof index !== "string" && JSON.stringify(index) !== kept.index;
  if (problem === kept.problem) return { isChanged };
  files.set(file, { ...kept, problem });
  return { isChanged, read: { file, ...(problem === undefined ? {} : { problem }) } };
};

/** The patterns' modules a dev server serves, kept to tell an edit that changes a list. */
export const servedPatterns = (): ServedPatterns => {
  // by group, each story file as last known
  const served = new Map<string, Map<string, ServedFile>>();
  return {
    keep: (id: string, read: StoryFilesRead): void => {
      served.set(id, servedFiles(read, served.get(id)));
    },
    edited: (file: string): StoryFileEdit => {
      // in Vite's form, as the served files are kept: a Windows path reaches here either way
      const edited = VITE_PATHS.normalize(file);
      const reads = [...served].map(([id, files]) => ({ id, ...editedIn(id, files, edited) }));
      const read = reads.find((each) => each.read !== undefined)?.read;
      return {
        changed: reads.filter((each) => each.isChanged).map(({ id }) => id),
        renewed: reads.filter((each) => each.read !== undefined).map(({ id }) => id),
        ...(read === undefined ? {} : { read })
      };
    },
    listing: (file: string): readonly string[] => {
      const listed = VITE_PATHS.normalize(file);
      return [...served].filter(([, files]) => files.has(listed)).map(([id]) => id);
    }
  };
};

/**
 * Renews modules, so the next page that imports them reads them anew: Vite stops at a story file that takes its own
 * edit, and the modules that import it stay as they were served.
 *
 * @param environment - the client's environment.
 * @param ids - the modules.
 */
const invalidated = (environment: Pick<DevEnvironment, "moduleGraph">, ids: readonly string[]): void => {
  for (const id of ids) {
    const module = environment.moduleGraph.getModuleById(id);
    if (module !== undefined) environment.moduleGraph.invalidateModule(module);
  }
};

/**
 * Tells the environments a script now parses or no longer does: every pattern's module, which names it among the
 * catalogue's problems, is renewed for the next page and the next answer to a tool, and the open pages name it or stop.
 *
 * @param environments - the dev server's environments.
 * @param read - whether the script parses now.
 */
const scriptRead = (environments: readonly DevEnvironment[], read: StoryFileRead): void => {
  for (const environment of environments) {
    const patterns = [...environment.moduleGraph.idToModuleMap.keys()].filter((id) =>
      id.startsWith(FILES_PREFIX)
    );
    invalidated(environment, patterns);
    if (environment.name === "client")
      environment.hot.send({ type: "custom", event: STORY_FILE_READ_EVENT, data: read });
  }
};

/**
 * The plugin's hooks for a story file's edit: the file accepts it on a dev server, an edit that changes a pattern's
 * list (a story added, renamed, a title) reloads the pages, which read the list once, and one that changes whether the
 * file can be read tells them. A story file a frame loads is
 * followed closely (`closeWatch.ts`), and the late report of an edit of any file the close watch handed on already is
 * dropped, so an edit is drawn once.
 *
 * @param isServing - whether a dev server runs whose framework draws an edited story file in place.
 * @param served - what the edit changed, and the modules that list the file.
 * @param watching - the dev server's close watch.
 * @param scripts - the project's other scripts that do not parse: an edit that breaks or fixes one renews every
 * pattern's module, which names them, and tells the pages as a story file's does.
 */
export const storyFileHotHooks = (
  isServing: () => boolean,
  served: Pick<ServedPatterns, "edited" | "listing">,
  watching: Pick<CloseWatch, "follow" | "isLateReport">,
  scripts?: Pick<ScriptProblems, "edited">
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
    if (!STORY_FILE.test(options.file)) {
      // read once for every environment: the first to hear of the edit renews them all
      const read = scripts?.edited(options.file);
      if (read !== undefined) scriptRead(Object.values(options.server.environments), read);
      return undefined;
    }
    if (this.environment.name !== "client") {
      // the server's modules answer tools and agents, each answer anew: they have no page to keep
      invalidated(this.environment, served.listing(options.file));
      return undefined;
    }
    const { changed, renewed, read } = served.edited(options.file);
    invalidated(this.environment, [...changed, ...renewed]);
    if (read !== undefined)
      this.environment.hot.send({ type: "custom", event: STORY_FILE_READ_EVENT, data: read });
    if (changed.length === 0) return undefined;
    this.environment.hot.send({ type: "full-reload" });
    return [];
  }
});
