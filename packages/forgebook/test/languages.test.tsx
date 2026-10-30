/**
 * Tests for the languages a story can be drawn in.
 *
 * @module
 */

import type { StoryLanguage } from "@ensiria/story-format/source";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { storyLanguages } from "../src/languages";

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
