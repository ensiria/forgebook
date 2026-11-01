/**
 * Tests for the pages a check or a picture run opens: every variant of a story about its looks, the default view only
 * of a story about logic.
 *
 * @module
 */
import type { StoryCheckRequest } from "forgebook/story-check";
import { DEFAULT_SWITCHES } from "forgebook/switches";
import { describe, expect, it } from "vitest";

import { storyPagesOf } from "../src/storyPages.ts";

/** A check of every variant of two stories, one about logic. */
const REQUEST: StoryCheckRequest = {
  frameUrl: "http://localhost:5173/frame.html",
  stories: [{ id: "kit:button--default" }, { id: "kit:hooks-use-undo--history", isLogic: true }],
  switches: DEFAULT_SWITCHES,
  lists: {},
  views: [],
  isAllVariants: true
};

describe("the pages a run opens", () => {
  it("opens every variant of a story about its looks and the default view of one about logic", () => {
    const names = storyPagesOf(REQUEST).map((page) => `${page.story.id} ${page.name}`);
    expect(names.filter((name) => name.startsWith("kit:button"))).toHaveLength(6);
    expect(names.filter((name) => name.startsWith("kit:hooks"))).toEqual([
      "kit:hooks-use-undo--history logic"
    ]);
  });

  it("opens the views asked for by name for every story", () => {
    const pages = storyPagesOf({ ...REQUEST, views: ["theme=dark"], isAllVariants: false });
    expect(pages.map((page) => `${page.story.id} ${page.name}`)).toEqual([
      "kit:button--default theme=dark",
      "kit:hooks-use-undo--history theme=dark"
    ]);
  });
});
