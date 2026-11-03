/**
 * Tests for comparing pictures: pure pixels, the baselines left by a removed story, and what is refused. Real pictures
 * through a browser are in the shell suite (`fixtures/app/shell/pictures.e2e.ts`), which has one.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  comparePixels,
  diffStories,
  type Pixels,
  removedBaselines,
  storedBaseline
} from "../src/diffStories.ts";

describe("comparePixels", () => {
  const blank = (width: number, height: number): Pixels => ({
    width,
    height,
    bytes: new Uint8Array(width * height * 4)
  });

  it("holds off a channel moved by no more than the tolerance", () => {
    const moved = blank(2, 1);
    moved.bytes[0] = 2;
    expect(comparePixels(blank(2, 1), moved).changedPixels).toBe(0);
    moved.bytes[0] = 3;
    expect(comparePixels(blank(2, 1), moved).changedPixels).toBe(1);
  });

  it("says where the changed pixels are and how many", () => {
    const moved = blank(4, 3);
    moved.bytes.set([255, 255, 255, 255], (2 * 4 + 1) * 4);
    const difference = comparePixels(blank(4, 3), moved);
    expect(difference).toMatchObject({ changedPixels: 1, region: { x: 1, y: 2, width: 1, height: 1 } });
    expect(difference.percent).toBeCloseTo(100 / 12);
  });

  it("says a picture of another size cannot be compared", () => {
    expect(comparePixels(blank(2, 1), blank(2, 2))).toMatchObject({ isSizeChanged: true, percent: 100 });
  });
});

describe("removedBaselines", () => {
  it("names a component's baselines with no story left, and leaves its stories' and others' alone", () => {
    const files = [
      "kit-badge--plain--default.png",
      "kit-badge--plain--dark.png",
      "kit-badge--gone--default.png",
      "kit-badge--gone--default.diff.png",
      "kit-button--plain--default.png"
    ];
    expect(removedBaselines(files, "kit:badge", ["kit:badge--plain"])).toEqual([
      "kit-badge--gone--default.png"
    ]);
    // a baseline stored under a story's former id is still its own while it has none under its id
    expect(
      removedBaselines(["kit-badge--size2-x--default.png"], "kit:badge", [
        "kit:badge--size-2-x",
        "kit:badge--size2-x"
      ])
    ).toEqual([]);
  });
});

describe("storedBaseline", () => {
  it("compares with the baseline stored under the story's former id while none has its id", () => {
    const files = ["kit-data-read-more--open--default.png", "kit-data-badge--plain--default.png"];
    expect(
      storedBaseline(files, "kit-data-readmore--open--default.png", "kit-data-read-more--open--default.png")
    ).toBe("kit-data-read-more--open--default.png");
    expect(
      storedBaseline(
        [...files, "kit-data-readmore--open--default.png"],
        "kit-data-readmore--open--default.png",
        "kit-data-read-more--open--default.png"
      )
    ).toBe("kit-data-readmore--open--default.png");
    expect(storedBaseline(files, "kit-data-badge--new--default.png", undefined)).toBe(
      "kit-data-badge--new--default.png"
    );
  });
});

describe("diffStories", () => {
  it("refuses to put the pictures over the baselines they prove", async () => {
    const folder = "/somewhere/baselines";
    const request = {
      frameUrl: "http://127.0.0.1:9/frame.html",
      stories: [],
      switches: [],
      lists: { usedIn: false },
      views: [],
      isAllVariants: false,
      outDir: folder,
      baselines: `${folder}/`
    };
    await expect(diffStories(request)).rejects.toThrow("baselines' folder");
  });
});
