/**
 * Tests for the plugin's declaration: it speaks the contract and passes Forgebook's own checks.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { figma } from "../src/plugin.ts";

describe("figma", () => {
  it("offers its tab only for a story with a design", () => {
    expect(figma().tabs?.map((tab) => [tab.id, tab.when])).toEqual([["figma", { design: "figma" }]]);
  });
});
