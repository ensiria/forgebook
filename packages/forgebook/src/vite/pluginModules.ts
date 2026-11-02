/**
 * The modules the plugin makes from the story files and the docs pages: a story file's component docs, a pattern's
 * index, a group's "Used in", and a docs page.
 *
 * @module
 */

import { packedUsage } from "../usedIn.ts";
import type { DiskCache } from "./diskCache.ts";
import type { DocsExtractor, DocsResult } from "./docsExtractor.ts";
import type { PackJson } from "./packedModule.ts";
import {
  type IndexedStoryFile,
  indexedStoryFiles,
  type KeptIndex,
  REACH_QUERY,
  storyFilesCode,
  storyFilesGroupOf,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { storyReach } from "./storyReach.ts";
import { DOCS_PAGE_QUERY } from "./textQueries.ts";
import { joinedUsage } from "./usageModule.ts";

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
export const FILES_PREFIX = "\0forgebook-files:";

/** The id of a pattern's docs pages: virtual, with the declaring module's folder and the pattern after it. */
export const DOCS_PAGES_PREFIX = "\0forgebook-docs-pages:";

/** The resolved id of a group's "Used in" module: Rollup's mark of a virtual module, then its import's specifier. */
export const USAGE_ID_PREFIX = `\0${USAGE_PREFIX}`;

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
 * @param hasUsage - whether the group offers its "Used in" loader.
 * @param cache - the indexes kept between starts.
 * @param isServing - whether a dev server runs: only its tools ask what each story reaches.
 * @throws when a story file cannot be indexed.
 */
export const patternModule = (
  id: string,
  watch: (file: string) => void,
  hasUsage: boolean,
  cache: DiskCache<KeptIndex> | undefined,
  isServing: boolean
): { code: string; moduleType: "js"; files: readonly IndexedStoryFile[] } => {
  const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  const files = indexedStoryFiles(root, pattern, watch, cache);
  return { code: storyFilesCode(root, pattern, files, hasUsage, isServing), moduleType: "js", files };
};

/**
 * A group's "Used in" module: its story files indexed, what their stories render read in the docs worker, joined.
 *
 * @param id - the module's id (`USAGE_ID_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 */
export const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  isServing: boolean,
  pack: PackJson
): Promise<{ code: string; moduleType: "js" }> => {
  const isReach = id.endsWith(REACH_QUERY);
  const group = id.slice(USAGE_ID_PREFIX.length, isReach ? -REACH_QUERY.length : undefined);
  const { root, pattern } = storyFilesGroupOf(group);
  const files = indexedStoryFiles(root, pattern, watch);
  const graph = await usage(
    files.map((file) => ({
      storyFile: file.file,
      exports: file.index.stories.map((story) => story.exportName)
    }))
  );
  if (isReach) {
    // on the dev server only: a static build has no tools to ask, and this would ship every story's files to the reader
    const reach =
      isServing && typeof graph !== "string"
        ? storyReach(
            graph,
            files.map((file) => ({ storyFile: file.file, title: file.index.title }))
          )
        : [];
    return { code: `export default ${JSON.stringify(reach)};`, moduleType: "js" };
  }
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
 * A docs pages' module, when the id is a pattern's or a page's.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param isServing - whether a dev server runs.
 * @param fences - the fences the catalogue's plugins draw.
 */
export const docsModuleOf = async (
  id: string,
  watch: (file: string) => void,
  isServing: boolean,
  fences: readonly string[]
): Promise<{ code: string; moduleType: "js" } | undefined> => {
  const isPage = id.endsWith(DOCS_PAGE_QUERY);
  if (!isPage && !id.startsWith(DOCS_PAGES_PREFIX)) return undefined;
  // imported here: Markdown and the highlighter load for a catalogue that shows a page
  const { docPageModule, docPagesModule } = await import("./docPagesModule.ts");
  if (isPage) {
    const file = id.slice(0, -DOCS_PAGE_QUERY.length);
    return { code: docPageModule(file, watch, isServing, fences), moduleType: "js" };
  }
  const { root, pattern } = storyFilesGroupOf(id.slice(DOCS_PAGES_PREFIX.length));
  return { code: docPagesModule(root, pattern, watch, isServing), moduleType: "js" };
};
