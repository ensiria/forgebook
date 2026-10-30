/**
 * Tests for the colour a story's box waits on: its source's page colour for the view's theme and contrast.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue";
import { storyBackground } from "../src/storyBackground";
import { DEFAULT_SWITCHES } from "../src/switches";

/** A catalogue with the default switches and backgrounds. */
const CATALOGUE = catalogueSettings("", DEFAULT_SWITCHES);

const BACKGROUND = { light: "#fafafa", dark: "#111111", darkMore: "#000000" };

describe("storyBackground", () => {
  it("takes the theme's colour, and the more-contrast one where the source gives it", () => {
    expect(
      storyBackground(
        BACKGROUND,
        { switches: { theme: "light", contrast: "standard" }, backdrop: "plain" },
        CATALOGUE,
        false
      )
    ).toBe("#fafafa");
    expect(
      storyBackground(
        BACKGROUND,
        { switches: { theme: "dark", contrast: "more" }, backdrop: "plain" },
        CATALOGUE,
        false
      )
    ).toBe("#000000");
    // no lightMore: the light theme's colour
    expect(
      storyBackground(
        BACKGROUND,
        { switches: { theme: "light", contrast: "more" }, backdrop: "plain" },
        CATALOGUE,
        false
      )
    ).toBe("#fafafa");
  });

  it("follows the system for the system theme, and has none for a source without colours", () => {
    expect(
      storyBackground(
        BACKGROUND,
        { switches: { theme: "system", contrast: "standard" }, backdrop: "plain" },
        CATALOGUE,
        true
      )
    ).toBe("#111111");
    expect(
      storyBackground(
        BACKGROUND,
        { switches: { theme: "system", contrast: "standard" }, backdrop: "plain" },
        CATALOGUE,
        false
      )
    ).toBe("#fafafa");
    expect(
      storyBackground(
        undefined,
        { switches: { theme: "dark", contrast: "standard" }, backdrop: "plain" },
        CATALOGUE,
        true
      )
    ).toBeUndefined();
  });
});
