/**
 * Tests for which pinned controls a narrow toolbar moves into the View menu: the last pinned first, the gaps between
 * them counted, none when they fit.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { overflowing } from "../src/shell/useToolbarOverflow.ts";

const WIDTHS = new Map([
  ["theme", 100],
  ["contrast", 80],
  ["width", 300]
]);

describe("overflowing", () => {
  it("moves out the controls from the first that passes the room, the gaps between them counted", () => {
    // 100 + 12 + 80 = 192 fits; with the width, 192 + 12 + 300 = 504 does not
    expect(overflowing(["theme", "contrast", "width"], WIDTHS, 500, 12)).toEqual(["width"]);
    expect(overflowing(["theme", "contrast", "width"], WIDTHS, 504, 12)).toEqual([]);
    expect(overflowing(["theme", "contrast", "width"], WIDTHS, 150, 12)).toEqual(["contrast", "width"]);
    expect(overflowing([], WIDTHS, 0, 12)).toEqual([]);
  });

  it("keeps a control not measured yet, so it is drawn once and measured", () => {
    expect(overflowing(["theme", "motion"], WIDTHS, 112, 12)).toEqual([]);
  });
});
