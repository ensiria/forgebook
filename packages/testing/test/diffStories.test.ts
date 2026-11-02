/**
 * Tests for comparing pictures, on real ones from a browser: one pixel is found, and the same picture is the same.
 *
 * @module
 */
import { type Browser, chromium, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  comparePictures,
  comparePixels,
  diffStories,
  type Pixels,
  removedBaselines
} from "../src/diffStories.ts";

let browser: Browser;
let page: Page;

/** A picture of a square, with one pixel of another colour when asked. */
const picture = async (pixel: { readonly x: number; readonly y: number } | undefined): Promise<string> => {
  const data = await page.evaluate(async (at) => {
    const canvas = new OffscreenCanvas(40, 30);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("No canvas");
    context.fillStyle = "#2040a0";
    context.fillRect(0, 0, 40, 30);
    if (at !== undefined) {
      context.fillStyle = "#ffffff";
      context.fillRect(at.x, at.y, 1, 1);
    }
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  }, pixel);
  return `data:image/png;base64,${data}`;
};

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe("comparePictures", () => {
  it("says two equal pictures are the same", async () => {
    const plain = await picture(undefined);
    expect(await comparePictures(page, plain, plain)).toMatchObject({ changedPixels: 0, percent: 0 });
  });

  it("finds one pixel, says where, and marks it", async () => {
    const difference = await comparePictures(page, await picture(undefined), await picture({ x: 7, y: 12 }));
    expect(difference.changedPixels).toBe(1);
    expect(difference.region).toEqual({ x: 7, y: 12, width: 1, height: 1 });
    expect(difference.percent).toBeCloseTo(100 / 1200);
    expect(difference.marked).toMatch(/^data:image\/png;base64,/);
  });
});

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

describe("a tall picture", () => {
  it("is compared whole, past what one message holds", async () => {
    const tall = await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(1280, 16_000);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("No canvas");
      context.fillStyle = "#2040a0";
      context.fillRect(0, 0, 1280, 16_000);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      let text = "";
      for (let start = 0; start < bytes.length; start += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
      }
      return `data:image/png;base64,${btoa(text)}`;
    });
    expect(await comparePictures(page, tall, tall)).toMatchObject({ changedPixels: 0 });
  }, 60_000);
});
