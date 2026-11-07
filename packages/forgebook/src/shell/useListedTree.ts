/**
 * The tree the sidebar and the story keys list: the whole one, or what the address's tags keep of it.
 *
 * @remarks
 * The filter's code loads only when an address names a tag, or with the tag filter's button, which hands it over
 * (`loadedTagFilter`) so the render that puts a checked tag in the address is already filtered. A catalogue nobody
 * filters pays for a question and not for its answer. Opened on an address that names a tag, the whole tree shows
 * until the code arrives, as the search's tree does before its list comes.
 *
 * @module
 */
import { useEffect, useMemo, useState } from "react";

import type { taggedTree } from "../storyTags.ts";
import type { StoryTree } from "../storyTree.ts";

/** The filter, set by the tag filter's button, which loads its code: read during a render, never waited for. */
export const loadedTagFilter: { current?: typeof taggedTree } = {};

/**
 * The tree to list.
 *
 * @param tree - the whole tree.
 * @param tags - the address's tags; none lists the whole tree.
 */
export const useListedTree = (tree: StoryTree, tags: readonly string[]): StoryTree => {
  const [filter, setFilter] = useState<typeof taggedTree>();
  const isFiltered = tags.length > 0;
  useEffect(() => {
    if (isFiltered) void import("../storyTags.ts").then((module) => setFilter(() => module.taggedTree));
  }, [isFiltered]);
  return useMemo(() => {
    const loaded = filter ?? loadedTagFilter.current;
    return isFiltered && loaded !== undefined ? loaded(tree, tags) : tree;
  }, [filter, isFiltered, tree, tags]);
};
