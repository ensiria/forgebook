/**
 * The tree the sidebar and the story keys list: the whole one, or what the address's tags keep of it.
 *
 * @remarks
 * The filter's code loads only when it can be used: when the tag filter's panel opens (`loadTagFilter`), so the tree
 * is filtered in the same render that puts a tag in the address, or when an address names a tag. A catalogue nobody
 * filters pays for a question and not for its answer. Opened on an address that names a tag, the whole tree shows
 * until the code arrives, as the search's tree does before its list comes.
 *
 * @module
 */
import { useEffect, useMemo, useState } from "react";

import type { taggedTree } from "../storyTags.ts";
import type { StoryTree } from "../storyTree.ts";

/** The filter, once its code has loaded: read during a render, so a tag checked after it loaded never shows the whole tree. */
let loadedFilter: typeof taggedTree | undefined;

/**
 * Loads the filter's code, once.
 *
 * @returns the filter.
 */
export const loadTagFilter = async (): Promise<typeof taggedTree> => {
  if (loadedFilter !== undefined) return loadedFilter;
  const module = await import("../storyTags.ts");
  loadedFilter = module.taggedTree;
  return module.taggedTree;
};

/**
 * The tree to list.
 *
 * @param tree - the whole tree.
 * @param tags - the address's tags; none lists the whole tree.
 */
export const useListedTree = (tree: StoryTree, tags: readonly string[]): StoryTree => {
  const [loaded, setLoaded] = useState<typeof taggedTree | undefined>(() => loadedFilter);
  const filter = loaded ?? loadedFilter;
  const isFiltered = tags.length > 0;
  useEffect(() => {
    if (isFiltered && filter === undefined) void loadTagFilter().then((each) => setLoaded(() => each));
  }, [isFiltered, filter]);
  return useMemo(
    () => (isFiltered && filter !== undefined ? filter(tree, tags) : tree),
    [filter, isFiltered, tree, tags]
  );
};
