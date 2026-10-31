/**
 * Tests for right to left: the ready-made direction switch every catalogue gets unless it declares its own or turns it
 * off, and a language read right to left marked so in the language switch.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { catalogueSwitches, DEFAULT_SWITCHES, directionSwitch, type ViewSwitch } from "../src/switches.ts";
import { mergedLists } from "../src/vite/configFile.ts";

describe("the direction switch", () => {
  it("comes after a catalogue's switches and its languages, writing nothing for left to right", () => {
    const switches = catalogueSwitches(undefined, [{ id: "ar", label: "العربية", dir: "rtl" }]);
    expect(switches.map((each) => each.id)).toEqual(["theme", "contrast", "lang", "dir", "touch"]);
    expect(directionSwitch().apply).toEqual({ kind: "attribute", name: "dir" });
    expect(directionSwitch().values.find((value) => value.value === "ltr")?.isUnset).toBe(true);
  });

  it("is left out when the catalogue declares its own direction switch, or turns it off", () => {
    const own: ViewSwitch = { ...directionSwitch(), id: "writing", label: "Writing" };
    expect(catalogueSwitches([...DEFAULT_SWITCHES, own], []).map((each) => each.id)).toEqual([
      "theme",
      "contrast",
      "writing",
      "touch"
    ]);
    const lists = mergedLists([{ controls: { direction: false } }]);
    expect(catalogueSwitches(undefined, [], lists.controls).map((each) => each.id)).toEqual([
      "theme",
      "contrast",
      "touch"
    ]);
    // turning it off is not one of Forgebook's own controls: those stay
    expect(catalogueSettings("Acme", DEFAULT_SWITCHES, lists).ownControls).toEqual([
      "backdrop",
      "sheets",
      "text",
      "width"
    ]);
  });

  it("marks a language read right to left in the language switch", () => {
    const language = catalogueSwitches(undefined, [
      { id: "it", label: "Italiano" },
      { id: "he", label: "עברית", dir: "rtl" }
    ]).find((each) => each.id === "lang");
    expect(language?.values.map((value) => [value.value, value.isRightToLeft === true])).toEqual([
      ["", false],
      ["it", false],
      ["he", true]
    ]);
  });
});
