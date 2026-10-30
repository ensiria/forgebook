/**
 * Tests for `forgebook-heights`'s pure part: the widths it is asked for and the document it writes.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { heightsDocument, parseWidths } from "./measureHeights.ts";

describe("parseWidths", () => {
  it("reads whole widths, ascending, once each", () => {
    expect(parseWidths("1024, 360,768,360")).toEqual([360, 768, 1024]);
  });

  it("says what is wrong with a width outside the stage's range or not a number", () => {
    expect(parseWidths("")).toBe("--widths needs at least one width");
    expect(parseWidths("360,wide")).toMatch(/not "wide"/);
    expect(parseWidths("100")).toMatch(/from 240 to 2560, not "100"/);
    expect(parseWidths("360.5")).toMatch(/not "360.5"/);
  });
});

describe("heightsDocument", () => {
  it("keeps the widths and the measured stories in the order given", () => {
    const measured = new Map([
      ["kit:a--one", [900, 300]],
      ["kit:a--two", [120, 120]]
    ]);
    expect(heightsDocument([360, 1440], measured)).toEqual({
      widths: [360, 1440],
      heights: { "kit:a--one": [900, 300], "kit:a--two": [120, 120] }
    });
  });
});
