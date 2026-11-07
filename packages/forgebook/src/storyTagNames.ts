/**
 * Which of a story's tags a person filters by, apart from the filter itself (`storyTags.ts`).
 *
 * @remarks
 * Apart because the sidebar asks it on every catalogue's first load, to know whether to offer a filter at all, and a
 * catalogue with no tags must not pay for the rest. Pure.
 *
 * @module
 */

/** The tags CSF gives a meaning of its own: they say what a tool does with a story, not what the story is. */
const TOOL_TAGS: ReadonlySet<string> = new Set(["dev", "test", "autodocs", "play-fn", "test-fn"]);

/**
 * Whether a person can filter by a tag: any but a tool's tag, and a `!name`, which only takes a tag away.
 *
 * @param tag - the tag, as a story holds it.
 */
export const isFilterTag = (tag: string): boolean => !tag.startsWith("!") && !TOOL_TAGS.has(tag);
