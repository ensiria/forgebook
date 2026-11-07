/**
 * How a story run waits for what its framework says the story loads, and how the story ended: what a play starts from and
 * what the frame's status says.
 *
 * @remarks
 * The frame only asks (`MountedStory.settled`); reading what is pending is the framework's. A framework with nothing to
 * say costs nothing here, and its stories are ready once drawn.
 *
 * @module
 */
import type { ContentState, MountedStory } from "./renderer.ts";
import type { LoadedStory } from "./storyModule.ts";

/** How a story's first drawing ended: what the frame's status says. */
export type StoryOutcome =
  /** It is shown, with everything it waits for, and its play is over. */
  | { readonly status: "ready" }
  /** It threw meanwhile, and shows its error. */
  | { readonly status: "error" }
  /** The wait ended with something still loading, or the framework cannot tell: this says which. */
  | { readonly status: "pending"; readonly reason: string };

/** What a story that waits for nothing has to say. */
const SETTLED: ContentState = { state: "settled" };

/**
 * Waits for what a story loads, as it says it should be waited for.
 *
 * @param mounted - the story, drawn.
 * @param story - its settings.
 * @param timeout - the most to wait, in milliseconds; the story's bound by default.
 */
export const contentOf = async (
  mounted: MountedStory,
  { suspense }: LoadedStory,
  timeout = suspense.timeout
): Promise<ContentState> => {
  if (suspense.isExpected || mounted.settled === undefined) return SETTLED;
  try {
    return await mounted.settled(timeout);
  } catch (error) {
    // an adapter that fails while it looks has not looked: never read as nothing pending, and a frame still answers
    return { state: "unknown", reason: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Waits for a story's first drawing, within its bound, for a framework that has a wait to bound: a part that suspends
 * with no boundary around it holds React's first commit, and that must end as a frame's answer, not as its silence. A
 * framework with no wait keeps the frame waiting as long as it draws (a compiler loading on first use).
 *
 * @param mounted - the story.
 * @param story - its settings.
 * @returns what it still waits for, none once drawn.
 */
const drawnWithin = async (mounted: MountedStory, { suspense }: LoadedStory): Promise<ContentState> => {
  if (suspense.isExpected || mounted.settled === undefined) {
    await mounted.drawn;
    return SETTLED;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<ContentState>((resolve) => {
    timer = setTimeout(
      () => resolve({ state: "waiting", reason: "The story's first drawing still waits for what it loads" }),
      suspense.timeout
    );
  });
  const drawn = mounted.drawn.then((): ContentState => SETTLED);
  return Promise.race([drawn, late]).finally(() => clearTimeout(timer));
};

/**
 * Waits for a story's first drawing and for what it loads, which share one bound, as what a play starts from.
 *
 * @param mounted - the story.
 * @param story - its settings.
 */
export const contentBeforePlay = async (mounted: MountedStory, story: LoadedStory): Promise<ContentState> => {
  const start = performance.now();
  const first = await drawnWithin(mounted, story);
  if (first.state !== "settled") return first;
  return contentOf(mounted, story, Math.max(0, story.suspense.timeout - (performance.now() - start)));
};

/**
 * How a story ended, by what it waited for and whether it shows an error.
 *
 * @param content - the last look at what it loads.
 * @param isFailed - whether it shows an error now.
 * @param timeout - how long the frame waited, in milliseconds.
 */
export const outcomeOf = (content: ContentState, isFailed: boolean, timeout: number): StoryOutcome => {
  if (isFailed) return { status: "error" };
  if (content.state === "settled") return { status: "ready" };
  if (content.state === "unknown") return { status: "pending", reason: content.reason };
  return {
    status: "pending",
    reason: `${content.reason} after ${timeout} ms. A story meant to stay there sets parameters.suspense.expected; parameters.suspense.timeout waits longer`
  };
};
