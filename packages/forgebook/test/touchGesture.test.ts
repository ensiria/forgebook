/**
 * Tests for the touch simulation's reckoning: a tap's reach, the mirrored second finger, the axes a `touch-action`
 * allows, and a fling slowing down.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { allowedPan, flungSpeed, isDragging, mirroredFinger, panAxesOf } from "../src/frame/touchGesture.ts";

describe("touchGesture", () => {
  it("lets a finger wander a little and still tap", () => {
    expect(isDragging({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(false);
    expect(isDragging({ x: 0, y: 0 }, { x: 12, y: 0 })).toBe(true);
  });

  it("mirrors the second finger around the gesture's centre", () => {
    expect(mirroredFinger({ x: 100, y: 100 }, { x: 140, y: 90 })).toEqual({ x: 60, y: 110 });
  });

  it("reads the axes each touch-action allows, and narrows them on the way up", () => {
    expect(panAxesOf("auto")).toEqual({ x: true, y: true });
    expect(panAxesOf("manipulation")).toEqual({ x: true, y: true });
    expect(panAxesOf("none")).toEqual({ x: false, y: false });
    expect(panAxesOf("pan-y pinch-zoom")).toEqual({ x: false, y: true });
    expect(panAxesOf("pan-left")).toEqual({ x: true, y: false });
    expect(allowedPan(["auto", "pan-x", "auto"])).toEqual({ x: true, y: false });
    expect(allowedPan(["pan-y", "pan-x"])).toEqual({ x: false, y: false });
  });

  it("slows a fling down and stops it once it is too slow to see", () => {
    const after = flungSpeed(1, 160);
    expect(after).toBeGreaterThan(0.5);
    expect(after).toBeLessThan(1);
    expect(flungSpeed(0.021, 160)).toBe(0);
    expect(flungSpeed(-1, 16)).toBeCloseTo(-0.95);
  });
});
