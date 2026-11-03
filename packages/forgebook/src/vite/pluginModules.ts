/**
 * The modules the plugin answers from what it read of the story files: a story file's component docs, a pattern's
 * index and loaders, a group's "Used in".
 *
 * @remarks
 * The modules made from a file's text (a story's code, a component's page, Markdown) are `textModules.ts`, which the
 * plugin loads on their first query: what they need is heavy, and a story's page needs none of it.
 *
 * @module
 */
import type { DiskCache } from "./diskCache.ts";
import type { DocsExtractor, DocsResult } from "./docsExtractor.ts";
import {
  indexedStoryFiles,
  type KeptIndex,
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
 * @param hasUsage - whether the group offers its "Used in" loader.
 * @param cache - the pattern's index kept between starts; none reads every file.
 * @param warm - starts reading the docs of a story file ahead of its request, in a build; none on a dev server.
 * @throws when a story file cannot be indexed.
 */
export const patternModule = (
  id: string,
  watch: (file: string) => void,
  hasUsage: boolean,
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
    hasUsage,
    cache
  );
  if (first !== undefined) warm?.(first);
  return { code, moduleType: "js" };
};

/**
 * A group's "Used in" module: its story files indexed, what their stories render read in the docs worker, joined.
 *
 * @param id - the module's id (`USAGE_ID_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 * @param isServing - whether a dev server runs.
 * @param cache - the pattern's index kept between starts; none reads every file.
 */
export const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  isServing: boolean,
  cache: DiskCache<KeptIndex> | undefined
): Promise<{ code: string; moduleType: "js" }> => {
  const { root, pattern } = storyFilesGroupOf(id.slice(USAGE_ID_PREFIX.length));
  const files = indexedStoryFiles(root, pattern, watch, cache);
  const graph = await usage(
    files.map((file) => ({
      storyFile: file.file,
      exports: file.index.stories.map((story) => story.exportName)
    }))
  );
  const answer =
    typeof graph === "string"
      ? { error: graph }
      : joinedUsage(
          graph,
          files.map((file) => ({
            storyFile: file.file,
            title: file.index.title,
            related: file.index.related ?? []
          }))
        );
  // on the dev server only: a static build has no tools to ask, and this would ship every story's files to the reader
  const reach =
    isServing && typeof graph !== "string"
      ? storyReach(
          graph,
          files.map((file) => ({ storyFile: file.file, title: file.index.title }))
        )
      : [];
  const code = `export default ${JSON.stringify(answer)};\nexport const reach = ${JSON.stringify(reach)};`;
  return { code, moduleType: "js" };
};
