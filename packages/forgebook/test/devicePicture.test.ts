/**
 * Tests for a story's picture in a device: the page that draws the picture in the story's area of the screen, between
 * the hardware and the status bar, and the address of a story drawn edge to edge.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { deviceDrawing } from "../src/deviceDrawing.ts";
import { deviceFrameAddress, deviceViewport, framedPicture } from "../src/devicePicture.ts";
import { deviceModel } from "../src/devices.ts";

/** An iPhone 16 upright. */
const SHOWN = { model: "iphone-16", orientation: "portrait" } as const;

/** A picture of it, inside the safe areas, light. */
const REQUEST = {
  shown: SHOWN,
  isEdgeToEdge: false,
  picture: "AAAA",
  scheme: "light",
  background: "#f2f2f7"
} as const;

describe("framedPicture", () => {
  const drawing = deviceDrawing(deviceModel("iphone-16"), "portrait");

  it("is as large as the drawing", () => {
    expect(framedPicture(REQUEST)).toMatchObject({ width: drawing.width, height: drawing.height });
  });

  it("puts a story inside the safe areas below the status bar, the screen on its page's colour", () => {
    const { html } = framedPicture(REQUEST);
    expect(html).toContain("border-radius:55px;background:#f2f2f7");
    expect(html).toContain('style="position:absolute;left:0px;top:59px;width:393px;height:759px"');
    const [under, over] = html.split("<img");
    expect(under).toContain("<rect");
    expect(over).toContain(">9:41</text>");
  });

  it("puts a story drawn edge to edge on the whole screen, and refuses a colour that is not one", () => {
    const { html } = framedPicture({ ...REQUEST, isEdgeToEdge: true, background: "red;}<x" });
    expect(html).toContain('style="position:absolute;left:0px;top:0px;width:393px;height:852px"');
    expect(html).toContain("background:transparent");
  });

  it("draws the status bar in the story's scheme", () => {
    expect(framedPicture(REQUEST).html).toContain('fill="#000">9:41');
    expect(framedPicture({ ...REQUEST, scheme: "dark" }).html).toContain('fill="#fff">9:41');
  });
});

describe("a story's viewport and address in a device", () => {
  it("is the screen less the safe areas, or the whole screen told them edge to edge", () => {
    expect(deviceViewport(SHOWN, false)).toEqual({ width: 393, height: 759 });
    expect(deviceViewport({ model: "iphone-16", orientation: "landscape" }, false)).toEqual({
      width: 734,
      height: 372
    });
    expect(deviceViewport(SHOWN, true)).toEqual({ width: 393, height: 852 });
    expect(deviceFrameAddress("frame.html?story=a", SHOWN, false)).toBe("frame.html?story=a");
    expect(deviceFrameAddress("frame.html?story=a", SHOWN, true)).toBe(
      "frame.html?story=a&forgebook.safe-area=59,0,34,0"
    );
  });
});
