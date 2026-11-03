/**
 * A source's components placed by their titles, before they become the tree's: their files, the lists their metas
 * write merged over the files, the related components named both ways, and the aliases listed in other places.
 *
 * @remarks
 * Kept apart from `storyTree.ts`, which builds the tree from them. Pure.
 *
 * @module
 */
import type { StoryFileIndex, StorySource } from "@forgebook/story-format/source";

import type { TreeAlias, TreeComponent } from "./storyTree.ts";

/** A story file with its index. */
export type IndexedFile = {
  /** The file, a key of the source's `index`. */
  readonly file: string;
  /** Its index. */
  readonly entry: StoryFileIndex;
};

/** A component placed by its title, with its files, before its related components are known. */
export type PlacedComponent = {
  /** The title its files share. */
  readonly title: string;
  /** Its id (`componentId`), from its first file's meta. */
  readonly id: string;
  /** Its files, in the order of their paths. */
  readonly files: readonly IndexedFile[];
  /** The title's family, its first segment. */
  readonly family: string;
  /** The title's group in its family, when it has one. */
  readonly group: string | undefined;
  /** The title's last segment. */
  readonly name: string;
};

/**
 * The strings of several lists, each once, in the order first seen.
 *
 * @param lists - the lists.
 */
const unionOf = (lists: readonly (readonly string[] | undefined)[]): readonly string[] => [
  ...new Set(lists.flatMap((list) => list ?? []))
];

/**
 * A meta's list, merged over a component's files: what each file's meta writes, each once.
 *
 * @param component - the component.
 * @param list - which list.
 */
export const metaList = (
  component: PlacedComponent,
  list: "alsoIn" | "related" | "keywords"
): readonly string[] => unionOf(component.files.map(({ entry }) => entry[list]));

/**
 * Each component's related titles, both ways, by its title: a link written in one meta reaches both pages. A title
 * that names no component of the source, or the component itself, is a problem.
 */
export const relatedTitles = (
  source: StorySource,
  placed: readonly PlacedComponent[],
  problems: string[]
): ReadonlyMap<string, readonly string[]> => {
  const names = new Map(placed.map((component) => [component.title, component.name]));
  const links = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    links.set(from, (links.get(from) ?? new Set()).add(to));
  };
  for (const component of placed) {
    const { title, files } = component;
    const where = files[0]?.file ?? title;
    for (const related of metaList(component, "related")) {
      if (related === title) problems.push(`${source.name}: ${where} names itself as related`);
      else if (!names.has(related))
        problems.push(`${source.name}: ${where} names "${related}" as related: no such title`);
      else {
        link(title, related);
        link(related, title);
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
export type GroupsByFamily = Map<
  string,
  Map<string | undefined, { components: TreeComponent[]; aliases: TreeAlias[] }>
>;

/** A family's group as it is being built, created when it is not there yet. */
export const groupAt = (
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
export const placeAliases = (
  source: StorySource,
  placed: readonly PlacedComponent[],
  families: GroupsByFamily,
  problems: string[]
): void => {
  for (const component of placed) {
    const { title, family, group, name } = component;
    const where = component.files[0]?.file ?? title;
    for (const place of metaList(component, "alsoIn")) {
      const at = aliasPlace(place);
      if (typeof at === "string") {
        problems.push(`${source.name}: ${where}: also in ${at}`);
        continue;
      }
      if (at.family === family && at.group === group) {
        problems.push(`${source.name}: ${where} is also in "${place}", its own place`);
        continue;
      }
      const target = groupAt(families, at.family, at.group);
      if ([...target.components, ...target.aliases].some((other) => other.name === name)) {
        problems.push(`${source.name}: ${where} is also in "${place}", which already lists a ${name}`);
        continue;
      }
      target.aliases.push({ name, title });
    }
  }
};
