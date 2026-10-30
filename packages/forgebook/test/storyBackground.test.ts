/**
 * Tests for the colour a story's box waits on: its source's page colour for the view's theme and contrast.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyBackground } from "../src/storyBackground";

const BACKGROUND = { light: "#fafafa", dark: "#111111", darkMore: "#000000" };

describe("storyBackground", () => {
  it("takes the theme's colour, and the more-contrast one where the source gives it", () => {
    expect(
      storyBackground(BACKGROUND, { theme: "light", isMoreContrast: false, backdrop: "plain" }, false)
    ).toBe("#fafafa");
    expect(
      storyBackground(BACKGROUND, { theme: "dark", isMoreContrast: true, backdrop: "plain" }, false)
    ).toBe("#000000");
    // no lightMore: the light theme's colour
    expect(
      storyBackground(BACKGROUND, { theme: "light", isMoreContrast: true, backdrop: "plain" }, false)
    ).toBe("#fafafa");
  });

  it("follows the system for the system theme, and has none for a source without colours", () => {
    expect(
      storyBackground(BACKGROUND, { theme: "system", isMoreContrast: false, backdrop: "plain" }, true)
    ).toBe("#111111");
    expect(
      storyBackground(BACKGROUND, { theme: "system", isMoreContrast: false, backdrop: "plain" }, false)
    ).toBe("#fafafa");
    expect(
      storyBackground(undefined, { theme: "dark", isMoreContrast: false, backdrop: "plain" }, true)
    ).toBeUndefined();
  });
});
