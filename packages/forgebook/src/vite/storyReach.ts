/**
 * Which stories a change touches: each story with the files it reaches, and from changed files back to stories.
 *
 * @remarks
 * Pure, on the same graph "Used in" reads (`usageGraph.ts`), so what cannot be followed there cannot be followed here: a
 * computed lazy import, a component handed in as a prop. A story file reaches its meta's component whatever its stories
 * render, since a story with no JSX draws that component. Style sheets and other files outside the graph are not known
 * to reach anything: `verify` says so by checking the stories it can name, not by claiming the rest are safe.
 *
 * @module
 */
import type { UsageGraph } from "./usageGraph.ts";

/** A story file's title, to name its stories by. */
export type ReachFile = {
  /** The story file's absolute path. */
  readonly storyFile: string;
  /** Its title. */
  readonly title: string;
};

/** A story with what it reaches. */
export type ReachedStory = {
  /** Its component's title. */
  readonly title: string;
  /** Its export. */
  readonly exportName: string;
  /** Every file it reaches, its own story file included, absolute. */
  readonly files: readonly string[];
};

/** The files a module reaches, itself included, through the graph's imports. */
const reachedFrom = (imports: UsageGraph["imports"], starts: readonly string[]): Set<string> => {
  const reached = new Set<string>();
  const queue = [...starts];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (reached.has(file)) continue;
    reached.add(file);
    queue.push(...(imports[file] ?? []));
  }
  return reached;
};

/**
 * Each story with the files it reaches.
 *
 * @param graph - what the stories render and what the modules import.
 * @param files - each story file's title.
 */
export const storyReach = (graph: UsageGraph, files: readonly ReachFile[]): ReachedStory[] => {
  const titles = new Map(files.map((file) => [file.storyFile, file.title]));
  return graph.files.flatMap((file) =>
    file.stories.map((story) => ({
      title: titles.get(file.storyFile) ?? "",
      exportName: story.exportName,
      files: [
        ...reachedFrom(graph.imports, [
          file.storyFile,
          ...(file.component === undefined ? [] : [file.component.file]),
          ...story.renders.map((ref) => ref.file)
        ])
      ]
    }))
  );
};

/**
 * The stories that reach any of the changed files, each once, in the graph's order.
 *
 * @param reach - each story with what it reaches.
 * @param changed - the changed files, absolute.
 */
export const affectedStories = (
  reach: readonly ReachedStory[],
  changed: readonly string[]
): ReachedStory[] => {
  const files = new Set(changed);
  return reach.filter((story) => story.files.some((file) => files.has(file)));
};
