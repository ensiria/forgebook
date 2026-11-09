/**
 * Tests for the order a page's waiting frames start in: the ones in view first, then outward, the page's order among
 * equals.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { distanceFromView, nearestFrames } from "../src/shell/frameOrder.ts";

/** The visible part of a page, in the coordinates of the tests' boxes. */
const VIEW = { top: 1000, bottom: 1900 };

describe("distanceFromView", () => {
  it("is nothing for a box in view, even partly", () => {
    expect(distanceFromView({ top: 1200, bottom: 1400 }, VIEW)).toBe(0);
    expect(distanceFromView({ top: 900, bottom: 1001 }, VIEW)).toBe(0);
    expect(distanceFromView({ top: 1899, bottom: 2100 }, VIEW)).toBe(0);
    expect(distanceFromView({ top: 500, bottom: 2500 }, VIEW)).toBe(0);
  });

  it("is the gap to the nearest edge for a box above or below", () => {
    expect(distanceFromView({ top: 600, bottom: 800 }, VIEW)).toBe(200);
    expect(distanceFromView({ top: 2000, bottom: 2200 }, VIEW)).toBe(100);
    expect(distanceFromView({ top: 800, bottom: 1000 }, VIEW)).toBe(0);
  });
});

describe("nearestFrames", () => {
  it("starts the stories in view before those above them in the page", () => {
    const distances = new Map([
      ["a", 400],
      ["b", 100],
      ["c", 0],
      ["d", 0],
      ["e", 300]
    ]);
    expect(nearestFrames(["a", "b", "c", "d", "e"], distances, 2)).toEqual(["c", "d"]);
    expect(nearestFrames(["a", "b", "e"], distances, 2)).toEqual(["b", "e"]);
  });

  it("keeps the page's order among stories at the same distance, the demo first", () => {
    const distances = new Map([
      ["demo", 0],
      ["one", 0],
      ["two", 0]
    ]);
    expect(nearestFrames(["demo", "one", "two"], distances, 2)).toEqual(["demo", "one"]);
  });

  it("puts a story with no known place after the others, in the page's order", () => {
    const distances = new Map([["b", 5000]]);
    expect(nearestFrames(["x", "y", "b"], distances, 3)).toEqual(["b", "x", "y"]);
  });

  it("starts none when no place is free", () => {
    expect(nearestFrames(["a"], new Map([["a", 0]]), 0)).toEqual([]);
    expect(nearestFrames(["a"], new Map([["a", 0]]), -1)).toEqual([]);
  });
});
