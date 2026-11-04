/**
 * Tests for the backdrops: the colour the shell gives a loading story's box, and the sheet the frame draws one with,
 * Forgebook's pictures and a catalogue's own layers.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type Backdrop, BUILT_IN_BACKDROPS, backdropColor, customBackdrop } from "../src/backdrops.ts";
import { BUILT_IN_PICTURES, backdropSheet } from "../src/frame/backdropPictures.ts";

/**
 * One of Forgebook's backdrops, by its id.
 *
 * @param id - its id.
 */
const builtIn = (id: string): Backdrop => {
  const found = BUILT_IN_BACKDROPS.find((backdrop) => backdrop.id === id);
  if (found === undefined) throw new Error(`no backdrop ${id}`);
  return found;
};

describe("backdropColor", () => {
  it("is none for the page's own colour, fixed for a desktop picture, the theme's for the page of content", () => {
    expect(backdropColor(undefined, true)).toBeUndefined();
    expect(backdropColor(builtIn("darkDesktop"), false)).toBe("#0d1226");
    expect(backdropColor(builtIn("darkDesktop"), true)).toBe("#0d1226");
    expect(backdropColor(builtIn("content"), false)).toBe("#ffffff");
    expect(backdropColor(builtIn("content"), true)).toBe("#16181d");
  });

  it("takes a catalogue's own colours, the light one in the dark scheme when it sets no dark one", () => {
    const paper = customBackdrop({ id: "paper", label: "Paper", light: { color: "#fffdf5" } });
    const ink = customBackdrop({
      id: "ink",
      label: "Ink",
      light: { color: "#fff" },
      dark: { color: "#101010", layers: "linear-gradient(#000, #222)" }
    });
    expect(backdropColor(paper, true)).toBe("#fffdf5");
    expect(backdropColor(ink, true)).toBe("#101010");
  });
});

describe("backdropSheet", () => {
  it("draws nothing for the page's own colour", () => {
    expect(backdropSheet(undefined, "dark")).toBe("");
  });

  it("draws a fixed picture with one rule in every scheme, only without forced colours", () => {
    const sheet = `@media (forced-colors: none) { body { background: ${BUILT_IN_PICTURES.checkerboard.light}, #ffffff !important; } }`;
    expect(backdropSheet(builtIn("checkerboard"), "light")).toBe(sheet);
    expect(backdropSheet(builtIn("checkerboard"), "dark")).toBe(sheet);
    expect(backdropSheet(builtIn("checkerboard"), "system")).toBe(sheet);
  });

  it("follows the scheme for the page of content: the dark look alone, or both with the system's", () => {
    const { light, dark } = BUILT_IN_PICTURES.content;
    expect(light).not.toBe(dark);
    expect(backdropSheet(builtIn("content"), "dark")).toBe(
      `@media (forced-colors: none) { body { background: ${dark}, #16181d !important; } }`
    );
    expect(backdropSheet(builtIn("content"), "system").split("\n")).toEqual([
      `@media (forced-colors: none) { body { background: ${light}, #ffffff !important; } }`,
      `@media (forced-colors: none) and (prefers-color-scheme: dark) { body { background: ${dark}, #16181d !important; } }`
    ]);
  });

  it("draws a catalogue's own layers, none when it sets only a colour", () => {
    const ink = customBackdrop({
      id: "ink",
      label: "Ink",
      light: { color: "#fff" },
      dark: { color: "#101010", layers: "linear-gradient(#000, #222)" }
    });
    expect(backdropSheet(ink, "dark")).toBe(
      "@media (forced-colors: none) { body { background: linear-gradient(#000, #222), #101010 !important; } }"
    );
    expect(backdropSheet(ink, "light")).toBe(
      "@media (forced-colors: none) { body { background: none, #fff !important; } }"
    );
  });
});
