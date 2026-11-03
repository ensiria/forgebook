/**
 * Tests for the search's texts, which load after the first screen: a catalogue replaces them as any other.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { configureStrings, textsOfGroup } from "../src/shell/strings.ts";

describe("textsOfGroup", () => {
  it("applies the replacements given before it loaded, plain texts of its own group only", () => {
    configureStrings({ "search.kindPage": "Guides", "search.count": "Many", "other.kindPage": "No" });
    const count = (value: number): string => String(value);
    const group = textsOfGroup("search", { kindPage: "Docs", count });
    expect(group).toEqual({ kindPage: "Guides", count });
    configureStrings({});
  });
});
