/**
 * Tests for the dev server's answer for the stories' heights before they are measured.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type HeightsFile, isMissingHeights } from "../src/vite/heightsRoute.ts";

/** The heights' file of a catalogue served at the root. */
const FILE: HeightsFile = { heights: "story-heights.json", base: "/", publicDir: "/project/public" };

describe("the heights' file before it is measured", () => {
  it("answers the file's address when the public folder lacks it", () => {
    expect(isMissingHeights("/story-heights.json", FILE, () => false)).toBe(true);
    expect(isMissingHeights("/story-heights.json?t=1", FILE, () => false)).toBe(true);
    expect(isMissingHeights("/story-heights.json", { ...FILE, publicDir: false })).toBe(true);
  });

  it("leaves the file to Vite once it exists, and every other address", () => {
    expect(
      isMissingHeights(
        "/story-heights.json",
        FILE,
        (path) => path === join("/project/public", "story-heights.json")
      )
    ).toBe(false);
    expect(isMissingHeights("/other.json", FILE, () => false)).toBe(false);
  });

  it("reads the address under the pages' base", () => {
    const based = { ...FILE, base: "/catalogue" };
    expect(isMissingHeights("/catalogue/story-heights.json", based, () => false)).toBe(true);
    expect(isMissingHeights("/story-heights.json", based, () => false)).toBe(false);
  });
});
