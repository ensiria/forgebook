/**
 * A catalogue's docs pages in its tree: their ids, their places and reading order, built from the sources' indexes, and
 * what they name that the tree does not have.
 *
 * @remarks
 * A page's place comes from its title, as a component's does: `Guides/Theming` is a page of the group Guides, so the
 * sidebar needs no list kept by hand. Its id is the title in kebab case, prefixed by the source's id. Pure.
 *
 * @module
 */
import type { DocPageIndex, StorySource } from "@forgebook/story-format/source";

import { pageSlug } from "./docPages.ts";
import { sourcePages } from "./sourceFiles.ts";
import type { StoryTree, TreeSource } from "./storyTree.ts";

/** One docs page. */
export type TreePage = {
  /** `<source>:<slug>`: the URL's `page` parameter. */
  readonly id: string;
  /** The part of its id after the source's: what a link between two pages of a source names. */
  readonly slug: string;
  /** The last segment of the title (`Theming`). */
  readonly name: string;
  /** The whole title (`Guides/Theming`). */
  readonly title: string;
  /** The segments before the name; none for a page outside any group. */
  readonly group: string | undefined;
  /** Its file, a key of the source's pages. */
  readonly file: string;
  /** What it is about, in a sentence; none when it does not say. */
  readonly description: string | undefined;
  /** The ids of the stories it shows. */
  readonly stories: readonly string[];
  /** The ids of the components whose API tables it shows. */
  readonly components: readonly string[];
  /** The slugs of the pages it links to. */
  readonly links: readonly string[];
};

/**
 * A page's place, from its title: the last segment its name, the ones before its group. An empty segment is a problem.
 *
 * @param title - the page's title.
 */
const pagePlace = (title: string): { name: string; group: string | undefined } | string => {
  const segments = title.split("/").map((segment) => segment.trim());
  if (segments.some((segment) => segment === "")) return `"${title}" has an empty segment`;
  const name = segments.at(-1) ?? title;
  const group = segments.slice(0, -1).join(" / ");
  return { name, group: group === "" ? undefined : group };
};

/** A page's position: its `order`, or after every page with one. */
const orderOf = (entry: DocPageIndex): number => entry.order ?? Number.POSITIVE_INFINITY;

/**
 * The docs pages of one source, from their index; a title that cannot be placed, or is taken, is a problem.
 *
 * @param source - the source.
 * @param problems - receives the problems.
 */
export const treePages = (source: StorySource, problems: string[]): TreePage[] => {
  const seen = new Map<string, string>();
  const entries = Object.entries<DocPageIndex>(sourcePages(source).index).sort(
    ([, left], [, right]) => orderOf(left) - orderOf(right) || left.title.localeCompare(right.title)
  );
  return entries.flatMap(([file, entry]): TreePage[] => {
    for (const note of entry.notes ?? []) problems.push(`${source.name}: ${file}: ${note}`);
    const place = pagePlace(entry.title);
    if (typeof place === "string") {
      problems.push(`${source.name}: ${file}: ${place}`);
      return [];
    }
    const slug = pageSlug(entry.title);
    const other = seen.get(slug);
    if (other !== undefined) {
      problems.push(`${source.name}: ${file} and ${other} have the same title "${entry.title}"`);
      return [];
    }
    seen.set(slug, file);
    return [
      {
        id: `${source.id}:${slug}`,
        slug,
        title: entry.title,
        ...place,
        file,
        description: entry.description,
        stories: entry.stories,
        components: entry.components,
        links: entry.links
      }
    ];
  });
};

/**
 * What the docs pages name that the tree does not have: a story or a component renamed under a page must fail the
 * index, or the page would break unseen.
 *
 * @param sources - the tree's sources.
 * @param stories - the ids of its stories.
 * @param components - the ids of its components.
 */
export const pageProblems = (
  sources: readonly TreeSource[],
  stories: ReadonlySet<string>,
  components: ReadonlySet<string>
): string[] =>
  sources.flatMap((source) =>
    source.pages.flatMap((page) => [
      ...page.stories
        .filter((id) => !stories.has(id))
        .map((id) => `${source.name}: ${page.file} shows the story "${id}": no such story`),
      ...page.components
        .filter((id) => !components.has(id))
        .map((id) => `${source.name}: ${page.file} shows the component "${id}": no such component`),
      ...page.links
        .filter((slug) => !source.pages.some((other) => other.slug === slug))
        .map((slug) => `${source.name}: ${page.file} links to "${slug}": no such page`)
    ])
  );

/** Where a docs page is. */
export type PageLocation = {
  /** Its source. */
  readonly source: TreeSource;
  /** The page. */
  readonly page: TreePage;
};

/**
 * Finds a docs page by its id.
 *
 * @param tree - the tree.
 * @param id - the page's id.
 */
export const findPage = (tree: StoryTree, id: string): PageLocation | undefined => {
  for (const source of tree.sources) {
    const page = source.pages.find((candidate) => candidate.id === id);
    if (page !== undefined) return { source, page };
  }
  return undefined;
};

/** A source's docs pages under one heading. */
export type PageGroup = {
  /** The heading; none for pages outside any group. */
  readonly name: string | undefined;
  /** Its pages, in their order. */
  readonly pages: readonly TreePage[];
};

/**
 * Pages under their headings, in reading order: a named group sits where its first page is and takes all its pages, and
 * pages without a group stay between the groups where their order puts them.
 *
 * @param pages - the pages, in their order.
 */
export const pageGroups = (pages: readonly TreePage[]): PageGroup[] => {
  const groups: { readonly name: string | undefined; readonly pages: TreePage[] }[] = [];
  for (const page of pages) {
    const named = groups.find((group) => page.group !== undefined && group.name === page.group);
    const last = groups.at(-1);
    const group = page.group === undefined && last?.name === undefined ? last : named;
    if (group === undefined) groups.push({ name: page.group, pages: [page] });
    else group.pages.push(page);
  }
  return groups;
};
