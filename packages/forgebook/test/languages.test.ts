/**
 * Tests for the language a view shows, among the catalogue's.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { shownLanguage } from "../src/languages";

/** Italian, as a catalogue offers it. */
const ITALIAN: StoryLanguage = { id: "it", label: "Italiano" };

describe("shownLanguage", () => {
  it("finds the view's language among the catalogue's", () => {
    expect(shownLanguage([{ id: "fr", label: "Français" }, ITALIAN], "it")).toBe(ITALIAN);
  });

  it("is none for the stories' own text and for a language the catalogue does not offer", () => {
    expect(shownLanguage([ITALIAN], "")).toBeUndefined();
    expect(shownLanguage([], "it")).toBeUndefined();
  });
});
