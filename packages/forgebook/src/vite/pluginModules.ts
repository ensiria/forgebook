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
  REACH_PREFIX,
  storyFilesGroupOf,
  storyFilesModule,
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
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders.
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
): { code: string; moduleType: "js" } => {
  const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  let first: string | undefined;
  const code = storyFilesModule(
    root,
    pattern,
    (file: string): void => {
      first ??= file;
      watch(file);
    },
    loaders,
    cache
  );
  if (first !== undefined) warm?.(first);
  return { code, moduleType: "js" };
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
