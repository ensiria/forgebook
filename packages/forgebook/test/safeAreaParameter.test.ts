/**
 * Tests for the safe areas in a frame's address: written by the shell and `forgebook shot`, read by the frame as
 * custom properties.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { safeAreaProperties, withSafeArea } from "../src/safeAreaParameter.ts";

describe("the safe areas in a frame's address", () => {
  it("reach the frame as four custom properties, in px", () => {
    const address = withSafeArea("frame.html?story=a", { top: 59, right: 0, bottom: 34, left: 0 });
    expect(safeAreaProperties(new URL(address, "http://localhost/").search)).toEqual([
      ["--forgebook-safe-area-top", "59px"],
      ["--forgebook-safe-area-right", "0px"],
      ["--forgebook-safe-area-bottom", "34px"],
      ["--forgebook-safe-area-left", "0px"]
    ]);
  });

  it("set nothing when the address has none, or has them wrongly", () => {
    expect(safeAreaProperties("?story=a")).toEqual([]);
    expect(safeAreaProperties("?forgebook.safe-area=1,2")).toEqual([]);
    expect(safeAreaProperties("?forgebook.safe-area=1,2,x,4")).toEqual([]);
  });
});
