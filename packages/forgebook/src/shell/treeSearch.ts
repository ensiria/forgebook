/**
 * The sidebar's search: every word of the query must appear in a component's name, its title (family and group), its
 * meta's search words or one of its stories' names and descriptions, in any order, so "button danger" or "inputs date"
 * find what they mean, and "hstack" finds the row another library calls so.
 *
 * @remarks
 * Case and accents are ignored. A component whose own name, title and search words hold every word is found whole; otherwise only
 * the stories that hold the words the component lacks are kept. An alias entry is found by its name, the place
 * it is listed in and the place it lives in, whole or not at all: its stories are picked on its page. Pure. Loaded with
 * the search's list: a tree nobody filters needs none of it.
 *
 * @module
 */
import type { TreePage } from "../pageTree.ts";
import type {
  StoryTree,
  TreeAlias,
  TreeComponent,
  TreeFamily,
  TreeGroup,
  TreeSource,
  TreeStory
} from "../storyTree.ts";

/**
 * A text as the search compares it: lower case, without accents.
 *
 * @param text - any text.
 */
const folded = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The words of a query, folded; none for an empty query.
 *
 * @param query - what the user typed.
 */
export const searchWords = (query: string): readonly string[] =>
  folded(query)
    .split(/\s+/)
    .filter((word) => word !== "");

/** Whether every word appears in the text. */
const holdsEvery = (text: string, words: readonly string[]): boolean =>
  words.every((word) => text.includes(word));

/** The text a story is found by. */
const storyText = (story: TreeStory): string => folded(`${story.name} ${story.description ?? ""}`);

/**
 * A component as the search finds it: whole when its name, title and search words hold every word, else only the stories that hold
 * the rest; `undefined` when nothing matches.
 *
 * @param component - the component.
 * @param words - the query's words (`searchWords`).
 */
export const foundComponent = (
  component: TreeComponent,
  words: readonly string[]
): TreeComponent | undefined => {
  const own = folded(
    `${component.name} ${component.title.replaceAll("/", " ")} ${component.keywords.join(" ")}`
  );
  if (holdsEvery(own, words)) return component;
  const rest = words.filter((word) => !own.includes(word));
  const stories = component.stories.filter((story) => holdsEvery(storyText(story), rest));
  return stories.length === 0 ? undefined : { ...component, stories };
};

/** Whether an alias entry holds every word in its name, the place it is listed in or the place it lives in. */
const isAliasFound = (
  alias: TreeAlias,
  family: TreeFamily,
  group: TreeGroup,
  words: readonly string[]
): boolean =>
  holdsEvery(
    folded(`${alias.name} ${family.name} ${group.name ?? ""} ${alias.title.replaceAll("/", " ")}`),
    words
  );

/**
 * A family with only what the search finds: `undefined` when it finds nothing, the family as it is for no words.
 *
 * @param family - the family.
 * @param words - the query's words (`searchWords`).
 */
export const foundFamily = (family: TreeFamily, words: readonly string[]): TreeFamily | undefined => {
  if (words.length === 0) return family;
  const groups = family.groups
    .map((group) => ({
      ...group,
      components: group.components.flatMap((component) => {
        const found = foundComponent(component, words);
        return found === undefined ? [] : [found];
      }),
      aliases: group.aliases.filter((alias) => isAliasFound(alias, family, group, words))
    }))
    .filter((group) => group.components.length > 0 || group.aliases.length > 0);
  return groups.length === 0 ? undefined : { ...family, groups };
};

/**
 * The docs pages the search finds: by their title and description; every page for no words.
 *
 * @param pages - the pages.
 * @param words - the query's words (`searchWords`).
 */
export const foundPages = (pages: readonly TreePage[], words: readonly string[]): readonly TreePage[] =>
  words.length === 0
    ? pages
    : pages.filter((page) =>
        holdsEvery(folded(`${page.title.replaceAll("/", " ")} ${page.description ?? ""}`), words)
      );

/** What the tree shows of a source's components. */
export type ShownSource = {
  /** The source. */
  readonly source: TreeSource;
  /** Its families, with what the search finds. */
  readonly families: readonly TreeFamily[];
};

/** What the tree shows of a source's docs pages. */
export type ShownPages = {
  /** The source. */
  readonly source: TreeSource;
  /** Its pages the search finds. */
  readonly pages: readonly TreePage[];
};

/** What the tree shows. */
export type ShownTree = {
  /** Each source with its families. */
  readonly sources: readonly ShownSource[];
  /** The sources with pages to show. */
  readonly pages: readonly ShownPages[];
};

/**
 * What the tree shows for a query.
 *
 * @param tree - the tree.
 * @param query - what the user typed.
 */
export const shownTree = (tree: StoryTree, query: string): ShownTree => {
  const words = searchWords(query);
  return {
    sources: tree.sources.map((source) => ({
      source,
      families: source.families.flatMap((family) => foundFamily(family, words) ?? [])
    })),
    pages: tree.sources
      .map((source) => ({ source, pages: foundPages(source.pages, words) }))
      .filter((entry) => entry.pages.length > 0)
  };
};
