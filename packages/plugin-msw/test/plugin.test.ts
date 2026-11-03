/**
 * Tests for the plugin's declaration: it speaks the contract and passes Forgebook's own checks.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { msw } from "../src/plugin.ts";

describe("msw", () => {
  it("offers its tab only for a story with mocks, and pre-bundles MSW", () => {
    expect(msw().tabs?.map((tab) => [tab.id, tab.when])).toEqual([["msw", { parameter: "msw" }]]);
    expect(msw().browserDependencies).toEqual(["msw/browser", "msw"]);
  });
});
