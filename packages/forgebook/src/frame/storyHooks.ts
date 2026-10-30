/**
 * What runs before a story is drawn, as CSF orders it: its loaders, then its set-ups (`beforeEach`), each set-up's
 * cleanup kept to run when the story is mounted again or left. The frame and the server tests prepare a story the same
 * way.
 *
 * @remarks
 * The loaders run at once and their results merge in their order (the preview's, the meta's, the story's: a later key
 * wins); the set-ups run one after another, after the loaders, and see what they loaded. A set-up that throws undoes
 * the ones before it, so a failed story leaves nothing behind.
 *
 * @module
 */

import type { StoryHookContext } from "@forgebook/story-format/csf";

import type { LoadedArgs, LoadedStory } from "./storyModule.ts";

/** A story ready to be drawn: what its loaders returned, and how to undo its set-ups. */
export type PreparedStory = {
  /** What the loaders returned, merged: the story's `context.loaded`. */
  readonly loaded: Readonly<Record<string, unknown>>;
  /** Runs the set-ups' cleanups, the last set-up's first. */
  readonly cleanup: () => Promise<void>;
};

/** Whether a loader's result is an object whose keys reach `context.loaded`. */
const isLoaded = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Runs cleanups, the last one first; every one runs even when an earlier one throws, and the first error is thrown
 * after them.
 *
 * @param cleanups - the cleanups, in the order their set-ups ran.
 */
const runCleanups = async (cleanups: readonly (() => Promise<void> | void)[]): Promise<void> => {
  const errors: unknown[] = [];
  for (const cleanup of [...cleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw errors[0];
};

/**
 * Runs a story's loaders and set-ups.
 *
 * @param story - the story.
 * @param context - its args and what it is shown with; `loaded` is filled in here.
 * @returns what it loaded and how to undo its set-ups.
 * @throws What a loader or a set-up throws, after undoing the set-ups that ran.
 */
export const prepareStory = async (
  story: Pick<LoadedStory, "loaders" | "beforeEach">,
  context: Omit<StoryHookContext<LoadedArgs>, "loaded">
): Promise<PreparedStory> => {
  const results = await Promise.all(story.loaders.map((loader) => loader({ ...context, loaded: {} })));
  const loaded: Readonly<Record<string, unknown>> = Object.assign({}, ...results.filter(isLoaded));
  const cleanups: (() => Promise<void> | void)[] = [];
  try {
    for (const beforeEach of story.beforeEach) {
      const cleanup = await beforeEach({ ...context, loaded });
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
  } catch (error) {
    await runCleanups(cleanups);
    throw error;
  }
  return { loaded, cleanup: () => runCleanups(cleanups) };
};
