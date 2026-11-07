/**
 * The tag filter: which stories a list of tags keeps, for the sidebar's tree and the agents' documents alike.
 *
 * @remarks
 * Written as CSF writes a tag: `beta` asks for it, `!beta` asks to leave it out. A story stays when it holds any tag
 * asked for and none left out, as Storybook's filter reads its choices, so ticking one more tag widens the list. A docs
 * page holds no tags, so it reads as a story with none. Pure.
 *
 * @module
 */
import { isFilterTag } from "./storyTagNames.ts";
import type { StoryTree, TreeComponent, TreeGroup, TreeSource, TreeStory } from "./storyTree.ts";

/** One tag the catalogue's stories hold. */
export type CatalogueTag = {
  /** The tag. */
  readonly tag: string;
  /** How many listed stories hold it. */
  readonly stories: number;
};

/**
 * Whether a story's tags pass a filter.
 *
 * @param tags - the story's tags.
 * @param filter - the filter's tags, each `name` or `!name`; none keeps every story.
 */
export const passesTags = (tags: readonly string[], filter: readonly string[]): boolean => {
  const asked = filter.filter((tag) => !tag.startsWith("!"));
  return (
    filter.every((tag) => !tag.startsWith("!") || !tags.includes(tag.slice(1))) &&
    (asked.length === 0 || asked.some((tag) => tags.includes(tag)))
  );
};

/** Every component of a source, whatever group it sits in. */
const componentsOf = (source: TreeSource): readonly TreeComponent[] =>
  source.families.flatMap((family) => family.groups.flatMap((group) => group.components));

/**
 * The tags a person can filter a catalogue by, by name, with the listed stories each one holds.
 *
 * @param tree - the tree.
 */
export const catalogueTags = (tree: StoryTree): readonly CatalogueTag[] => {
  const counts = new Map<string, number>();
  const stories: readonly TreeStory[] = tree.sources.flatMap((source) =>
    componentsOf(source).flatMap((component) => component.stories)
  );
  for (const tag of stories.flatMap((story) => story.tags.filter(isFilterTag))) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, stories: count }))
    .sort((one, other) => one.tag.localeCompare(other.tag));
};

/**
 * A group with what the filter keeps: its components with only the stories that pass, and the aliases of the components
 * that stay; an alias is opened to its component's page, so it follows that component.
 *
 * @param group - the group.
 * @param filter - the filter's tags.
 * @param keptTitles - the titles of the source's components that stay.
 */
const groupOf = (
  group: TreeGroup,
  filter: readonly string[],
  keptTitles: ReadonlySet<string>
): TreeGroup => ({
  ...group,
  components: group.components.flatMap((component) => {
    const stories = component.stories.filter((story) => passesTags(story.tags, filter));
    return stories.length === 0 ? [] : [{ ...component, stories }];
  }),
  aliases: group.aliases.filter((alias) => keptTitles.has(alias.title))
});

/**
 * The tree the sidebar lists under a filter: only the stories that pass, and what holds them. Pages keep opening from
 * the whole tree: an address still shows a story the filter leaves out.
 *
 * @param tree - the whole tree.
 * @param filter - the filter's tags, each `name` or `!name`; none gives the tree as it is.
 */
export const taggedTree = (tree: StoryTree, filter: readonly string[]): StoryTree => {
  if (filter.length === 0) return tree;
  const hasAsked = filter.some((tag) => !tag.startsWith("!"));
  return {
    ...tree,
    sources: tree.sources.map((source) => {
      const keptTitles = new Set(
        componentsOf(source)
          .filter((component) => component.stories.some((story) => passesTags(story.tags, filter)))
          .map((component) => component.title)
      );
      return {
        ...source,
        pages: hasAsked ? [] : source.pages,
        families: source.families.flatMap((family) => {
          const groups = family.groups
            .map((group) => groupOf(group, filter, keptTitles))
            .filter((group) => group.components.length > 0 || group.aliases.length > 0);
          return groups.length === 0 ? [] : [{ ...family, groups }];
        })
      };
    })
  };
};
