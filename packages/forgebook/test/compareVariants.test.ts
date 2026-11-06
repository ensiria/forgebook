/**
 * Tests for the compare view's frames: one per value of a switch, its default included, except a value that only
 * follows the system and so draws as one of the others.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { compareVariants } from "../src/shell/compareVariants.ts";
import { themeSwitch, type ViewSwitch } from "../src/switches.ts";
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
  compareVariants(axes, CATALOGUE, DEFAULT_VIEW).map((variant) => variant.label);

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
    const [normal] = compareVariants(["speed"], CATALOGUE, DEFAULT_VIEW).filter(
      (variant) => variant.label === "Normal"
    );
    expect(normal?.viewOf(DEFAULT_VIEW).switches["speed"]).toBe("normal");
  });

  describe("with a value that implies another switch", () => {
    const look: ViewSwitch = {
      id: "look",
      label: "Theme",
      apply: { kind: "code" },
      default: "plain",
      values: [
        { value: "plain", label: "Plain" },
        { value: "night", label: "Night", implies: { theme: "dark" } }
      ]
    };
    const Implying = catalogueSettings("Fixture", [themeSwitch(), look]);
    const labelsIn = (axes: readonly string[], chosen: string): string[] =>
      compareVariants(axes, Implying, { ...DEFAULT_VIEW, switches: { look: chosen } }).map(
        (variant) => variant.label
      );

    it("leaves out a cell it contradicts, which would draw as another cell under a wrong name", () => {
      expect(labelsIn(["look", "theme"], "plain")).toEqual(["Plain", "Plain · Dark", "Night · Dark"]);
    });

    it("draws one cell of a switch the view's value implies, not the same picture under each name", () => {
      expect(labelsIn(["theme"], "night")).toEqual(["Dark"]);
      expect(labelsIn(["theme"], "plain")).toEqual(["Light", "Dark"]);
    });

    it("draws each value of the switch that implies, whichever theme the stage has", () => {
      expect(labelsIn(["look"], "plain")).toEqual(["Plain", "Night"]);
    });
  });
});
