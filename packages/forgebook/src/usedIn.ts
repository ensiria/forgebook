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

/**
 * A usage index as a module writes it: each title and each list of stories once, the pairs pointing at them. In a
 * library whose components all reach one another through a barrel, the plain index names every story of every
 * component once per component it uses: megabytes, on a dev server's thread and down to the page. Packed, it still
 * grows with the pairs of a component and a user, which in such a library is the square of its components: three
 * numbers a pair, where the plain index wrote every story's name.
 */
export type PackedUsage = {
  /** The titles, each once. */
  readonly titles: readonly string[];
  /** The lists of stories, each once. */
  readonly lists: readonly (readonly string[])[];
  /** For each used component's title, its users: the user's title, whether directly (1) or not (0), its stories. */
  readonly users: Readonly<
    Record<string, readonly (readonly [title: number, isDirect: number, list: number])[]>
  >;
};

/**
 * A usage index written once per title and list.
 *
 * @param index - the index.
 */
export const packedUsage = (index: UsageIndex): PackedUsage => {
  const titles: string[] = [];
  const lists: (readonly string[])[] = [];
  const titleAt = new Map<string, number>();
  const listAt = new Map<string, number>();
  const at = <TValue>(value: TValue, key: string, known: Map<string, number>, all: TValue[]): number => {
    const found = known.get(key);
    if (found !== undefined) return found;
    known.set(key, all.length);
    all.push(value);
    return all.length - 1;
  };
  const users = Object.fromEntries(
    Object.entries(index).map(([title, using]) => [
      title,
      using.map(
        (user) =>
          [
            at(user.title, user.title, titleAt, titles),
            user.isDirect ? 1 : 0,
            at(user.stories, user.stories.join("\n"), listAt, lists)
          ] as const
      )
    ])
  );
  return { titles, lists, users };
};

/**
 * Whether a module's answer is a packed usage index.
 *
 * @param value - what the module exports by default.
 */
const isPackedUsage = (value: unknown): value is PackedUsage =>
  typeof value === "object" &&
  value !== null &&
  "titles" in value &&
  Array.isArray(value.titles) &&
  "lists" in value &&
  Array.isArray(value.lists) &&
  "users" in value &&
  typeof value.users === "object" &&
  value.users !== null &&
  // a plain index has a list under every title, so one with components named like these fields is told apart
  !Array.isArray(value.users);

/**
 * Whether a value is a packed user: three whole numbers.
 *
 * @param value - an entry of a packed index's users.
 */
const isPackedUser = (value: unknown): value is readonly [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every((each) => Number.isInteger(each));

/**
 * A packed index as the page reads it; a list of stories repeated is one array, shared.
 *
 * @param packed - the packed index.
 * @returns the index, or none when it is not one: an entry that is not three numbers, or points past its lists.
 */
export const unpackedUsage = (packed: PackedUsage): UsageIndex | undefined => {
  // a module's answer is read from outside the type system: every part is checked before it is used
  const users: Readonly<Record<string, unknown>> = packed.users;
  // each list checked once: a library's pairs share a few lists
  const lists = packed.lists.map((list) => (isStrings(list) ? list : undefined));
  const index: Record<string, UsingComponent[]> = {};
  for (const [title, entries] of Object.entries(users)) {
    if (!Array.isArray(entries)) return undefined;
    const using: UsingComponent[] = [];
    for (const entry of entries) {
      if (!isPackedUser(entry)) return undefined;
      const [user, isDirect, list] = entry;
      const userTitle: unknown = packed.titles[user];
      const stories = lists[list];
      if (typeof userTitle !== "string" || stories === undefined) return undefined;
      using.push({ title: userTitle, isDirect: isDirect === 1, stories });
    }
    index[title] = using;
  }
  return index;
};

/**
 * A module's answer as an index: packed, as the plugin writes it, or plain.
 *
 * @param answer - what the module exports by default.
 */
const readUsage = (answer: unknown): UsageIndex | undefined => {
  if (isPackedUsage(answer)) return unpackedUsage(answer);
  return isUsageIndex(answer) ? answer : undefined;
};

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
    const index = readUsage(answer);
    if (index === undefined) return "A usage module answered something that is not a usage index";
    indexes.push(index);
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
