/**
 * The catalogue's tree: sources, families, groups, components and their stories, built from the sources' indexes,
 * with every story's id.
 *
 * @remarks
 * A story's place comes from its file's title (`Family/Name` or `Family/Group/Name`, or Storybook's titles of any
 * depth), so the sidebar needs no list kept by hand. Ids follow CSF: the title and the export name in lower-case kebab, joined by `--`, here prefixed by
 * the source's id, so two packages can hold the same title. A component its meta lists in other places (`alsoIn`)
 * gets an alias entry in each, and related components (`related`) name each other both ways: an alias is not
 * a component, so the stories, the ids and the tests stay one per file. Pure.
 *
 * @module
 */
import type { StoryGroup } from "@forgebook/story-format/csf";
import type {
  FigmaLink,
  StoryBackground,
  StoryControlsSetting,
  StoryFileIndex,
  StorySource
} from "@forgebook/story-format/source";

import { sourceFiles } from "./sourceFiles.ts";

/** One story in the tree. */
export type TreeStory = {
  /** `<source>:<title>--<export>` in kebab case: the URL's `story` parameter. */
  readonly id: string;
  /** The name shown in the tabs. */
  readonly name: string;
  /** The named export. */
  readonly exportName: string;
  /** The props the panel can set, from the index: the story's setting, else the meta's, else every one. */
  readonly controls: StoryControlsSetting;
  /** Its group in the sidebar; none puts it above the groups. */
  readonly group: StoryGroup | undefined;
  /** What it shows and what to notice, from its TSDoc. */
  readonly description: string | undefined;
  /** Whether it is the component's demo (`parameters.main`). */
  readonly isMain: boolean;
  /** Whether it is meant for a phone (`parameters.touch`, its own or the meta's): it starts in touch. */
  readonly isTouch: boolean;
  /** Whether it is about logic, not looks (`parameters.logic`, its own or the meta's): a hook's or a function's scene. */
  readonly isLogic: boolean;
  /** The height its scene needs, in CSS px: its own `parameters.height`, else the meta's; none by default. */
  readonly height: number | undefined;
  /** Its design (`parameters.design.figma`): its own, else the meta's; none by default, nor when its own was refused. */
  readonly design: FigmaLink | undefined;
  /** Its tags, the meta's and its own (`!dev` keeps it out of the lists, `!test` out of the generated tests). */
  readonly tags: readonly string[];
};

/** One component (one story file). */
export type TreeComponent = {
  /** The last segment of the title (`Select`). */
  readonly name: string;
  /** The whole title (`Inputs/Selection/Select`). */
  readonly title: string;
  /** The story file, a key of the source's `index` and `stories`. */
  readonly file: string;
  /** Its stories the catalogue lists (the sidebar's count, the picker, the page), in the order of the file. */
  readonly stories: readonly TreeStory[];
  /**
   * Its stories tagged `!dev`, as Storybook's: listed nowhere, still opened by their address and tested; empty when
   * none.
   */
  readonly unlisted: readonly TreeStory[];
  /** The other places it is listed in, as the meta writes them (`Data/Tables`); empty when none. */
  readonly alsoIn: readonly string[];
  /**
   * The titles of its related components, both ways: those its meta names and those whose meta names it, by name.
   *
   */
  readonly related: readonly string[];
  /** Other words the search finds it by, as the meta writes them; empty when none. */
  readonly keywords: readonly string[];
  /** Its design: the meta's `parameters.design.figma`; none by default. */
  readonly design: FigmaLink | undefined;
};

/** A group's entry for a component that lives elsewhere and is listed here too (the meta's `alsoIn`). */
export type TreeAlias = {
  /** The component's name (`DataTable`). */
  readonly name: string;
  /** The component's title, where it lives (`Recipes/DataTable`): the entry opens that page. */
  readonly title: string;
};

/** A group inside a family; `name` is `undefined` for the components whose title has no group. */
export type TreeGroup = {
  /** The middle segment of the title, when it has three. */
  readonly name: string | undefined;
  /** Its components, alphabetically. */
  readonly components: readonly TreeComponent[];
  /** The components that live elsewhere and are listed here too, alphabetically; never counted as its own. */
  readonly aliases: readonly TreeAlias[];
};

/** A family: the first segment of the title. */
export type TreeFamily = {
  /** The family's name (`Inputs`). */
  readonly name: string;
  /**
   * The components without a group first, then the groups in the source's order (`familyGroups`), then
   * alphabetically.
   */
  readonly groups: readonly TreeGroup[];
};

/** A source and its families. */
export type TreeSource = {
  /** The source's id. */
  readonly id: string;
  /** The source's name. */
  readonly name: string;
  /** The URL of its logo, a square image; none when the source has none. */
  readonly logo: string | undefined;
  /** The colour its stories' page has, by theme and contrast; none when the source gives none. */
  readonly background: StoryBackground | undefined;
  /** Its families, in the source's order, then alphabetically. */
  readonly families: readonly TreeFamily[];
};

/** The tree, with what is wrong in the indexes (a title without a family, two files with the same title). */
export type StoryTree = {
  /** Every source with stories. */
  readonly sources: readonly TreeSource[];
  /** One message per problem; the files concerned are left out of the tree. */
  readonly problems: readonly string[];
};

/**
 * A text in lower-case kebab case, as CSF writes ids: every run of other characters becomes one `-`.
 *
 * @param text - any text.
 */
export const kebab = (text: string): string =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A story's id.
 *
 * @param sourceId - the source's id (`acme-ui`).
 * @param title - the file's title.
 * @param exportName - the story's export.
 */
export const storyId = (sourceId: string, title: string, exportName: string): string =>
  `${sourceId}:${kebab(title)}--${kebab(exportName)}`;

/**
 * A component's id: its source and title, the part of its stories' ids before `--`.
 *
 * @param sourceId - the source's id (`acme-ui`).
 * @param title - the file's title.
 */
export const componentId = (sourceId: string, title: string): string => `${sourceId}:${kebab(title)}`;

/**
 * A story's name from its export, in sentence case: `KeyboardOpen` → "Keyboard open", `Size2X` → "Size 2 x".
 *
 * @param exportName - the named export.
 */
export const storyName = (exportName: string): string => {
  const words = exportName
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Where a title places a component: its family, its group within the family, its name. */
type TitlePlace = { readonly family: string; readonly group: string | undefined; readonly name: string };

/**
 * Where a title places its component, or why it cannot be placed.
 *
 * @remarks
 * `Family/Name` and `Family/Group/Name` are Forgebook's titles. Storybook's may have any depth: one segment is a
 * family with a component of the same name; past three, the segments between the family and the name make the group
 * (`Atoms / Forms`), so every title of a Storybook project has a place.
 *
 * @param title - the meta's title.
 */
const titlePlace = (title: string): TitlePlace | string => {
  const segments = title.split("/").map((segment) => segment.trim());
  if (segments.some((segment) => segment === "")) return `"${title}" has an empty segment`;
  const [family = "", ...rest] = segments;
  const name = rest.at(-1) ?? family;
  const between = rest.slice(0, -1);
  return { family, group: between.length === 0 ? undefined : between.join(" / "), name };
};

/**
 * The rank of a name in an order the source gives: its place in the list, or after every listed one.
 *
 * @param order - the names in their order.
 * @param name - the name.
 */
const rankIn = (order: readonly string[], name: string): number => {
  const index = order.indexOf(name);
  return index === -1 ? order.length : index;
};

/**
 * Compares groups: the components without a group first, then the groups in the source's order, then by name.
 *
 * @param order - the family's groups in the source's order (`familyGroups`); empty when it gives none.
 */
const byGroup =
  (order: readonly string[]) =>
  (left: string | undefined, right: string | undefined): number => {
    if (left === undefined) return right === undefined ? 0 : -1;
    if (right === undefined) return 1;
    return rankIn(order, left) - rankIn(order, right) || left.localeCompare(right);
  };

/** A story file placed by its title, before its related components are known. */
type PlacedFile = {
  readonly file: string;
  readonly entry: StoryFileIndex;
  readonly family: string;
  readonly group: string | undefined;
  readonly name: string;
};

/** The files of one source placed by their titles; a title that cannot be placed, or is taken, is a problem. */
const placedFiles = (source: StorySource, problems: string[]): PlacedFile[] => {
  const placed: PlacedFile[] = [];
  const seenTitles = new Map<string, string>();
  for (const [file, entry] of Object.entries<StoryFileIndex>(sourceFiles(source).index)) {
    for (const note of entry.notes ?? []) problems.push(`${source.name}: ${file}: ${note}`);
    const place = titlePlace(entry.title);
    if (typeof place === "string") {
      problems.push(`${source.name}: ${file}: ${place}`);
      continue;
    }
    const other = seenTitles.get(entry.title);
    if (other !== undefined) {
      problems.push(`${source.name}: ${file} and ${other} have the same title "${entry.title}"`);
      continue;
    }
    seenTitles.set(entry.title, file);
    placed.push({ file, entry, ...place });
  }
  return placed;
};

/**
 * Each component's related titles, both ways, by its title: a link written in one meta reaches both pages. A title
 * that names no component of the source, or the component itself, is a problem.
 */
const relatedTitles = (
  source: StorySource,
  placed: readonly PlacedFile[],
  problems: string[]
): ReadonlyMap<string, readonly string[]> => {
  const names = new Map(placed.map((file) => [file.entry.title, file.name]));
  const links = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    links.set(from, (links.get(from) ?? new Set()).add(to));
  };
  for (const { file, entry } of placed) {
    for (const title of entry.related ?? []) {
      if (title === entry.title) problems.push(`${source.name}: ${file} names itself as related`);
      else if (!names.has(title))
        problems.push(`${source.name}: ${file} names "${title}" as related: no such title`);
      else {
        link(entry.title, title);
        link(title, entry.title);
      }
    }
  }
  return new Map(
    [...links.entries()].map(([title, others]) => [
      title,
      [...others].sort((left, right) => (names.get(left) ?? left).localeCompare(names.get(right) ?? right))
    ])
  );
};

/** The family and group a place of `alsoIn` names (`Data/Tables`, `Data`), or why it cannot be one. */
const aliasPlace = (place: string): { family: string; group: string | undefined } | string => {
  const segments = place.split("/").map((segment) => segment.trim());
  if (segments.some((segment) => segment === "")) return `"${place}" has an empty segment`;
  const [family = "", group, ...rest] = segments;
  if (rest.length > 0) return `"${place}" is not Family or Family/Group`;
  return { family, group };
};

/** The groups of the families as they are being built: by family, then by group. */
type GroupsByFamily = Map<
  string,
  Map<string | undefined, { components: TreeComponent[]; aliases: TreeAlias[] }>
>;

/** A family's group as it is being built, created when it is not there yet. */
const groupAt = (
  families: GroupsByFamily,
  family: string,
  group: string | undefined
): { components: TreeComponent[]; aliases: TreeAlias[] } => {
  const groups = families.get(family) ?? new Map();
  families.set(family, groups);
  const found = groups.get(group) ?? { components: [], aliases: [] };
  groups.set(group, found);
  return found;
};

/**
 * Lists each component in the other places its meta names, beside the components that live there. A place that is
 * the component's own, or that already holds a component of the same name, is a problem.
 */
const placeAliases = (
  source: StorySource,
  placed: readonly PlacedFile[],
  families: GroupsByFamily,
  problems: string[]
): void => {
  for (const { file, entry, family, group, name } of placed) {
    for (const place of entry.alsoIn ?? []) {
      const at = aliasPlace(place);
      if (typeof at === "string") {
        problems.push(`${source.name}: ${file}: also in ${at}`);
        continue;
      }
      if (at.family === family && at.group === group) {
        problems.push(`${source.name}: ${file} is also in "${place}", its own place`);
        continue;
      }
      const target = groupAt(families, at.family, at.group);
      if ([...target.components, ...target.aliases].some((other) => other.name === name)) {
        problems.push(`${source.name}: ${file} is also in "${place}", which already lists a ${name}`);
        continue;
      }
      target.aliases.push({ name, title: entry.title });
    }
  }
};

/** Whether a story is kept out of the catalogue's lists: tagged `!dev`, as Storybook's sidebar leaves it out. */
const isUnlisted = (story: Pick<TreeStory, "tags">): boolean => story.tags.includes("!dev");

/** The families of one source, from its files. */
const sourceFamilies = (source: StorySource, problems: string[]): TreeFamily[] => {
  const placed = placedFiles(source, problems);
  const related = relatedTitles(source, placed, problems);
  const families: GroupsByFamily = new Map();
  for (const { file, entry, family, group, name } of placed) {
    const stories = entry.stories.map((story) => ({
      id: storyId(source.id, entry.title, story.exportName),
      name: story.name ?? storyName(story.exportName),
      exportName: story.exportName,
      controls: story.controls ?? entry.controls ?? "all",
      group: story.group,
      description: story.description,
      isMain: story.isMain === true,
      isTouch: story.isTouch ?? entry.isTouch ?? false,
      isLogic: story.isLogic ?? entry.isLogic ?? false,
      height: story.height ?? entry.height,
      design: story.design === undefined ? entry.design : (story.design ?? undefined),
      tags: story.tags ?? []
    }));
    groupAt(families, family, group).components.push({
      name,
      title: entry.title,
      file,
      stories: stories.filter((story) => !isUnlisted(story)),
      unlisted: stories.filter(isUnlisted),
      alsoIn: entry.alsoIn ?? [],
      related: related.get(entry.title) ?? [],
      keywords: entry.keywords ?? [],
      design: entry.design
    });
  }
  placeAliases(source, placed, families, problems);
  const order = source.families ?? [];
  const byOwnName = (left: { readonly name: string }, right: { readonly name: string }): number =>
    left.name.localeCompare(right.name);
  return [...families.entries()]
    .sort(([left], [right]) => rankIn(order, left) - rankIn(order, right) || left.localeCompare(right))
    .map(([name, groups]) => {
      const compareGroups = byGroup(source.familyGroups?.[name] ?? []);
      return {
        name,
        groups: [...groups.entries()]
          .sort(([left], [right]) => compareGroups(left, right))
          .map(([group, { components, aliases }]) => ({
            name: group,
            components: [...components].sort(byOwnName),
            aliases: [...aliases].sort(byOwnName)
          }))
      };
    });
};

/**
 * The catalogue's tree from the sources.
 *
 * @param sources - the sources, in the order the app lists them.
 */
export const storyTree = (sources: readonly StorySource[]): StoryTree => {
  const problems: string[] = [];
  const tree = sources.map((source) => ({
    id: source.id,
    name: source.name,
    logo: source.logo,
    background: source.background,
    families: sourceFamilies(source, problems)
  }));
  return { sources: tree.filter((source) => source.families.length > 0), problems };
};

/**
 * Whether a component is about logic: it lists a story, and every story of its file is (`parameters.logic`), the
 * unlisted ones too, so its page documents a hook's or a function's signature and the sidebar marks it.
 *
 * @param component - the component.
 */
export const isLogicComponent = (component: Pick<TreeComponent, "stories" | "unlisted">): boolean =>
  component.stories.length > 0 &&
  [...component.stories, ...component.unlisted].every((story) => story.isLogic);

/** Where a story sits: its source, family, group and component. */
export type StoryLocation = {
  /** The source. */
  readonly source: TreeSource;
  /** The family. */
  readonly family: TreeFamily;
  /** The group. */
  readonly group: TreeGroup;
  /** The component. */
  readonly component: TreeComponent;
  /** The story. */
  readonly story: TreeStory;
};

/**
 * Every story of the tree with its place: each component's listed stories in the sidebar's order, then its unlisted
 * ones.
 *
 * @param tree - the tree.
 */
export const storyLocations = (tree: StoryTree): StoryLocation[] =>
  tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.flatMap((component) =>
          [...component.stories, ...component.unlisted].map((story) => ({
            source,
            family,
            group,
            component,
            story
          }))
        )
      )
    )
  );

/**
 * Every story the generated tests check, with its place: all but those tagged `!test`, as Storybook's test runner
 * leaves them out.
 *
 * @param tree - the tree.
 */
export const testedStoryLocations = (tree: StoryTree): StoryLocation[] =>
  storyLocations(tree).filter((location) => !location.story.tags.includes("!test"));

/**
 * Where a story sits.
 *
 * @param tree - the tree.
 * @param id - the story's id.
 * @returns its place, or `undefined` when no story has this id.
 */
export const findStory = (tree: StoryTree, id: string): StoryLocation | undefined =>
  storyLocations(tree).find((location) => location.story.id === id);

/** Where a component sits: its source, family and group. */
export type ComponentLocation = Omit<StoryLocation, "story">;

/**
 * Where a component sits.
 *
 * @param tree - the tree.
 * @param id - the component's id (`componentId`).
 * @returns its place, or `undefined` when no component has this id.
 */
export const findComponent = (tree: StoryTree, id: string): ComponentLocation | undefined =>
  tree.sources
    .flatMap((source) =>
      source.families.flatMap((family) =>
        family.groups.flatMap((group) =>
          group.components.map((component) => ({ source, family, group, component }))
        )
      )
    )
    .find((location) => componentId(location.source.id, location.component.title) === id);

/** A component's stories under one group heading in the sidebar. */
export type StoryGroupSection = {
  /** The group; none for the stories above the groups. */
  readonly group: StoryGroup | undefined;
  /** Its stories, in the order of the file. */
  readonly stories: readonly TreeStory[];
};

/**
 * A component's stories by group: the ungrouped ones first, then the groups the catalogue names in its order, then
 * the groups it does not name, by id; empty groups are left out.
 *
 * @param stories - the component's stories, in the order of the file.
 * @param order - the groups the catalogue names, in their order.
 */
export const groupedStories = (
  stories: readonly TreeStory[],
  order: readonly string[]
): StoryGroupSection[] => {
  const unnamed = [...new Set(stories.flatMap((story) => (story.group === undefined ? [] : [story.group])))]
    .filter((group) => !order.includes(group))
    .sort();
  return [undefined, ...order, ...unnamed]
    .map((group) => ({ group, stories: stories.filter((story) => story.group === group) }))
    .filter((section) => section.stories.length > 0);
};

/**
 * Every story's id in the sidebar's order: each component's stories by group, as the sidebar lists them.
 *
 * @param tree - the tree.
 * @param order - the groups the catalogue names, in their order.
 */
export const sidebarStoryIds = (tree: StoryTree, order: readonly string[]): string[] =>
  tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.flatMap((component) =>
          groupedStories(component.stories, order).flatMap((section) =>
            section.stories.map((story) => story.id)
          )
        )
      )
    )
  );

/**
 * A component's demo, drawn at the top of its page: the story marked `main`, else the one named `Overview`, else its
 * first.
 *
 * @param component - the component.
 */
export const mainStory = (component: TreeComponent): TreeStory | undefined =>
  component.stories.find((story) => story.isMain) ??
  component.stories.find((story) => story.exportName === "Overview") ??
  component.stories[0];
