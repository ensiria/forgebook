/**
 * Tests for the check of the overlays a story leaves open past its frame (D-469).
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type FixedLayout, isOverlayChecked, overlaysPastFrame } from "../src/overlays";

/** The layout of a story 80 px tall in a 720 px window: a menu, a full-window layer and a toast at the foot. */
const AFTER_PLAY: FixedLayout = {
  frameHeight: 80,
  windowHeight: 720,
  boxes: [
    { key: "div.layer#0", top: 0, bottom: 720 },
    { key: "div.menu#0", top: 60, bottom: 260 },
    { key: "div.toast#0", top: 660, bottom: 704 },
    { key: "div.tip#0", top: 20, bottom: 80.6 }
  ]
};

/** The same layout in a window 120 px taller: the layer grows, the toast moves, the menu stays. */
const GROWN: FixedLayout = {
  frameHeight: 80,
  windowHeight: 840,
  boxes: [
    { key: "div.layer#0", top: 0, bottom: 840 },
    { key: "div.menu#0", top: 60, bottom: 260 },
    { key: "div.toast#0", top: 780, bottom: 824 },
    { key: "div.tip#0", top: 20, bottom: 80.6 }
  ]
};

describe("overlaysPastFrame", () => {
  it("flags an anchored overlay that ends below the frame, not what follows the window or ends within a pixel", () => {
    expect(overlaysPastFrame(AFTER_PLAY, GROWN, 120)).toEqual([
      { element: "div.menu#0", by: 180, frameHeight: 80 }
    ]);
  });

  it("flags nothing when the frame has the room its overlays need", () => {
    expect(overlaysPastFrame({ ...AFTER_PLAY, frameHeight: 720 }, GROWN, 120)).toEqual([]);
  });

  it("counts every box but a full-window layer as anchored when the window could not grow", () => {
    expect(overlaysPastFrame(AFTER_PLAY, undefined, 120).map((overlay) => overlay.element)).toEqual([
      "div.menu#0",
      "div.toast#0"
    ]);
  });
});

describe("isOverlayChecked", () => {
  it("leaves out a view with the structure sheets only, where a library's surfaces are bare and unsized", () => {
    expect(isOverlayChecked({ sheets: "structure" })).toBe(false);
    expect(isOverlayChecked({})).toBe(true);
    expect(isOverlayChecked({ sheets: "full", theme: "dark" })).toBe(true);
    expect(isOverlayChecked({ sheets: "restyled" })).toBe(true);
  });
});
