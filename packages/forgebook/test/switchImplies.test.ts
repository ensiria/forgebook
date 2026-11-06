/**
 * Tests for a switch value that implies another switch's: what is drawn, whatever the address says, and how a conflict
 * resolves.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { cycledView } from "../src/shell/controlCycle.ts";
import { shellIsDark } from "../src/shell/shellScheme.ts";
import { storyBackground } from "../src/storyBackground.ts";
import { withFixed } from "../src/storyGlobals.ts";
import { impliedSwitches, shownSwitches, themeSwitch, type ViewSwitch } from "../src/switches.ts";
import { codeGlobalsOf, DEFAULT_VIEW, parseView, schemeOf, viewParams } from "../src/viewState.ts";

const LOOK: ViewSwitch = {
  id: "look",
  label: "Theme",
  apply: { kind: "code" },
  default: "plain",
  values: [
    { value: "plain", label: "Plain" },
    { value: "night", label: "Night", implies: { theme: "dark" } }
  ]
};

const SWITCHES: readonly ViewSwitch[] = [LOOK, themeSwitch()];

const CATALOGUE = catalogueSettings("Fixture", SWITCHES);

describe("a value that implies another switch's", () => {
  it("draws the implied value, whatever the address says of that switch", () => {
    expect(shownSwitches({ look: "night", theme: "light" }, SWITCHES)).toEqual({
      look: "night",
      theme: "dark"
    });
    expect(schemeOf({ switches: { look: "night", theme: "light" } }, SWITCHES)).toBe("dark");
  });

  it("gives the same answer applied twice, so a frame and the shell agree", () => {
    const once = shownSwitches({ look: "night" }, SWITCHES);
    expect(shownSwitches(once, SWITCHES)).toEqual(once);
  });

  it("names the value that sets it, for the control's note", () => {
    expect(impliedSwitches({ look: "night" }, SWITCHES).get("theme")?.by.label).toBe("Night");
    expect(impliedSwitches({ look: "plain" }, SWITCHES).size).toBe(0);
  });

  it("applies a default value's implication too", () => {
    const start: ViewSwitch = { ...LOOK, default: "night" };
    expect(schemeOf({ switches: {} }, [start, themeSwitch()])).toBe("dark");
  });

  it("keeps the reader's own value in the address, which comes back when the value is left", () => {
    const view = parseView("look=night&theme=light", CATALOGUE);
    expect(viewParams(view, SWITCHES).toString()).toBe("look=night");
    const dark = parseView("look=night&theme=dark", CATALOGUE);
    expect(viewParams(dark, SWITCHES).toString()).toBe("look=night&theme=dark");
    expect(schemeOf({ switches: { ...dark.switches, look: "plain" } }, SWITCHES)).toBe("dark");
  });

  it("gives a story that reads the switch by code the value drawn", () => {
    const byCode: ViewSwitch = { ...themeSwitch(), apply: { kind: "code" } };
    expect(codeGlobalsOf({ switches: { look: "night", theme: "light" } }, [LOOK, byCode])).toEqual({
      look: "night",
      theme: "dark"
    });
  });

  it("wins over what a story fixes, and follows a value the story fixes", () => {
    const fixedOf = (switches: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
      shownSwitches(
        withFixed({ ...DEFAULT_VIEW, switches: { look: "night" } }, { switches }).switches,
        SWITCHES
      );
    expect(fixedOf({ theme: "light" })["theme"]).toBe("dark");
    expect(fixedOf({ look: "plain", theme: "light" })["theme"]).toBe("light");
  });

  it("leaves a conflict to the switch declared first", () => {
    const paper: ViewSwitch = {
      id: "paper",
      label: "Paper",
      apply: { kind: "code" },
      default: "cream",
      values: [{ value: "cream", label: "Cream", implies: { theme: "light" } }]
    };
    const values = { look: "night", paper: "cream" };
    expect(shownSwitches(values, [LOOK, paper, themeSwitch()])["theme"]).toBe("dark");
    expect(shownSwitches(values, [paper, LOOK, themeSwitch()])["theme"]).toBe("light");
  });

  it("gives one answer for two values that imply each other's switches", () => {
    const theme: ViewSwitch = {
      ...themeSwitch(),
      values: themeSwitch().values.map((value) =>
        value.value === "light" ? { ...value, implies: { look: "plain" } } : value
      )
    };
    const values = { look: "night", theme: "light" };
    expect(shownSwitches(values, [LOOK, theme])).toEqual({ look: "night", theme: "dark" });
    expect(shownSwitches(values, [theme, LOOK])).toEqual({ look: "plain", theme: "light" });
  });

  it("never lets a value that is not drawn imply", () => {
    const of = (id: string, values: ViewSwitch["values"]): ViewSwitch => ({
      id,
      label: id,
      apply: { kind: "code" },
      default: values[0]?.value ?? "",
      values
    });
    const x = of("x", [
      { value: "x1", label: "1" },
      { value: "x2", label: "2", implies: { z: "z1" } }
    ]);
    const y = of("y", [{ value: "y1", label: "1", implies: { x: "x1" } }]);
    const z = of("z", [
      { value: "z0", label: "0" },
      { value: "z1", label: "1" }
    ]);
    expect(shownSwitches({ x: "x2", y: "y1" }, [x, y, z])).toEqual({ x: "x2", y: "y1", z: "z1" });
  });

  it("leaves the implied switch's key without effect", () => {
    const view = { ...DEFAULT_VIEW, switches: { look: "night", theme: "light" } };
    expect(cycledView(view, "theme", 1, CATALOGUE, { switches: {} }, true)).toBeUndefined();
    expect(cycledView(view, "look", 1, CATALOGUE, { switches: {} }, true)?.switches["look"]).toBe("plain");
  });

  it("colours the shell that follows the story", () => {
    expect(
      shellIsDark({
        appearance: "story",
        values: { look: "night", theme: "light" },
        switches: SWITCHES,
        isSystemDark: false,
        isComparing: false
      })
    ).toBe(true);
  });
});

describe("a source's page colour that follows a switch", () => {
  const Background = {
    light: "#ffffff",
    dark: "#111111",
    lightMore: "#fefefe",
    bySwitch: { look: { night: { dark: "#0b1020" }, paper: { light: "#f6f0e2" } } }
  };
  const colourOf = (switches: Readonly<Record<string, string>>): string | undefined =>
    storyBackground(
      Background,
      { switches, backdrop: "plain" },
      { switches: SWITCHES, backdrops: [] },
      false
    );

  it("waits on the value's colour, in the scheme it implies", () => {
    expect(colourOf({ look: "night", theme: "light" })).toBe("#0b1020");
  });

  it("falls back to the source's own colours for a value that gives none", () => {
    expect(colourOf({ look: "plain", theme: "dark" })).toBe("#111111");
    expect(colourOf({ look: "plain", theme: "light" })).toBe("#ffffff");
  });
});
