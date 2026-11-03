/**
 * Tests for what a story about logic leaves out: the controls that only change its looks, and Compare.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isLookControl, logicView, logicViewChange } from "../src/shell/logicView.ts";
import { isLogicComponent, type TreeStory } from "../src/storyTree.ts";
import { DEFAULT_VIEW, type ViewState } from "../src/viewState.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

/**
 * A story of the tree.
 *
 * @param isLogic - whether it is about logic.
 */
const storyOf = (isLogic: boolean): TreeStory => ({
  id: "kit:a--b",
  file: "a.stories.tsx",
  name: "B",
  exportName: "B",
  controls: "all",
  group: undefined,
  description: undefined,
  isMain: false,
  isTouch: false,
  isLogic,
  height: undefined,
  device: undefined,
  design: undefined,
  tags: []
});

describe("a story about logic", () => {
  it("puts away the controls that only change its looks, and keeps the others", () => {
    expect(
      ["theme", "contrast", "backdrop", "sheets", "text"].map((id) => isLookControl(id, FIXTURE_SWITCHES))
    ).toEqual([true, true, true, true, true]);
    expect(
      ["width", "lang", "dir", "touch", "motion"].map((id) => isLookControl(id, FIXTURE_SWITCHES))
    ).toEqual([false, false, false, false, false]);
  });

  it("is never compared, and the address keeps its compare", () => {
    const comparing: ViewState = { ...DEFAULT_VIEW, compare: ["theme"] };
    expect(logicView(comparing, true).compare).toEqual([]);
    expect(logicView(comparing, false)).toBe(comparing);
    const changed: ViewState = { ...DEFAULT_VIEW, zoom: 150 };
    expect(logicViewChange(changed, comparing, true)).toEqual({ ...changed, compare: ["theme"] });
    expect(logicViewChange(changed, comparing, false)).toBe(changed);
  });

  it("makes a component about logic only when every story of its file is", () => {
    expect(isLogicComponent({ stories: [storyOf(true), storyOf(true)], unlisted: [] })).toBe(true);
    expect(isLogicComponent({ stories: [storyOf(true), storyOf(false)], unlisted: [] })).toBe(false);
    // an unlisted story about its looks keeps the component's props, and a component lists a story to be marked
    expect(isLogicComponent({ stories: [storyOf(true)], unlisted: [storyOf(false)] })).toBe(false);
    expect(isLogicComponent({ stories: [], unlisted: [storyOf(true)] })).toBe(false);
  });
});
