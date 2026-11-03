/**
 * Tests for which device frame a story is shown in: the defaults a catalogue and a story set, and the view's choice.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { withModel, withTurn } from "../src/deviceMenuView.ts";
import {
  type DeviceDefault,
  type DeviceView,
  deviceDefaultOf,
  deviceSettingProblem,
  NO_DEVICE,
  pageDeviceDefault,
  shownDevice,
  withFrame
} from "../src/deviceView.ts";

/** A story framed in an iPhone 16 upright by default. */
const FRAMED: DeviceDefault = {
  isFramed: true,
  model: "iphone-16",
  orientation: "portrait",
  isTouch: true,
  isEdgeToEdge: false
};

/** The view that follows the story. */
const AUTO: DeviceView = { device: "auto", orientation: "auto" };

describe("deviceDefaultOf", () => {
  it("lays a setting's fields over the default, each one apart", () => {
    expect(deviceDefaultOf(NO_DEVICE, undefined)).toEqual(NO_DEVICE);
    expect(deviceDefaultOf(NO_DEVICE, { frame: true })).toEqual({ ...NO_DEVICE, isFramed: true });
    expect(deviceDefaultOf(FRAMED, { frame: false, orientation: "landscape", touch: false })).toEqual({
      isFramed: false,
      model: "iphone-16",
      orientation: "landscape",
      isTouch: false,
      isEdgeToEdge: false
    });
  });

  it("leaves out a model or an orientation that is none, which the index and the configuration report", () => {
    expect(deviceDefaultOf(FRAMED, { model: "nokia-3310" })).toEqual(FRAMED);
    expect(deviceSettingProblem({ model: "nokia-3310" })).toMatch(
      /"nokia-3310" is no device model; the models are iphone-16,/
    );
    expect(deviceSettingProblem({ model: "pixel-9", orientation: "landscape" })).toBeUndefined();
  });
});

describe("shownDevice", () => {
  it("follows the story's default while the view says auto", () => {
    expect(shownDevice(AUTO, NO_DEVICE)).toBeUndefined();
    expect(shownDevice(AUTO, FRAMED)).toEqual({
      model: "iphone-16",
      orientation: "portrait",
      isTouch: true,
      isEdgeToEdge: false
    });
    expect(shownDevice({ device: "auto", orientation: "landscape" }, FRAMED)).toEqual({
      model: "iphone-16",
      orientation: "landscape",
      isTouch: true,
      isEdgeToEdge: false
    });
  });

  it("lets the view's choice win: off whatever the story says, a model whatever it says", () => {
    expect(shownDevice({ device: "off", orientation: "auto" }, FRAMED)).toBeUndefined();
    expect(shownDevice({ device: "pixel-9", orientation: "auto" }, NO_DEVICE)).toEqual({
      model: "pixel-9",
      orientation: "portrait",
      isTouch: true,
      isEdgeToEdge: false
    });
  });
});

describe("the toggle, the model and the turn", () => {
  it("keeps only what differs from the story's default in the view", () => {
    expect(withFrame(AUTO, NO_DEVICE, true).device).toBe("phone");
    expect(withFrame({ ...AUTO, device: "phone" }, NO_DEVICE, false).device).toBe("auto");
    expect(withFrame(AUTO, FRAMED, false).device).toBe("off");
    expect(withFrame({ ...AUTO, device: "off" }, FRAMED, true).device).toBe("auto");
    expect(withModel(AUTO, FRAMED, "pixel-9").device).toBe("pixel-9");
    expect(withModel({ ...AUTO, device: "pixel-9" }, FRAMED, "iphone-16").device).toBe("auto");
    expect(withModel(AUTO, NO_DEVICE, "phone").device).toBe("phone");
  });

  it("turns the device the other way, auto when that is the story's own", () => {
    const shown = { model: "iphone-16", orientation: "portrait" } as const;
    expect(withTurn(AUTO, FRAMED, shown).orientation).toBe("landscape");
    expect(withTurn(AUTO, FRAMED, { ...shown, orientation: "landscape" }).orientation).toBe("auto");
  });
});

describe("pageDeviceDefault", () => {
  it("takes the first story framed by default, so the toggle can turn every frame off; the catalogue's otherwise", () => {
    expect(pageDeviceDefault(NO_DEVICE, [undefined, { frame: true, model: "pixel-9" }])).toEqual({
      isFramed: true,
      model: "pixel-9",
      orientation: "portrait",
      isTouch: true,
      isEdgeToEdge: false
    });
    expect(pageDeviceDefault(NO_DEVICE, [undefined, { model: "pixel-9" }])).toEqual(NO_DEVICE);
    const framed = pageDeviceDefault(NO_DEVICE, [{ frame: true, model: "iphone-16" }]);
    expect(withFrame(AUTO, framed, false).device).toBe("off");
  });
});
