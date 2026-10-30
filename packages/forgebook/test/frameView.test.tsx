/**
 * Tests for the frame's view: a story drawn in the view's language when its source offers it.
 *
 * @module
 */

import type { StoryLanguage } from "@ensiria/story-format/source";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { inLanguage } from "../src/frame/frameView";
import { DEFAULT_VIEW } from "../src/viewState";

/** A language that marks its stories. */
const PSEUDO: StoryLanguage = {
  id: "pseudo",
  label: "Pseudo",
  wrap: (story: ReactNode): ReactNode => <div lang="x-pseudo">{story}</div>
};

describe("inLanguage", () => {
  it("wraps the story in the chosen language's provider", () => {
    const html = renderToString(inLanguage([PSEUDO], { ...DEFAULT_VIEW, language: "pseudo" }, <p>Story</p>));
    expect(html).toBe('<div lang="x-pseudo"><p>Story</p></div>');
  });

  it("draws the story as it is for its own text or a language the source does not offer", () => {
    expect(renderToString(inLanguage([PSEUDO], DEFAULT_VIEW, <p>Story</p>))).toBe("<p>Story</p>");
    expect(renderToString(inLanguage([], { ...DEFAULT_VIEW, language: "pseudo" }, <p>Story</p>))).toBe(
      "<p>Story</p>"
    );
  });
});
