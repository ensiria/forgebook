/**
 * The design tokens a component's page shows: the module's check, and those named after the component.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isShellTokens, tokensAbout } from "../src/shell/audiencePage.ts";

describe("tokensAbout", () => {
  const named = (...names: string[]): { name: string }[] => names.map((name) => ({ name }));

  it("finds the tokens with the component's name as a segment, in any case", () => {
    const tokens = named("select.border", "component.Select.height", "color.accent", "selection.color");
    expect(tokensAbout(tokens, "Select").map((token) => token.name)).toEqual([
      "select.border",
      "component.Select.height"
    ]);
  });

  it("reads a name of two words in kebab case too", () => {
    const tokens = named("bottom-sheet.radius", "bottomsheet.shadow", "sheet.radius");
    expect(tokensAbout(tokens, "BottomSheet").map((token) => token.name)).toEqual([
      "bottom-sheet.radius",
      "bottomsheet.shadow"
    ]);
  });
});

describe("isShellTokens", () => {
  const token = { name: "a", type: "color", value: "#000", modes: {} };

  it("takes the module's shape", () => {
    expect(isShellTokens({ tokens: [token], problems: ["a file"] })).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isShellTokens({ tokens: [{ name: "a" }], problems: [] })).toBe(false);
    expect(isShellTokens({ tokens: [token] })).toBe(false);
    expect(isShellTokens(null)).toBe(false);
  });
});
