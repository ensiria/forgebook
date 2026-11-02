/**
 * Comparing pictures through a real browser, as `forgebook diff` does: one pixel is found and marked, and a picture
 * taller than one message holds is read whole.
 *
 * @module
 */

import { comparePictures } from "@forgebook/testing/diff";
import { expect, type Page, test } from "@playwright/test";

/** A picture of a colour, with one pixel of another when asked, as a PNG data URL. */
const picture = (
  page: Page,
  size: { readonly width: number; readonly height: number },
  pixel?: { readonly x: number; readonly y: number }
): Promise<string> =>
  page.evaluate(
    async ({ width, height, at }) => {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("No canvas");
      context.fillStyle = "#2040a0";
      context.fillRect(0, 0, width, height);
      if (at !== undefined) {
        context.fillStyle = "#ffffff";
        context.fillRect(at.x, at.y, 1, 1);
      }
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      let text = "";
      for (let start = 0; start < bytes.length; start += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
      }
      return `data:image/png;base64,${btoa(text)}`;
    },
    { ...size, at: pixel }
  );

test.describe("comparing pictures", () => {
  test("finds one pixel, says where, and marks it", async ({ page }) => {
    const size = { width: 40, height: 30 };
    const difference = await comparePictures(
      page,
      await picture(page, size),
      await picture(page, size, { x: 7, y: 12 })
    );
    expect(difference.changedPixels).toBe(1);
    expect(difference.region).toEqual({ x: 7, y: 12, width: 1, height: 1 });
    expect(difference.marked).toMatch(/^data:image\/png;base64,/);
  });

  test("reads a picture past what one message holds, and marks a change in it", async ({ page }) => {
    const size = { width: 1280, height: 16_000 };
    const difference = await comparePictures(
      page,
      await picture(page, size),
      await picture(page, size, { x: 3, y: 15_000 })
    );
    expect(difference.changedPixels).toBe(1);
    expect(difference.marked).toMatch(/^data:image\/png;base64,/);
  });
});
