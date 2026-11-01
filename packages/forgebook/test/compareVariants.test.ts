/**
 * Tests for the compare view's frames: one per value of a switch, its default included, except a value that only
 * follows the system and so draws as one of the others.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { compareVariants } from "../src/shell/compareVariants.ts";
import { DEFAULT_VIEW } from "../src/viewState.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

/** The fixture's catalogue. */
const CATALOGUE = catalogueSettings("Fixture", FIXTURE_SWITCHES);

/**
 * The labels of the frames comparing some axes.
 *
 * @param axes - the compared axes.
 */
const labelsOf = (...axes: string[]): string[] =>
  compareVariants(axes, CATALOGUE).map((variant) => variant.label);

describe("the compare view's frames", () => {
  it("draws every value of a switch, the default among them", () => {
    expect(labelsOf("speed")).toEqual(["Slow", "Normal", "Fast"]);
    expect(labelsOf("press")).toEqual(["Default", "Shrink", "Darken"]);
    expect(labelsOf("lang")).toEqual(["Stories' own", "Pseudo"]);
  });

  it("draws both directions and both pointers, as the other switches", () => {
    expect(labelsOf("dir")).toEqual(["Left to right", "Right to left"]);
    expect(labelsOf("touch")).toEqual(["Mouse", "Touch"]);
  });

  it("leaves out the system's theme, which draws as light or dark", () => {
    expect(labelsOf("theme")).toEqual(["Light", "Dark"]);
    expect(labelsOf("theme", "contrast")).toEqual([
      "Light",
      "Dark",
      "Light · More contrast",
      "Dark · More contrast"
    ]);
  });

  it("sets each frame's value, the default's too", () => {
    const [normal] = compareVariants(["speed"], CATALOGUE).filter((variant) => variant.label === "Normal");
    expect(normal?.viewOf(DEFAULT_VIEW).switches["speed"]).toBe("normal");
  });
});
