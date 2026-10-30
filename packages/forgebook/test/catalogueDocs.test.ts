/**
 * Tests for `forgebook-docs`' reading of Sass modules and style sheets; its components, read by a framework, are
 * tested in that framework's package (`@forgebook/react`).
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { sassMembers, styleSheetSummary } from "../bin/forgebook-docs/sassDocs";

describe("sassDocs", () => {
  it("reads every documented member with its parameters and its summary across lines", () => {
    expect(
      sassMembers("/// One.\n/// Two.\n/// @param x\n@mixin a(\n  $x,\n  $y: 1px\n) {}\n@function b() {}")
    ).toEqual([
      { kind: "mixin", name: "a", parameters: ["$x", "$y"], summary: "One. Two." },
      { kind: "function", name: "b", parameters: [], summary: "" }
    ]);
  });

  it("gives a style sheet the first sentence of its leading comment", () => {
    expect(styleSheetSummary('// The sheet. More words.\n// Still the comment.\n@use "x";')).toBe(
      "The sheet."
    );
  });
});
