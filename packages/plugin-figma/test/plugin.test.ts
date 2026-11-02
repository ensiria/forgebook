/**
 * Tests for the plugin's declaration: it speaks the contract and passes Forgebook's own checks.
 *
 * @module
 */
import { pluginsProblem } from "forgebook/vite/plugin-config";
import { describe, expect, it } from "vitest";

import { figma } from "../src/plugin.ts";

describe("figma", () => {
  it("is a plugin a catalogue can list", () => {
    expect(pluginsProblem([figma()], "react")).toBeUndefined();
  });

  it("offers its tab only for a story with a design", () => {
    expect(figma().tabs?.map((tab) => [tab.id, tab.when])).toEqual([["design", { parameter: "design" }]]);
  });
});
