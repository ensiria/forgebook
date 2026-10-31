/**
 * "Used in" joined from the facts the docs worker reads (`usageGraph.ts`): for each component of a `?forgebook-files`
 * group, the other components whose stories render it or render a component whose modules import it.
 *
 * @remarks
 * A story uses a component directly when its JSX renders it, and through another when a component it renders reaches
 * the component's file through the package's own imports, followed all the way (Tree renders Row, Row renders
 * DropLine: Tree's stories use DropLine). The file of a component the story renders counts only when an import reaches
 * it, so a file's other exports are not used just for sitting beside one. The component's own stories, the components
 * its meta names in `related`, and another page of the same component (two story files with one meta component) are
 * left out. Pure: facts in, index out.
 *
 * @module
 */
import { type UsageIndex, type UsingComponent, usersInOrder } from "../usedIn.ts";
import type { ComponentRef, UsageGraph } from "./usageGraph.ts";

/** What the join knows of a story file besides its facts: its component's title and its meta's `related`. */
export type UsageFile = {
  /** The story file's absolute path. */
  readonly storyFile: string;
  /** Its title. */
  readonly title: string;
  /** The titles its meta names in `related`. */
  readonly related: readonly string[];
};

/**
 * A component's key, unique across files.
 *
 * @param ref - the component.
 */
const keyOf = (ref: ComponentRef): string => `${ref.file}#${ref.name}`;

/**
 * The files a module reaches through its imports, itself left out unless an import comes back to it.
 *
 * @param imports - the import graph.
 * @param start - the module.
 */
const reachedFrom = (imports: UsageGraph["imports"], start: string): Set<string> => {
  const reached = new Set<string>();
  const queue = [...(imports[start] ?? [])];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (reached.has(file)) continue;
    reached.add(file);
    queue.push(...(imports[file] ?? []));
  }
  return reached;
};

/**
 * Values pushed into a map's list, the list made when it is missing.
 *
 * @param map - the map.
 * @param key - the key.
 * @param value - the value.
 */
const pushed = <TValue>(map: Map<string, TValue[]>, key: string, value: TValue): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

/** The pages a component has, by its key and by its file, and each page's component. */
type Pages = {
  /** By the component's key. */
  readonly byComponent: ReadonlyMap<string, readonly UsageFile[]>;
  /** By the component's file. */
  readonly byFile: ReadonlyMap<string, readonly UsageFile[]>;
  /** Each page's component key, by its title; a page without a component has none. */
  readonly componentOf: ReadonlyMap<string, string>;
};

/**
 * The pages of the group's components.
 *
 * @param graph - the facts.
 * @param fileOf - each story file's title and `related`, by its path.
 */
const pagesOf = (graph: UsageGraph, fileOf: ReadonlyMap<string, UsageFile>): Pages => {
  const byComponent = new Map<string, UsageFile[]>();
  const byFile = new Map<string, UsageFile[]>();
  const componentOf = new Map<string, string>();
  for (const facts of graph.files) {
    const page = fileOf.get(facts.storyFile);
    if (page === undefined || facts.component === undefined) continue;
    pushed(byComponent, keyOf(facts.component), page);
    pushed(byFile, facts.component.file, page);
    componentOf.set(page.title, keyOf(facts.component));
  }
  return { byComponent, byFile, componentOf };
};

/** What the join found: by the used component's title, then by the using one's, whether directly and its stories. */
type Found = Map<string, Map<string, { isDirect: boolean; stories: string[] }>>;

/**
 * Notes that a story uses a component, unless it is the component's own, the component's meta names it in `related`,
 * or it is another page of the same component.
 *
 * @param found - what the join found so far.
 * @param pages - the group's pages.
 * @param target - the used component's page.
 * @param user - the using component's page.
 * @param story - the story's export.
 * @param isDirect - whether the story renders the component itself.
 */
const note = (
  found: Found,
  pages: Pages,
  target: UsageFile,
  user: UsageFile,
  story: string,
  isDirect: boolean
): void => {
  if (target.title === user.title || target.related.includes(user.title)) return;
  const component = pages.componentOf.get(target.title);
  if (component !== undefined && component === pages.componentOf.get(user.title)) return;
  const users = found.get(target.title) ?? new Map<string, { isDirect: boolean; stories: string[] }>();
  found.set(target.title, users);
  const entry = users.get(user.title) ?? { isDirect: false, stories: [] };
  users.set(user.title, entry);
  entry.isDirect ||= isDirect;
  if (!entry.stories.includes(story)) entry.stories.push(story);
};

/**
 * The pages a story uses: those of the components it renders (directly), those of the files they reach (through).
 *
 * @param renders - what the story renders.
 * @param pages - the group's pages.
 * @param reach - the files a module reaches.
 */
const usedBy = (
  renders: readonly ComponentRef[],
  pages: Pages,
  reach: (file: string) => ReadonlySet<string>
): { readonly target: UsageFile; readonly isDirect: boolean }[] => [
  ...renders.flatMap((ref) =>
    (pages.byComponent.get(keyOf(ref)) ?? []).map((target) => ({ target, isDirect: true }))
  ),
  ...[...new Set(renders.flatMap((ref) => [...reach(ref.file)]))].flatMap((file) =>
    (pages.byFile.get(file) ?? []).map((target) => ({ target, isDirect: false }))
  )
];

/**
 * A group's "Used in".
 *
 * @param graph - the facts the worker read.
 * @param files - each story file's title and `related`.
 */
export const joinedUsage = (graph: UsageGraph, files: readonly UsageFile[]): UsageIndex => {
  const fileOf = new Map(files.map((file) => [file.storyFile, file]));
  const pages = pagesOf(graph, fileOf);
  const reachMemo = new Map<string, Set<string>>();
  const reach = (file: string): Set<string> => {
    const known = reachMemo.get(file) ?? reachedFrom(graph.imports, file);
    reachMemo.set(file, known);
    return known;
  };
  const found: Found = new Map();
  for (const facts of graph.files) {
    const user = fileOf.get(facts.storyFile);
    if (user === undefined) continue;
    for (const story of facts.stories)
      for (const { target, isDirect } of usedBy(story.renders, pages, reach))
        note(found, pages, target, user, story.exportName, isDirect);
  }
  return Object.fromEntries(
    [...found].map(([title, users]) => [
      title,
      usersInOrder([...users].map(([user, entry]): UsingComponent => ({ title: user, ...entry })))
    ])
  );
};
