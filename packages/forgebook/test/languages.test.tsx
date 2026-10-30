/**
 * Tests for the languages a story can be drawn in.
 *
 * @module
 */

import type { StoryLanguage } from "@forgebook/story-format/source";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { shownLanguage, storyLanguages } from "../src/languages";

/** A language whose wrapper marks the story with a name. */
const language = (id: string, mark: string): StoryLanguage => ({
  id,
  label: id,
  wrap: (story: ReactNode): ReactNode => <div data-mark={mark}>{story}</div>
});

describe("storyLanguages", () => {
  it("offers the catalogue's languages to every source, then the source's own", () => {
    const languages = storyLanguages([language("it", "catalogue")], [language("pseudo", "source")]);
    expect(languages.map((entry) => entry.id)).toEqual(["it", "pseudo"]);
  });

  it("keeps one language per id, with the source's wrapper", () => {
    const own = language("it", "source");
    const languages = storyLanguages([language("it", "catalogue"), language("de", "catalogue")], [own]);
    expect(languages.map((entry) => entry.id)).toEqual(["it", "de"]);
    expect(languages[0]).toBe(own);
  });

  it("offers none when neither does", () => {
    expect(storyLanguages([], [])).toEqual([]);
  });
});

describe("shownLanguage", () => {
  it("finds the view's language among the story's", () => {
    const italian = language("it", "catalogue");
    expect(shownLanguage([language("fr", "catalogue"), italian], "it")).toBe(italian);
  });

  it("is none for the stories' own text and for a language the story does not offer", () => {
    expect(shownLanguage([language("it", "catalogue")], "")).toBeUndefined();
    expect(shownLanguage([], "it")).toBeUndefined();
  });
});
