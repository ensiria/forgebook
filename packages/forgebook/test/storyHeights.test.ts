/**
 * Tests for the stories' measured heights as the shell reads them: the document's check, and the height at the width
 * nearest the one a story is drawn at.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isStoryHeights, knownHeight, type StoryHeights } from "../src/storyHeights.ts";

/** Two stories measured at three widths. */
const HEIGHTS: StoryHeights = {
  widths: [360, 768, 1440],
  heights: { "kit:a--one": [900, 500, 300], "kit:a--two": [120, 120, 120] }
};

describe("story heights", () => {
  it("takes the height at the measured width nearest the drawn one", () => {
    expect(knownHeight(HEIGHTS, "kit:a--one", 360)).toBe(900);
    expect(knownHeight(HEIGHTS, "kit:a--one", 600)).toBe(500);
    expect(knownHeight(HEIGHTS, "kit:a--one", 1200)).toBe(300);
    expect(knownHeight(HEIGHTS, "kit:a--one", 3000)).toBe(300);
  });

  it("has none for a story not measured or without the document", () => {
    expect(knownHeight(HEIGHTS, "kit:a--three", 768)).toBeUndefined();
    expect(knownHeight(undefined, "kit:a--one", 768)).toBeUndefined();
  });

  it("accepts the document and refuses anything else, the page a dev server answers with included", () => {
    expect(isStoryHeights(HEIGHTS)).toBe(true);
    expect(isStoryHeights({ widths: [360], heights: {} })).toBe(true);
    expect(isStoryHeights({ widths: [], heights: {} })).toBe(false);
    expect(isStoryHeights({ widths: [360, 768], heights: { "kit:a--one": [900] } })).toBe(false);
    expect(isStoryHeights({ widths: [360], heights: { "kit:a--one": ["900"] } })).toBe(false);
    expect(isStoryHeights("<!doctype html>")).toBe(false);
    expect(isStoryHeights(undefined)).toBe(false);
  });
});
