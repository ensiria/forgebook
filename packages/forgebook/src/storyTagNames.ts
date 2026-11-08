/**
 * Which of a story's tags a person filters by, apart from the filter itself (`storyTags.ts`).
 *
 * @remarks
 * Apart because the sidebar asks it on every catalogue's first load, to know whether to offer a filter at all, and a
 * catalogue with no tags must not pay for the rest; a component's page asks it too, to know whether to draw statuses.
 * Pure.
 *
 * @module
 */
import { type StoryTree, storyLocations } from "./storyTree.ts";

/** The tags CSF gives a meaning of its own: they say what a tool does with a story, not what the story is. */
export const TOOL_TAGS: ReadonlySet<string> = new Set(["dev", "test", "autodocs", "play-fn", "test-fn"]);

/**
 * Whether a person can filter by a tag: any but a tool's tag, and a `!name`, which only takes a tag away.
 *
 * @param tag - the tag, as a story holds it.
 */
export const isFilterTag = (tag: string): boolean => !tag.startsWith("!") && !TOOL_TAGS.has(tag);

/**
 * Whether any listed story holds a tag a person can filter by: what offers the filter and draws the statuses' badges.
 *
 * @param tree - the tree.
 */
export const hasFilterTags = (tree: StoryTree): boolean =>
  storyLocations(tree).some(({ story }) => story.tags.some(isFilterTag));
