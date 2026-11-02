/**
 * Tests for the device models and their drawings: every id has a model, every drawing's screen is the model's
 * viewport, held either way.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { deviceDrawing } from "../src/deviceDrawing.ts";
import { DEVICE_MODELS, deviceModel, deviceScreen } from "../src/devices.ts";
import { DEVICE_IDS, DEVICE_ORIENTATIONS } from "../src/deviceView.ts";

describe("the device models", () => {
  it("has one model per id, in the ids' order, each with safe areas inside its viewport", () => {
    expect(DEVICE_MODELS.map((model) => model.id)).toEqual([...DEVICE_IDS]);
    for (const model of DEVICE_MODELS) {
      for (const orientation of DEVICE_ORIENTATIONS) {
        const { width, height, safeArea } = deviceScreen(model, orientation);
        expect(safeArea.top + safeArea.bottom).toBeLessThan(height / 4);
        expect(safeArea.left + safeArea.right).toBeLessThan(width / 4);
      }
    }
  });

  it("swaps the viewport's width and height on its side", () => {
    const model = deviceModel("iphone-16");
    expect(deviceScreen(model, "portrait")).toMatchObject({ width: 393, height: 852 });
    expect(deviceScreen(model, "landscape")).toMatchObject({ width: 852, height: 393 });
  });
});

describe("deviceDrawing", () => {
  it("puts the screen, at the viewport's size, inside the drawing, held either way", () => {
    for (const model of DEVICE_MODELS) {
      for (const orientation of DEVICE_ORIENTATIONS) {
        const drawing = deviceDrawing(model, orientation);
        const screen = deviceScreen(model, orientation);
        expect(drawing.screen).toMatchObject({
          width: screen.width,
          height: screen.height,
          radius: model.radius
        });
        expect(drawing.screen.x + drawing.screen.width).toBeLessThan(drawing.width);
        expect(drawing.screen.y + drawing.screen.height).toBeLessThan(drawing.height);
        expect(drawing.width > drawing.height).toBe(orientation === "landscape");
      }
    }
  });

  it("shows no status bar on an iPhone on its side, as iOS does, and keeps it on an Android phone", () => {
    const texts = (id: "iphone-16" | "pixel-9", orientation: "portrait" | "landscape"): number =>
      deviceDrawing(deviceModel(id), orientation).over.filter((shape) => shape.kind === "text").length;
    expect(texts("iphone-16", "portrait")).toBe(1);
    expect(texts("iphone-16", "landscape")).toBe(0);
    expect(texts("pixel-9", "landscape")).toBe(1);
  });

  it("turns the camera's cut to the left on its side", () => {
    const hole = deviceDrawing(deviceModel("pixel-9"), "landscape").over.find(
      (shape) => shape.kind === "circle"
    );
    expect(hole?.kind === "circle" && hole.cx < 60).toBe(true);
  });
});
