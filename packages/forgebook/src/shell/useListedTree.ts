/**
 * The tree the sidebar and the story keys list: the whole one, or what the address's tags keep of it.
 *
 * @remarks
 * The filter's code loads only when an address names a tag, so a catalogue nobody filters pays for a question and not
 * for its answer. Until it arrives the whole tree shows, as the search's tree does before its list comes.
 *
 * @module
 */
import { useEffect, useMemo, useState } from "react";

import type { taggedTree } from "../storyTags.ts";
import type { StoryTree } from "../storyTree.ts";

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
  return useMemo(
    () => (isFiltered && filter !== undefined ? filter(tree, tags) : tree),
    [filter, isFiltered, tree, tags]
  );
};
