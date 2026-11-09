/**
 * The tests the browser suite declares for each story: a story about its looks in every variant, with the layout
 * checks; a story about logic (`parameters.logic`) once, in the catalogue's default view or the first view of a run
 * that names its own variants, without them, and never pictured.
 *
 * @remarks
 * A logic story is a hook's or a function's scene: the variants (themes, contrast, the structure only, a narrow frame)
 * change how it looks, which is not what it is there for. Its one test still waits for the frame to be ready, so its
 * play has to pass, checks the console and the page for errors, and runs axe, since its scene is a page a person uses.
 * The checks about looks are left out: the spills and the overlays (layout at the variants' widths) and the source's
 * own check (a rule of its components, which a hook's scene borrows only to be usable). `forgebook check` follows the
 * same rule (`hasLookChecks`). Pure, so the suite's shape is tested without a browser.
 *
 * @module
 */
import type { TreeStory } from "forgebook/story-tree";

import type { StoryVariant } from "./browserTests.ts";

/** The one variant a logic story is tested in: the catalogue's default view. */
export const LOGIC_VARIANT: StoryVariant = { name: "logic", view: {} };

/**
 * The one variant a logic story is tested in within a run: a run that names its own variants may hold what the default
 * view cannot draw on (a dark system scheme, forced colours), so the story takes the view of that run's first variant,
 * or it would draw light values on a dark canvas and report contrast no page has. Its width stays the test browser's:
 * that is a layout's, and a logic story's layout is not checked.
 *
 * @param ownVariants - the variants the run names; none for those of the catalogue.
 * @returns the variant, named `logic` either way.
 */
export const logicVariantOf = (ownVariants: readonly StoryVariant[] | undefined): StoryVariant => {
  const first = ownVariants?.[0];
  return first === undefined ? LOGIC_VARIANT : { name: LOGIC_VARIANT.name, view: first.view };
};

/** One test the suite declares. */
export type PlannedStoryTest = {
  /** The story. */
  readonly story: TreeStory;
  /** The variant it is drawn in. */
  readonly variant: StoryVariant;
  /** Whether the checks about looks run (spills, overlays, the source's own check): only for a story about its looks. */
  readonly hasLookChecks: boolean;
};

/**
 * Whether a story gets the checks about looks: every story but one about logic.
 *
 * @param story - the story, as the tree or a check request gives it.
 */
export const hasLookChecks = (story: { readonly isLogic?: boolean }): boolean => story.isLogic !== true;

/**
 * The tests of some stories, in their order, each story's variants in theirs.
 *
 * @param stories - the stories.
 * @param variants - the variants a story about its looks is tested in.
 * @param isScreenshot - whether the run compares reference images instead of running the checks.
 * @param logicVariant - the variant a story about logic is tested in; the catalogue's default view by default.
 */
export const plannedStoryTests = (
  stories: readonly TreeStory[],
  variants: readonly StoryVariant[],
  isScreenshot: boolean,
  logicVariant: StoryVariant = LOGIC_VARIANT
): PlannedStoryTest[] =>
  stories.flatMap((story): PlannedStoryTest[] => {
    if (hasLookChecks(story)) return variants.map((variant) => ({ story, variant, hasLookChecks: true }));
    return isScreenshot ? [] : [{ story, variant: logicVariant, hasLookChecks: false }];
  });
