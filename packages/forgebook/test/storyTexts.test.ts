/**
 * Tests for the texts the stories are drawn with in the shown language.
 *
 * @module
 */
import { filledText, isStoryTextArg, storyText, storyTextOf } from "@forgebook/story-format/texts";
import { describe, expect, it } from "vitest";

import { pseudoText, shownTexts, storyTextKeysOf, withStoryTexts } from "../src/storyTexts.ts";

const TEXTS = {
  en: { "card.title": "Projects", "card.count": "{count} rows" },
  it: { "card.title": "Progetti" }
};

describe("story texts", () => {
  it("draws the English table for the stories' own language", async () => {
    expect(await shownTexts(TEXTS, undefined)).toEqual(TEXTS.en);
  });

  it("puts a language's texts over the English ones, which fill the keys it lacks", async () => {
    expect(await shownTexts(TEXTS, { id: "it", label: "Italiano" })).toEqual({
      "card.title": "Progetti",
      "card.count": "{count} rows"
    });
  });

  it("loads a language a source gives as a loader only when it is shown", async () => {
    const loaded: string[] = [];
    const lazy = {
      en: async (): Promise<{ default: Readonly<Record<string, string>> }> => {
        loaded.push("en");
        return { default: TEXTS.en };
      },
      it: async (): Promise<{ default: Readonly<Record<string, string>> }> => {
        loaded.push("it");
        return { default: TEXTS.it };
      }
    };
    expect(await shownTexts(lazy, undefined)).toEqual(TEXTS.en);
    expect(loaded).toEqual(["en"]);
    expect((await shownTexts(lazy, { id: "it", label: "Italiano" }))["card.title"]).toBe("Progetti");
    expect(loaded).toEqual(["en", "en", "it"]);
  });

  it("pseudo-translates the English for a pseudo-language, keeping the placeholders", async () => {
    const pseudo = await shownTexts(TEXTS, {
      id: "pseudo",
      label: "Pseudo",
      isPseudo: true
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
