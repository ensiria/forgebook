/**
 * Tests for the texts the stories are drawn with in the shown language.
 *
 * @module
 */
import { filledText, isStoryTextArg, storyText, storyTextOf } from "@forgebook/story-format/texts";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { pseudoText, shownTexts, storyTextKeysOf, withStoryTexts } from "../src/storyTexts";

/** Draws a story as it is. */
const asItIs = (story: ReactNode): ReactNode => story;

const TEXTS = {
  en: { "card.title": "Projects", "card.count": "{count} rows" },
  it: { "card.title": "Progetti" }
};

describe("story texts", () => {
  it("draws the English table for the stories' own language", () => {
    expect(shownTexts(TEXTS, undefined)).toEqual(TEXTS.en);
  });

  it("puts a language's texts over the English ones, which fill the keys it lacks", () => {
    expect(shownTexts(TEXTS, { id: "it", label: "Italiano", wrap: asItIs })).toEqual({
      "card.title": "Progetti",
      "card.count": "{count} rows"
    });
  });

  it("pseudo-translates the English for a pseudo-language, keeping the placeholders", () => {
    const pseudo = shownTexts(TEXTS, {
      id: "pseudo",
      label: "Pseudo",
      isPseudo: true,
      wrap: asItIs
    });
    expect(pseudo["card.count"]).toMatch(/^\[\{count\} röwš·+\]$/);
    expect(pseudoText("Save")).toBe("[Šåvé··]");
  });

  it("fills placeholders, and shows a missing key in brackets", () => {
    expect(filledText("{count} rows of {total}", { count: 3 })).toBe("3 rows of {total}");
    const text = storyTextOf(TEXTS.en);
    expect(text("card.count", { count: 12 })).toBe("12 rows");
    expect(text("card.missing")).toBe("[card.missing]");
  });

  it("gives a story the text an arg names, its placeholders filled, and the panel its key", () => {
    const args = { title: storyText("card.title"), count: storyText("card.count", { count: 4 }), size: "sm" };
    expect(isStoryTextArg(args.title)).toBe(true);
    expect(isStoryTextArg({ named: "IconFolder" })).toBe(false);
    expect(withStoryTexts(args, storyTextOf(TEXTS.en))).toEqual({
      title: "Projects",
      count: "4 rows",
      size: "sm"
    });
    expect(storyTextKeysOf(args)).toEqual({ title: "card.title", count: "card.count" });
  });

  it("hands back args that name no text as they are", () => {
    const args = { size: "sm" };
    expect(withStoryTexts(args, storyTextOf(TEXTS.en))).toBe(args);
    expect(storyTextKeysOf(args)).toEqual({});
  });
});
