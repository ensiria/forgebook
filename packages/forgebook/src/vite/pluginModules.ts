/**
 * The modules the plugin answers from what it read of the story files: a story file's component docs, a pattern's
 * index and loaders, a group's "Used in" and what its stories reach.
 *
 * @remarks
 * The modules made from a file's text (a story's code, a component's page, Markdown) are `textModules.ts`, which the
 * plugin loads on their first query: what they need is heavy, and a story's page needs none of it.
 *
 * @module
 */

import { codeLiteral } from "../codeLiteral.ts";
import { packedUsage } from "../usedIn.ts";
import type { DiskCache } from "./diskCache.ts";
import type { DocsExtractor, DocsResult, UsageResult } from "./docsExtractor.ts";
import type { PackJson } from "./packedModule.ts";
import { previewTagsOf, withPreviewTags } from "./previewTags.ts";
import {
  EVERY_FILE,
  FILES_SPECIFIER_PREFIX,
  type GroupLoaders,
  type IndexedStoryFile,
  type IsFileKept,
  type KeptIndex,
  PAGES_SEARCH_PREFIX,
  REACH_PREFIX,
  type RefusedStoryFile,
  readStoryFiles,
  refusalError,
  SEARCH_PREFIX,
  storyFileKeys,
  storyFilesCode,
  storyFilesGroupOf,
  TEXTS_PREFIX,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { storyReach } from "./storyReach.ts";
import { joinedUsage } from "./usageModule.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/**
 * The id of a group of story files' module: virtual, with the declaring module's folder and the patterns after it,
 * whether a `?forgebook-files` import or the group's specifier (`FILES_SPECIFIER_PREFIX`) names it.
 */
export const FILES_PREFIX = `\0${FILES_SPECIFIER_PREFIX}`;

/** The resolved id of a group's "Used in" module: Rollup's mark of a virtual module, then its import's specifier. */
export const USAGE_ID_PREFIX = `\0${USAGE_PREFIX}`;

/** The resolved id of a group's reach module, the same way. */
export const REACH_ID_PREFIX = `\0${REACH_PREFIX}`;

/** The resolved id of a group's texts module, a build's, the same way. */
export const TEXTS_ID_PREFIX = `\0${TEXTS_PREFIX}`;

/** The resolved id of a group of story files' search index. */
export const SEARCH_ID_PREFIX = `\0${SEARCH_PREFIX}`;

/** The resolved id of a group of docs pages' search index. */
export const PAGES_SEARCH_ID_PREFIX = `\0${PAGES_SEARCH_PREFIX}`;

/**
 * A story file's component docs as the panel reads them, or `{ error }`.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews what holds them.
 */
export const docsValue = (component: DocsResult, watch: (file: string) => void): unknown => {
  // the docs come from the component's files, not the story file the id names: Vite renews them on an edit only if
  // it watches those files too
  if (typeof component !== "string" && "sources" in component) {
    for (const file of component.sources) watch(file);
  }
  return typeof component === "string" ? { error: component } : component.docs;
};

/**
 * The module that answers a `?forgebook-docs` import: the story file's component docs, or `{ error }` for the panel.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews the module.
 */
export const docsModule = (
  component: DocsResult,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => ({
  code: `export default ${codeLiteral(docsValue(component, watch))};`,
  moduleType: "js"
});

/**
 * The module of a group of story files: every listed story file's index and loaders; with the files, indexed,
 * which the dev server keeps to tell an edit that changes the list.
 *
 * @param id - the module's id (`FILES_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param loaders - the group's loaders besides its story files'.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param warm - starts reading the docs of a story file ahead of its request; none in a test run.
 * @param startTexts - a build's: starts reading the files' docs, code and pages, which the module imports from the
 * group's texts module (`builtTexts.ts`); none imports each from its query.
 * @param isKept - whether a listed file may be read; every one by default.
 * @param isForgiving - whether a file that cannot be indexed is named among the catalogue's problems while the others
 * draw (a person at a dev server), rather than failing the module (a build, a test run).
 * @param catalogue - the catalogue, whose previews' tags every story takes; none has none.
 * @param scriptProblems - the project's scripts that do not parse, named among the catalogue's problems with the files
 * that cannot be indexed (`scriptProblems.ts`), where those are (a dev server); none by default.
 * @throws when a story file cannot be indexed, unless it is forgiven.
 */
export const patternModule = (
  id: string,
  watch: (file: string) => void,
  loaders: GroupLoaders,
  cache: DiskCache<KeptIndex> | undefined,
  warm: ((storyFile: string) => void) | undefined,
  startTexts?: (files: readonly IndexedStoryFile[]) => void,
  isKept: IsFileKept = EVERY_FILE,
  isForgiving = false,
  catalogue?: { readonly previews: readonly string[] },
  scriptProblems: readonly string[] = []
): {
  code: string;
  moduleType: "js";
  files: readonly IndexedStoryFile[];
  refused: readonly RefusedStoryFile[];
} => {
  const { root, patterns } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  const { files, refused } = readStoryFiles(root, patterns, watch, cache, isKept);
  if (refused.length > 0 && !isForgiving) throw refusalError(refused);
  const [first] = files;
  if (first !== undefined) warm?.(first.file);
  startTexts?.(files);
  const code = storyFilesCode(
    root,
    patterns,
    withPreviewTags(files, previewTagsOf(catalogue, watch)),
    loaders,
    startTexts !== undefined,
    refused,
    isForgiving ? scriptProblems : []
  );
  return { code, moduleType: "js", files, refused };
};

/**
 * Whether a story file added or removed changes what a group of story files lists: listed now and not when its module
 * was served, or the other way round. A file no pattern lists, or one a `!` pattern leaves out, changes nothing, so
 * the pages need no reload for it.
 *
 * @param id - the group's module's id (`FILES_PREFIX`, then the group).
 * @param listed - the files its module listed when served, absolute in Vite's form; none when it could not be made.
 * @param file - the file added or removed.
 * @param isKept - whether a listed file may be read; every one by default.
 */
export const isListingChanged = (
  id: string,
  listed: ReadonlySet<string> | undefined,
  file: string,
  isKept: IsFileKept = EVERY_FILE
): boolean => {
  if (listed === undefined) return true;
  const { root, patterns } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  const isListed = storyFileKeys(root, patterns, isKept).includes(VITE_PATHS.relativeKey(root, file));
  return isListed !== listed.has(VITE_PATHS.normalize(file));
};

/**
 * The modules a story file added or removed renews: the groups whose list it changes (`isListingChanged`) and, with
 * them, the modules that read their files; none when it changes no list.
 *
 * @param served - the groups' modules, with the files each listed when served.
 * @param file - the file added or removed.
 * @param readers - the modules that read the groups' files: their "Used in" and search indexes.
 * @param isKept - whether a listed file may be read; every one by default.
 */
export const listingRenewals = (
  served: ReadonlyMap<string, ReadonlySet<string> | undefined>,
  file: string,
  readers: readonly string[],
  isKept: IsFileKept = EVERY_FILE
): readonly string[] | undefined => {
  const changed = [...served]
    .filter(([id, listed]) => isListingChanged(id, listed, file, isKept))
    .map(([id]) => id);
  return changed.length === 0 ? undefined : [...changed, ...readers];
};

/** A group's story files indexed, and what their stories render, read in the docs worker. */
type GroupUsage = {
  /** The story files, indexed. */
  readonly files: readonly IndexedStoryFile[];
  /** The facts, or why they cannot be read. */
  readonly graph: UsageResult;
};

/**
 * A group's facts: its story files indexed, what their stories render read in the docs worker. A file that cannot be
 * indexed adds nothing here: the group's own module names it.
 *
 * @param group - the group (`storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param isKept - whether a listed file may be read.
 */
const groupUsage = async (
  group: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined,
  isKept: IsFileKept
): Promise<GroupUsage> => {
  const { root, patterns } = storyFilesGroupOf(group);
  const { files } = readStoryFiles(root, patterns, watch, cache, isKept);
  const graph = await usage(
    files.map((file) => ({
      storyFile: file.file,
      exports: file.index.stories.map((story) => story.exportName)
    }))
  );
  return { files, graph };
};

/**
 * A group's "Used in" module: for each component, the components that use it, packed once per title and list of
 * stories (`packedUsage`), which a page reads.
 *
 * @param id - the module's id (`USAGE_ID_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param pack - writes the module's JSON as its value: as it is on a dev server, in a gzipped file of a build's.
 * @param isKept - whether a listed file may be read; every one by default.
 */
export const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined,
  pack: PackJson,
  isKept: IsFileKept = EVERY_FILE
): Promise<{ code: string; moduleType: "js" }> => {
  const { files, graph } = await groupUsage(id.slice(USAGE_ID_PREFIX.length), watch, usage, cache, isKept);
  const answer =
    typeof graph === "string"
      ? { error: graph }
      : packedUsage(
          joinedUsage(
            graph,
            files.map((file) => ({
              storyFile: file.file,
              title: file.index.title,
              related: file.index.related ?? []
            }))
          )
        );
  return { code: `export default ${pack(JSON.stringify(answer))};`, moduleType: "js" };
};

/**
 * A group's reach module: the files each story reaches, which only the dev server's tools read (a check of what a
 * change touches). A module of its own, since a large library's stories reach thousands of files each, which a page
 * showing "Used in" must not download.
 *
 * @param id - the module's id (`REACH_ID_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param isKept - whether a listed file may be read; every one by default.
 */
export const reachModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined,
  isKept: IsFileKept = EVERY_FILE
): Promise<{ code: string; moduleType: "js" }> => {
  const { files, graph } = await groupUsage(id.slice(REACH_ID_PREFIX.length), watch, usage, cache, isKept);
  // the reason, not an empty list: no story reached and no story found are different answers
  const reach =
    typeof graph === "string"
      ? graph
      : storyReach(
          graph,
          files.map((file) => ({ storyFile: file.file, title: file.index.title }))
        );
  return { code: `export default ${codeLiteral(reach)};`, moduleType: "js" };
};

/** A search index, made: its module, and whether it is a group of docs pages' (renewed as pages come and go). */
export type SearchIndexModule = {
  /** The module. */
  readonly module: { readonly code: string; readonly moduleType: "js" };
  /** Whether it indexes docs pages, not story files. */
  readonly isPages: boolean;
};

/**
 * A group's search index, when the id names one: its story files' (what their components' docs and pages say) or its
 * docs pages'. The search's code, and the Markdown reader it needs, load with the first.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param read - a story file's component docs, how the module writes its JSON, and which listed files may be read.
 * @returns the index; none for another id.
 */
export const searchIndexModule = async (
  id: string,
  watch: (file: string) => void,
  read: {
    readonly docsOf: (storyFile: string) => Promise<DocsResult>;
    readonly isServing: boolean;
    readonly pack: PackJson;
    readonly isKept: IsFileKept;
  }
): Promise<SearchIndexModule | undefined> => {
  const isPages = id.startsWith(PAGES_SEARCH_ID_PREFIX);
  if (!isPages && !id.startsWith(SEARCH_ID_PREFIX)) return undefined;
  const { storySearchModule, pagesSearchModule } = await import("./searchModule.ts");
  const { root, patterns } = storyFilesGroupOf(
    id.slice((isPages ? PAGES_SEARCH_ID_PREFIX : SEARCH_ID_PREFIX).length)
  );
  const code = isPages
    ? pagesSearchModule(root, patterns, watch, read.pack, read.isKept)
    : await storySearchModule(root, patterns, watch, read.docsOf, read.isServing, read.pack, read.isKept);
  return { module: { code, moduleType: "js" }, isPages };
};

/** What a catalogue's search indexes read and tell: what `searchIndexes` makes. */
export type SearchIndexes = {
  /** A story file's component docs: a dev server reads them again each time, as they change while it runs. */
  readonly docsOf: (storyFile: string) => Promise<DocsResult>;
  /**
   * A group's search index, when the id names one; none for another id.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @param pack - writes the index's JSON as the module's value.
   */
  readonly moduleOf: (
    id: string,
    watch: (file: string) => void,
    pack: PackJson
  ) => Promise<{ code: string; moduleType: "js" } | undefined>;
};

/**
 * The search's indexes of a plugin: a build reads each component's docs once, for its page and its index.
 *
 * @param read - reads a story file's component docs, says whether a dev server runs, keeps each index's id with the
 * modules an edit renews (a docs pages' index with the docs pages'), and says which listed files may be read.
 */
export const searchIndexes = (read: {
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  readonly isServing: () => boolean;
  readonly track: (id: string, isPages: boolean) => void;
  readonly isKept: IsFileKept;
}): SearchIndexes => {
  const built = new Map<string, Promise<DocsResult>>();
  const docsOf = (storyFile: string): Promise<DocsResult> => {
    if (read.isServing()) return read.extract(storyFile);
    const docs = built.get(storyFile) ?? read.extract(storyFile);
    built.set(storyFile, docs);
    return docs;
  };
  return {
    docsOf,
    moduleOf: async (
      id: string,
      watch: (file: string) => void,
      pack: PackJson
    ): Promise<{ code: string; moduleType: "js" } | undefined> => {
      const search = await searchIndexModule(id, watch, {
        docsOf,
        isServing: read.isServing(),
        pack,
        isKept: read.isKept
      });
      if (search === undefined) return undefined;
      read.track(id, search.isPages);
      return search.module;
    }
  };
};
