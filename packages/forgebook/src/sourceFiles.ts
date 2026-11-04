/**
 * A source's story files as one group: its `?forgebook-files` groups merged, so the tree, the frame and the panel look
 * a file up by its key wherever its pattern was declared; its docs pages the same way.
 *
 * @remarks
 * The keys are paths relative to the module that declared the source, unique across its groups. The merge is kept per
 * source object, so a page that asks on every render merges once. Pure apart from that cache.
 *
 * @module
 */
import type { DocPages, StoryFiles, StorySource } from "@forgebook/story-format/source";

/** The merged files of each source seen, by the source object itself. */
const MERGED = new WeakMap<StorySource, StoryFiles>();

/**
 * A source's story files, every group merged.
 *
 * @param source - the source.
 */
export const sourceFiles = (source: StorySource): StoryFiles => {
  const known = MERGED.get(source);
  if (known !== undefined) return known;
  const merged: StoryFiles = {
    index: Object.assign({}, ...source.files.map((group) => group.index)),
    stories: Object.assign({}, ...source.files.map((group) => group.stories)),
    docs: Object.assign({}, ...source.files.map((group) => group.docs)),
    code: Object.assign({}, ...source.files.map((group) => group.code)),
    pages: Object.assign({}, ...source.files.map((group) => group.pages))
  };
  MERGED.set(source, merged);
  return merged;
};

/** A source's docs pages, every group merged: the search index stays per group (`sourceSearchLoaders`). */
export type MergedPages = Required<Omit<DocPages, "search">>;

/** The merged docs pages of each source seen, by the source object itself. */
const MERGED_PAGES = new WeakMap<StorySource, MergedPages>();

/**
 * A source's docs pages, every group merged; empty for a source without any.
 *
 * @param source - the source.
 */
export const sourcePages = (source: StorySource): MergedPages => {
  const known = MERGED_PAGES.get(source);
  if (known !== undefined) return known;
  const groups = source.docs ?? [];
  const merged: MergedPages = {
    index: Object.assign({}, ...groups.map((group) => group.index)),
    pages: Object.assign({}, ...groups.map((group) => group.pages)),
    text: Object.assign({}, ...groups.map((group) => group.text ?? {}))
  };
  MERGED_PAGES.set(source, merged);
  return merged;
};

/**
 * The loaders of a source's search indexes, one per group: a group's index is read as it comes, so the docs pages' text
 * is found while a package's props are still being read.
 *
 * @param source - the source.
 */
export const sourceSearchLoaders = (source: StorySource): readonly (() => Promise<unknown>)[] =>
  [...source.files, ...(source.docs ?? [])].flatMap((group) => group.search ?? []);
