/**
 * "Used in": for each component of a source, the other components whose stories use it, directly (their JSX renders
 * it) or through another component that renders it; the shape the plugin's usage modules answer, read by the
 * component page and the agents' answers.
 *
 * @remarks
 * Each `?forgebook-files` group answers for its own files (`usage`, loaded only when asked): a source's groups are
 * merged here. A component lists the stories of its own source only, never its own stories nor the components its meta
 * names in `related`. Pure apart from the loaders it calls.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

/** A component whose stories use another. */
export type UsingComponent = {
  /** Its title (`Navigation/Tree`). */
  readonly title: string;
  /** Whether one of its stories renders the component itself, not only through another component. */
  readonly isDirect: boolean;
  /** The exports of its stories that use the component, in their file's order. */
  readonly stories: readonly string[];
};

/** For each component of a group or a source, by title, the components that use it, direct ones first. */
export type UsageIndex = Readonly<Record<string, readonly UsingComponent[]>>;

/** How many using components a page shows before "and N more". */
export const USED_IN_SHOWN = 12;

/**
 * Whether a value is a list of strings.
 *
 * @param value - the value.
 */
const isStrings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

/**
 * Whether a value is a using component.
 *
 * @param value - the value.
 */
const isUsingComponent = (value: unknown): value is UsingComponent =>
  typeof value === "object" &&
  value !== null &&
  "title" in value &&
  typeof value.title === "string" &&
  "isDirect" in value &&
  typeof value.isDirect === "boolean" &&
  "stories" in value &&
  isStrings(value.stories);

/**
 * Whether a usage module's answer is a usage index.
 *
 * @param value - what the module exports by default.
 */
export const isUsageIndex = (value: unknown): value is UsageIndex =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((users) => Array.isArray(users) && users.every(isUsingComponent));

/**
 * The using components in the order a page shows them: direct ones first, then by how many stories use the
 * component, then by title.
 *
 * @param users - the using components.
 */
export const usersInOrder = (users: readonly UsingComponent[]): UsingComponent[] =>
  [...users].sort(
    (first, second) =>
      Number(second.isDirect) - Number(first.isDirect) ||
      second.stories.length - first.stories.length ||
      first.title.localeCompare(second.title)
  );

/**
 * Several groups' usage as one: a component's users from every group, in the page's order.
 *
 * @param indexes - the groups' usage.
 */
export const mergedUsage = (indexes: readonly UsageIndex[]): UsageIndex => {
  const merged: Record<string, UsingComponent[]> = {};
  for (const index of indexes)
    for (const [title, users] of Object.entries(index)) merged[title] = [...(merged[title] ?? []), ...users];
  return Object.fromEntries(Object.entries(merged).map(([title, users]) => [title, usersInOrder(users)]));
};

/**
 * A source's usage: each group's usage module loaded and merged; an empty index when its groups have none (a
 * catalogue that turned "Used in" off, a source built before it).
 *
 * @param source - the source.
 * @returns the usage, or why a group's could not be read.
 */
export const sourceUsage = async (source: StorySource): Promise<UsageIndex | string> => {
  const loaded = await Promise.all(
    source.files.flatMap((group) => (group.usage === undefined ? [] : [group.usage()]))
  );
  const indexes: UsageIndex[] = [];
  for (const answer of loaded) {
    if (
      typeof answer === "object" &&
      answer !== null &&
      "error" in answer &&
      typeof answer.error === "string"
    )
      return answer.error;
    if (!isUsageIndex(answer)) return "A usage module answered something that is not a usage index";
    indexes.push(answer);
  }
  return mergedUsage(indexes);
};

/** Each source's loader, made once, so a page asks for its usage once and its loader keeps one identity. */
const LOADERS = new WeakMap<StorySource, () => Promise<UsageIndex | string>>();

/**
 * A source's usage loader: the same function for the same source, its answer read once.
 *
 * @param source - the source.
 */
export const usageLoader = (source: StorySource): (() => Promise<UsageIndex | string>) => {
  const known = LOADERS.get(source);
  if (known !== undefined) return known;
  let answer: Promise<UsageIndex | string> | undefined;
  const load = (): Promise<UsageIndex | string> => {
    answer ??= sourceUsage(source);
    return answer;
  };
  LOADERS.set(source, load);
  return load;
};
