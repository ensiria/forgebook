/**
 * Tests for a story's picture framed in a device: the page that draws the picture in the device's screen, between the
 * hardware and the status bar.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { deviceDrawing } from "../src/deviceDrawing.ts";
import { framedPicture } from "../src/devicePicture.ts";
import { deviceModel } from "../src/devices.ts";

/** An iPhone 16 upright. */
const SHOWN = { model: "iphone-16", orientation: "portrait" } as const;

describe("framedPicture", () => {
  const drawing = deviceDrawing(deviceModel("iphone-16"), "portrait");

  it("is as large as the drawing", () => {
    expect(framedPicture(SHOWN, "AAAA", "light")).toMatchObject({
      width: drawing.width,
      height: drawing.height
    });
  });

  it("puts the picture in the screen, at its place and with its corners, between the two layers", () => {
    const page = framedPicture(SHOWN, "AAAA", "light").html;
    const { screen } = drawing;
    expect(page).toContain(
      `src="data:image/png;base64,AAAA" style="position:absolute;left:${screen.x}px;top:${screen.y}px;width:393px;height:852px;border-radius:55px"`
    );
    const [under, over] = page.split("<img");
    expect(under).toContain("<rect");
    expect(over).toContain(">9:41</text>");
  });

  it("draws the hardware and the status bar in the story's scheme", () => {
    expect(framedPicture(SHOWN, "AAAA", "light").html).toContain('fill="#000">9:41');
    expect(framedPicture(SHOWN, "AAAA", "dark").html).toContain('fill="#fff">9:41');
  });
});
