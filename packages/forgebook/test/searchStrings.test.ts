/**
 * Tests for the texts that load after the first screen: a catalogue replaces them as any other.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { configureGroup, configureStrings } from "../src/shell/strings.ts";

describe("configureGroup", () => {
  it("applies the replacements given before it loaded, plain texts of its own group only", () => {
    configureStrings({ "search.kindPage": "Guides", "search.count": "Many", "other.kindPage": "No" });
    const count = (value: number): string => String(value);
    const group = { kindPage: "Docs", count };
    configureGroup("search", group);
    expect(group).toEqual({ kindPage: "Guides", count });
    configureStrings({});
  });
});
