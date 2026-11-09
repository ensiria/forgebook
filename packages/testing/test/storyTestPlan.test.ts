/**
 * Tests for the tests the suite declares per story: every look of a story about its looks, one test of a story about
 * logic, and no reference image of one.
 *
 * @module
 */
import type { TreeStory } from "forgebook/story-tree";
import { describe, expect, it } from "vitest";

import type { StoryVariant } from "../src/browserTests.ts";
import { hasLookChecks, LOGIC_VARIANT, logicVariantOf, plannedStoryTests } from "../src/storyTestPlan.ts";

/** The variants of a catalogue: two themes and a narrow frame. */
const VARIANTS: readonly StoryVariant[] = [
  { name: "light", view: { switches: { theme: "light" } } },
  { name: "dark", view: { switches: { theme: "dark" } } },
  { name: "narrow", view: { switches: { theme: "light" } }, width: 560 }
];

/**
 * A story of the tree.
 *
 * @param id - its id.
 * @param isLogic - whether it is about logic.
 */
const storyOf = (id: string, isLogic: boolean): TreeStory => ({
  id,
  file: "a.stories.tsx",
  name: id,
  exportName: id,
  controls: "all",
  group: undefined,
  description: undefined,
  isMain: false,
  isTouch: false,
  isLogic,
  height: undefined,
  device: undefined,
  design: undefined,
  tags: [],
  hasPlay: false,
  requiredFirst: undefined
});

/**
 * The tests planned, as `story · variant` and whether the layout is checked.
 *
 * @param stories - the stories.
 * @param isScreenshot - whether the run compares reference images.
 */
const planned = (stories: readonly TreeStory[], isScreenshot: boolean): string[] =>
  plannedStoryTests(stories, VARIANTS, isScreenshot).map(
    (each) => `${each.story.id} · ${each.variant.name}${each.hasLookChecks ? " · layout" : ""}`
  );

describe("the checks about looks", () => {
  it("run on every story but one about logic, as the tree or a check request gives it", () => {
    expect(hasLookChecks({ isLogic: true })).toBe(false);
    expect(hasLookChecks({ isLogic: false })).toBe(true);
    expect(hasLookChecks({})).toBe(true);
  });
});

describe("the tests of each story", () => {
  it("tests a story about its looks in every variant, its layout checked", () => {
    expect(planned([storyOf("button", false)], false)).toEqual([
      "button · light · layout",
      "button · dark · layout",
      "button · narrow · layout"
    ]);
  });

  it("tests a story about logic once, in the default view, without the layout checks", () => {
    expect(planned([storyOf("undo", true)], false)).toEqual(["undo · logic"]);
    expect(LOGIC_VARIANT).toEqual({ name: "logic", view: {} });
  });

  it("draws a story about logic in the first view of a run that names its own variants", () => {
    const dark = { name: "forced-dark", view: { switches: { theme: "dark" } }, width: 480 };
    const [test] = plannedStoryTests([storyOf("undo", true)], [dark], false, logicVariantOf([dark]));
    expect(test?.variant).toEqual({ name: "logic", view: { switches: { theme: "dark" } } });
    expect(test?.hasLookChecks).toBe(false);
  });

  it("keeps the catalogue's default view for a story about logic when the run names no variants", () => {
    expect(logicVariantOf(undefined)).toBe(LOGIC_VARIANT);
    expect(logicVariantOf([])).toBe(LOGIC_VARIANT);
  });

  it("pictures only the stories about their looks", () => {
    expect(planned([storyOf("button", false), storyOf("undo", true)], true)).toEqual([
      "button · light · layout",
      "button · dark · layout",
      "button · narrow · layout"
    ]);
  });
});
