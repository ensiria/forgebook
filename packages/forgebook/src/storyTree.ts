/**
 * The catalogue's tree: sources, families, groups, components and their stories, built from the sources' indexes,
 * with every story's id.
 *
 * @remarks
 * A story's place comes from its file's title (`Family/Name` or `Family/Group/Name`, or Storybook's titles of any
 * depth), so the sidebar needs no list kept by hand. Files with the same title make one component, as Storybook merges
 * them: its stories come from each file in the order of their paths, and its docs and page from the first. Ids are
 * Storybook's (`storyIds.ts`), prefixed by the source's id so two packages can hold the same title; the ids an earlier
 * rule gave (titles split at their case changes) still find their story, so old addresses keep working. A component
 * its meta lists in other places (`alsoIn`) gets an alias entry in each, and related components (`related`) name each
 * other both ways: an alias is not a component, so the stories, the ids and the tests stay one per story. Pure.
 *
 * @module
 */
import type { StoryDeviceSetting, StoryGroup } from "@forgebook/story-format/csf";
import type {
  FigmaLink,
  StoryBackground,
  StoryControlsSetting,
  StoryFileIndex,
  StoryIndexEntry,
  StorySource
} from "@forgebook/story-format/source";

import { pageProblems, type TreePage, treePages } from "./pageTree.ts";
import { sourceFiles } from "./sourceFiles.ts";
import { csfStoryId, exportWords, idPart } from "./storyIds.ts";
import {
  type GroupsByFamily,
  groupAt,
  metaList,
  type PlacedComponent,
  placeAliases,
  relatedTitles
} from "./treePlaces.ts";

/** One story in the tree. */
export type TreeStory = {
  /** `<source>:<component>--<story>`, the rest as Storybook's id (`storyId`): the URL's `story` parameter. */
  readonly id: string;
  /** The story file it comes from, a key of the source's `index` and `stories`. */
  readonly file: string;
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
  /** The device it is shown in by default (`parameters.device`), its own fields over the meta's; none when neither sets one. */
  readonly device: StoryDeviceSetting | undefined;
  /** Its design (`parameters.design.figma`): its own, else the meta's; none by default, nor when its own was refused. */
  readonly design: FigmaLink | undefined;
  /** Its tags, the meta's and its own (`!dev` keeps it out of the lists, `!test` out of the generated tests). */
  readonly tags: readonly string[];
};

/** One component: the story files with its title. */
export type TreeComponent = {
  /**
   * `<source>:<component>` (`componentId`), from its first file's meta: the part of its stories' ids before `--`, but
   * for a later file whose meta writes another `id`, whose stories start with that one, as in Storybook.
   */
  readonly id: string;
  /** The last segment of the title (`Select`). */
  readonly name: string;
  /** The whole title (`Inputs/Selection/Select`). */
  readonly title: string;
  /**
   * Its first story file, a key of the source's `index` and `stories`: the one its docs and its page come from, as
   * Storybook's docs come from the first file of a title.
   */
  readonly file: string;
  /** Every story file with its title, in the order of their paths; `file` first. */
  readonly files: readonly string[];
  /** Its stories the catalogue lists (the sidebar's count, the picker, the page), in the order of the files. */
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
  /** The prop groups its meta lists first (`parameters.propGroups`), in their order; empty when none. */
  readonly propGroups: readonly string[];
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
  /** Its docs pages: by `order`, the pages without one after, then by title. Empty when it has none. */
  readonly pages: readonly TreePage[];
};

/** The tree, with what is wrong in the indexes (a title without a family, a story id used twice). */
export type StoryTree = {
  /** Every source with stories or docs pages. */
  readonly sources: readonly TreeSource[];
  /** One message per problem; the files or stories concerned are left out of the tree. */
  readonly problems: readonly string[];
};

/**
 * A text in lower-case kebab case, split at its case changes: the rule ids had before they followed Storybook's, kept
 * to find a story by an id written then (`formerStoryId`).
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
 * A story's id: the source's id, then Storybook's id of the story.
 *
 * @param sourceId - the source's id (`acme-ui`).
 * @param component - the meta's `id` when it writes one, else the title.
 * @param exportName - the story's export.
 */
export const storyId = (sourceId: string, component: string, exportName: string): string =>
  `${sourceId}:${csfStoryId(component, exportName)}`;

/**
 * A component's id: its source and Storybook's id of the component, the part of its stories' ids before `--`.
 *
 * @param sourceId - the source's id (`acme-ui`).
 * @param component - the meta's `id` when it writes one, else the title.
 */
export const componentId = (sourceId: string, component: string): string =>
  `${sourceId}:${idPart(component)}`;

/**
 * The id a component had under the former rule (`kebab`), which an address written then still names.
 *
 * @param sourceId - the source's id.
 * @param title - the component's title.
 */
export const formerComponentId = (sourceId: string, title: string): string => `${sourceId}:${kebab(title)}`;

/**
 * The id a story had under the former rule (`kebab`), which an address written then still names.
 *
 * @param sourceId - the source's id.
 * @param title - the component's title.
 * @param exportName - the story's export.
 */
export const formerStoryId = (sourceId: string, title: string, exportName: string): string =>
  `${formerComponentId(sourceId, title)}--${kebab(exportName)}`;

/**
 * A story's name from its export: its words as Storybook splits them (`exportWords`), in sentence case, a word written
 * in capitals kept so: `KeyboardOpen` → "Keyboard open", `CustomSVGIcon` → "Custom SVG icon", `Size2X` → "Size 2 X".
 *
 * @param exportName - the named export.
 */
export const storyName = (exportName: string): string =>
  exportWords(exportName)
    .map((word, index) => {
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word === word.toUpperCase() ? word : word.toLowerCase();
    })
    .join(" ");

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

/** A placed component while its files are gathered. */
type GatheredComponent = { -readonly [Key in keyof PlacedComponent]: PlacedComponent[Key] };

/**
 * The component a file's title starts, or why it cannot: its title has no place, or makes no id, or an id another
 * title already has (Storybook would merge their stories under one id; the catalogue could open only one).
 *
 * @param source - the source.
 * @param file - the file.
 * @param entry - its index.
 * @param titlesById - the titles of the source's components so far, by id.
 */
const startedComponent = (
  source: StorySource,
  file: string,
  entry: StoryFileIndex,
  titlesById: ReadonlyMap<string, string>
): GatheredComponent | string => {
  const place = titlePlace(entry.title);
  if (typeof place === "string") return place;
  const component = entry.id ?? entry.title;
  if (idPart(component) === "") return `"${component}" makes no id: it needs a letter or a digit`;
  const id = componentId(source.id, component);
  const other = titlesById.get(id);
  if (other !== undefined) return `"${entry.title}" has the id "${id}" of "${other}"`;
  return { title: entry.title, id, files: [{ file, entry }], ...place };
};

/**
 * The components of one source, its files placed by their titles and merged when they share one; a title that cannot
 * be placed, or that makes no id or a taken one, is a problem.
 */
const placedComponents = (source: StorySource, problems: string[]): PlacedComponent[] => {
  const byTitle = new Map<string, GatheredComponent>();
  const titlesById = new Map<string, string>();
  const index = sourceFiles(source).index;
  // sorted, so a component's files, and so its stories, its docs and a clash's winner, never depend on the groups' order
  for (const file of Object.keys(index).sort()) {
    const entry = index[file];
    if (entry === undefined) continue;
    for (const note of entry.notes ?? []) problems.push(`${source.name}: ${file}: ${note}`);
    const placed = byTitle.get(entry.title);
    if (placed !== undefined) {
      placed.files = [...placed.files, { file, entry }];
      continue;
    }
    const started = startedComponent(source, file, entry, titlesById);
    if (typeof started === "string") {
      problems.push(`${source.name}: ${file}: ${started}`);
      continue;
    }
    byTitle.set(entry.title, started);
    titlesById.set(started.id, entry.title);
  }
  return [...byTitle.values()];
};

/** Whether a story is kept out of the catalogue's lists: tagged `!dev`, as Storybook's sidebar leaves it out. */
const isUnlisted = (story: Pick<TreeStory, "tags">): boolean => story.tags.includes("!dev");

/**
 * A story of the tree: its index entry under its file's meta.
 *
 * @param id - its id.
 * @param file - its file.
 * @param entry - its file's index.
 * @param story - its entry in the index.
 * @param design - its design: its own, else its file's meta's.
 */
const treeStory = (
  id: string,
  file: string,
  entry: StoryFileIndex,
  story: StoryIndexEntry,
  design: FigmaLink | undefined
): TreeStory => ({
  id,
  file,
  name: story.name ?? storyName(story.exportName),
  exportName: story.exportName,
  controls: story.controls ?? entry.controls ?? "all",
  group: story.group,
  description: story.description,
  isMain: story.isMain === true,
  isTouch: story.isTouch ?? entry.isTouch ?? false,
  isLogic: story.isLogic ?? entry.isLogic ?? false,
  height: story.height ?? entry.height,
  device:
    entry.device === undefined && story.device === undefined
      ? undefined
      : { ...entry.device, ...story.device },
  design,
  tags: story.tags ?? []
});

/**
 * A story's id: the one it writes, else the one its meta and its export make; or why it has none.
 *
 * @param sourceId - the source's id.
 * @param entry - its file's index.
 * @param story - its entry in the index.
 */
const treeStoryId = (sourceId: string, entry: StoryFileIndex, story: StoryIndexEntry): string | Error => {
  if (story.id === "") return new Error(`story ${story.exportName} writes an empty id (\`parameters.__id\`)`);
  if (story.id !== undefined) return `${sourceId}:${story.id}`;
  if (idPart(exportWords(story.exportName).join(" ")) === "")
    return new Error(`story ${story.exportName} makes no id: its name needs a letter or a digit`);
  return storyId(sourceId, entry.id ?? entry.title, story.exportName);
};

/**
 * The stories of a component's files, each meta's settings under its own stories. A story whose id is empty or taken
 * (by any story of the source: Storybook refuses both) is a problem, and left out.
 *
 * @param source - the source.
 * @param component - the component.
 * @param seenIds - the ids of the source's stories so far, with their files; the new ones are added.
 * @param problems - where a problem goes.
 */
const componentStories = (
  source: StorySource,
  component: PlacedComponent,
  seenIds: Map<string, string>,
  problems: string[]
): TreeStory[] =>
  component.files.flatMap(({ file, entry }) =>
    entry.stories.flatMap((story): TreeStory[] => {
      const id = treeStoryId(source.id, entry, story);
      const other = typeof id === "string" ? seenIds.get(id) : undefined;
      if (id instanceof Error || other !== undefined) {
        const problem =
          id instanceof Error
            ? id.message
            : `story ${story.exportName} has the id "${id}" of a story in ${other}`;
        problems.push(`${source.name}: ${file}: ${problem}`);
        return [];
      }
      seenIds.set(id, file);
      // its own link, else its file's meta's; `null` is its own link the index refused, which stays refused
      const design = story.design === undefined ? entry.design : (story.design ?? undefined);
      return [treeStory(id, file, entry, story, design)];
    })
  );

/**
 * A component's design: its first file's meta's, as its docs are.
 *
 * @param component - the component.
 */
const componentDesign = (component: PlacedComponent): FigmaLink | undefined =>
  component.files[0]?.entry.design;

/** The families of one source, from its files. */
const sourceFamilies = (source: StorySource, problems: string[]): TreeFamily[] => {
  const placed = placedComponents(source, problems);
  const related = relatedTitles(source, placed, problems);
  const families: GroupsByFamily = new Map();
  const seenIds = new Map<string, string>();
  for (const component of placed) {
    const { title, family, group, name, files } = component;
    const stories = componentStories(source, component, seenIds, problems);
    groupAt(families, family, group).components.push({
      id: component.id,
      name,
      title,
      file: files[0]?.file ?? "",
      files: files.map((each) => each.file),
      stories: stories.filter((story) => !isUnlisted(story)),
      unlisted: stories.filter(isUnlisted),
      alsoIn: metaList(component, "alsoIn"),
      related: related.get(title) ?? [],
      keywords: metaList(component, "keywords"),
      design: componentDesign(component),
      // its first file's, as its docs are
      propGroups: component.files[0]?.entry.propGroups ?? []
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
 * The ids a docs page may name the sources' components by: their own, and the ones the former rule gave them
 * (`formerComponentId`), which a page written then still uses.
 */
const componentIds = (sources: readonly TreeSource[]): string[] =>
  sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.flatMap((component) => [component.id, formerComponentId(source.id, component.title)])
      )
    )
  );

/** The ids a docs page may name the sources' stories by: their own, and their former ones (`formerStoryId`). */
const storyIds = (sources: readonly TreeSource[]): string[] =>
  storyLocations({ sources, problems: [] }).flatMap(({ source, component, story }) => [
    story.id,
    formerStoryId(source.id, component.title, story.exportName)
  ]);

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
    families: sourceFamilies(source, problems),
    pages: treePages(source, problems)
  }));
  const shown = tree.filter((source) => source.families.length > 0 || source.pages.length > 0);
  return {
    sources: shown,
    problems: [...problems, ...pageProblems(shown, new Set(storyIds(shown)), new Set(componentIds(shown)))]
  };
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
 * Where a story sits: the story with this id, else the one an earlier rule gave this id (`formerStoryId`), so an
 * address written then still opens it.
 *
 * @param tree - the tree.
 * @param id - the story's id.
 * @returns its place, or `undefined` when no story has this id.
 */
export const findStory = (tree: StoryTree, id: string): StoryLocation | undefined => {
  const locations = storyLocations(tree);
  return (
    locations.find((location) => location.story.id === id) ??
    locations.find(
      ({ source, component, story }) => formerStoryId(source.id, component.title, story.exportName) === id
    )
  );
};

/** Where a component sits: its source, family and group. */
export type ComponentLocation = Omit<StoryLocation, "story">;

/**
 * Every component of the tree with its place.
 *
 * @param tree - the tree.
 */
const componentLocations = (tree: StoryTree): ComponentLocation[] =>
  tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.map((component) => ({ source, family, group, component }))
      )
    )
  );

/**
 * Where a component sits: the component with this id, else the one an earlier rule gave this id (its title in
 * `kebab`), so an address written then still opens it.
 *
 * @param tree - the tree.
 * @param id - the component's id (`TreeComponent.id`).
 * @returns its place, or `undefined` when no component has this id.
 */
export const findComponent = (tree: StoryTree, id: string): ComponentLocation | undefined => {
  const locations = componentLocations(tree);
  return (
    locations.find((location) => location.component.id === id) ??
    locations.find(({ source, component }) => formerComponentId(source.id, component.title) === id)
  );
};

/**
 * Where the component with a title sits, in one source: what a meta's `related` or `alsoIn`, or "Used in", names.
 *
 * @param tree - the tree.
 * @param sourceId - the source's id.
 * @param title - the component's title.
 * @returns its place, or `undefined` when the source has no component with this title.
 */
export const findComponentByTitle = (
  tree: StoryTree,
  sourceId: string,
  title: string
): ComponentLocation | undefined =>
  componentLocations(tree).find(
    (location) => location.source.id === sourceId && location.component.title === title
  );

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
