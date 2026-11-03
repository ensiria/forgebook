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

import { packedUsage } from "../usedIn.ts";
import type { DiskCache } from "./diskCache.ts";
import type { DocsExtractor, DocsResult, UsageResult } from "./docsExtractor.ts";
import type { PackJson } from "./packedModule.ts";
import {
  type GroupLoaders,
  type IndexedStoryFile,
  indexedStoryFiles,
  type KeptIndex,
  PAGES_SEARCH_PREFIX,
  REACH_PREFIX,
  SEARCH_PREFIX,
  storyFilesCode,
  storyFilesGroupOf,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { storyReach } from "./storyReach.ts";
import { joinedUsage } from "./usageModule.ts";

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
export const FILES_PREFIX = "\0forgebook-files:";

/** The resolved id of a group's "Used in" module: Rollup's mark of a virtual module, then its import's specifier. */
export const USAGE_ID_PREFIX = `\0${USAGE_PREFIX}`;

/** The resolved id of a group's reach module, the same way. */
export const REACH_ID_PREFIX = `\0${REACH_PREFIX}`;

/** The resolved id of a group of story files' search index. */
export const SEARCH_ID_PREFIX = `\0${SEARCH_PREFIX}`;

/** The resolved id of a group of docs pages' search index. */
export const PAGES_SEARCH_ID_PREFIX = `\0${PAGES_SEARCH_PREFIX}`;

/**
 * The module that answers a `?forgebook-docs` import: the story file's component docs, or `{ error }` for the panel.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews the module.
 */
export const docsModule = (
  component: DocsResult,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  // the docs come from the component's files, not the story file the id names: Vite renews them on an edit only if
  // it watches those files too
  if (typeof component !== "string" && "sources" in component) {
    for (const file of component.sources) watch(file);
  }
  const value = typeof component === "string" ? { error: component } : component.docs;
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders; with the files, indexed,
 * which the dev server keeps to tell an edit that changes the list.
 *
 * @param id - the module's id (`FILES_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param loaders - the group's loaders besides its story files'.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param warm - starts reading the docs of a story file ahead of its request; none in a test run.
 * @throws when a story file cannot be indexed.
 */
export const patternModule = (
  id: string,
  watch: (file: string) => void,
  loaders: GroupLoaders,
  cache: DiskCache<KeptIndex> | undefined,
  warm: ((storyFile: string) => void) | undefined
): { code: string; moduleType: "js"; files: readonly IndexedStoryFile[] } => {
  const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  const files = indexedStoryFiles(root, pattern, watch, cache);
  const [first] = files;
  if (first !== undefined) warm?.(first.file);
  return { code: storyFilesCode(root, pattern, files, loaders), moduleType: "js", files };
};

/** A group's story files indexed, and what their stories render, read in the docs worker. */
type GroupUsage = {
  /** The story files, indexed. */
  readonly files: readonly IndexedStoryFile[];
  /** The facts, or why they cannot be read. */
  readonly graph: UsageResult;
};

/**
 * A group's facts: its story files indexed, what their stories render read in the docs worker.
 *
 * @param group - the group (`storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 * @param cache - the pattern's index kept between starts; none reads every file.
 */
const groupUsage = async (
  group: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined
): Promise<GroupUsage> => {
  const { root, pattern } = storyFilesGroupOf(group);
  const files = indexedStoryFiles(root, pattern, watch, cache);
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
 */
export const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined,
  pack: PackJson
): Promise<{ code: string; moduleType: "js" }> => {
  const { files, graph } = await groupUsage(id.slice(USAGE_ID_PREFIX.length), watch, usage, cache);
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
 */
export const reachModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  cache: DiskCache<KeptIndex> | undefined
): Promise<{ code: string; moduleType: "js" }> => {
  const { files, graph } = await groupUsage(id.slice(REACH_ID_PREFIX.length), watch, usage, cache);
  const reach =
    typeof graph === "string"
      ? []
      : storyReach(
          graph,
          files.map((file) => ({ storyFile: file.file, title: file.index.title }))
        );
  return { code: `export default ${JSON.stringify(reach)};`, moduleType: "js" };
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
 * @param read - a story file's component docs, and how the module writes its JSON.
 * @returns the index; none for another id.
 */
export const searchIndexModule = async (
  id: string,
  watch: (file: string) => void,
  read: {
    readonly docsOf: (storyFile: string) => Promise<DocsResult>;
    readonly isServing: boolean;
    readonly pack: PackJson;
  }
): Promise<SearchIndexModule | undefined> => {
  const isPages = id.startsWith(PAGES_SEARCH_ID_PREFIX);
  if (!isPages && !id.startsWith(SEARCH_ID_PREFIX)) return undefined;
  const { storySearchModule, pagesSearchModule } = await import("./searchModule.ts");
  const { root, pattern } = storyFilesGroupOf(
    id.slice((isPages ? PAGES_SEARCH_ID_PREFIX : SEARCH_ID_PREFIX).length)
  );
  const code = isPages
    ? pagesSearchModule(root, pattern, watch, read.pack)
    : await storySearchModule(root, pattern, watch, read.docsOf, read.isServing, read.pack);
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
 * @param read - reads a story file's component docs, says whether a dev server runs, and keeps each index's id with the
 * modules an edit renews (a docs pages' index with the docs pages').
 */
export const searchIndexes = (read: {
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  readonly isServing: () => boolean;
  readonly track: (id: string, isPages: boolean) => void;
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
      const search = await searchIndexModule(id, watch, { docsOf, isServing: read.isServing(), pack });
      if (search === undefined) return undefined;
      read.track(id, search.isPages);
      return search.module;
    }
  };
};
