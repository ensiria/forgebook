/**
 * The tests the browser suite declares for each story: a story about its looks in every variant, with the layout
 * checks; a story about logic (`parameters.logic`) once, in the catalogue's default view, without them, and never
 * pictured.
 *
 * @remarks
 * A logic story is a hook's or a function's scene: the variants (themes, contrast, the structure only, a narrow frame)
 * change how it looks, which is not what it is there for. Its one test still waits for the frame to be ready, so its
 * play has to pass, checks the console and the page for errors, and runs axe, since its scene is a page a person uses.
 * The spill and overlay checks are about layout at the variants' widths, so they are left out. Pure, so the suite's
 * shape is tested without a browser.
 *
 * @module
 */
import type { TreeStory } from "forgebook/story-tree";

import type { StoryVariant } from "./browserTests.ts";

/** The one variant a logic story is tested in: the catalogue's default view. */
export const LOGIC_VARIANT: StoryVariant = { name: "logic", view: {} };

/** One test the suite declares. */
export type PlannedStoryTest = {
  /** The story. */
  readonly story: TreeStory;
  /** The variant it is drawn in. */
  readonly variant: StoryVariant;
  /** Whether the layout checks run (spills, overlays): only for a story about its looks. */
  readonly isLayoutChecked: boolean;
};

/**
 * The tests of some stories, in their order, each story's variants in theirs.
 *
 * @param stories - the stories.
 * @param variants - the variants a story about its looks is tested in.
 * @param isScreenshot - whether the run compares reference images instead of running the checks.
 */
export const plannedStoryTests = (
  stories: readonly TreeStory[],
  variants: readonly StoryVariant[],
  isScreenshot: boolean
): PlannedStoryTest[] =>
  stories.flatMap((story): PlannedStoryTest[] => {
    if (!story.isLogic) return variants.map((variant) => ({ story, variant, isLayoutChecked: true }));
    return isScreenshot ? [] : [{ story, variant: LOGIC_VARIANT, isLayoutChecked: false }];
  });
