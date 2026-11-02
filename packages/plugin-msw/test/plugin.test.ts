/**
 * Tests for the plugin's declaration: it speaks the contract and passes Forgebook's own checks.
 *
 * @module
 */
import { pluginsProblem } from "forgebook/vite/plugin-config";
import { describe, expect, it } from "vitest";

import { msw } from "../src/plugin.ts";

describe("msw", () => {
  it("is a plugin a catalogue can list, in any framework", () => {
    expect(pluginsProblem([msw()], "react")).toBeUndefined();
    expect(pluginsProblem([msw()], "vue")).toBeUndefined();
  });

  it("offers its tab only for a story with mocks, and pre-bundles MSW", () => {
    expect(msw().tabs?.map((tab) => [tab.id, tab.when])).toEqual([["network", { parameter: "msw" }]]);
    expect(msw().browserDependencies).toEqual(["msw/browser"]);
  });
});
