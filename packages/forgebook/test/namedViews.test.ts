/**
 * Tests for named views: saving, replacing and removing a reader's, reading them back, two views compared, and the
 * catalogue's read from its configuration.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import {
  checkedView,
  isSameView,
  namedViewsText,
  readNamedViews,
  viewValues,
  withoutView,
  withSavedView,
  withViewValues
} from "../src/namedViews.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { DEFAULT_VIEW } from "../src/viewState.ts";
import { mergedLists } from "../src/vite/configFile.ts";

const DARK = viewValues({ ...DEFAULT_VIEW, switches: { theme: "dark" }, width: 360 });

describe("a reader's named views", () => {
  it("are saved by name, a name again replacing its view where it was, and removed", () => {
    const one = withSavedView([], { name: " Dark ", values: DARK });
    expect(one).toEqual([{ name: "Dark", values: DARK }]);
    const two = withSavedView(one, { name: "Plain", values: viewValues(DEFAULT_VIEW) });
    const replaced = withSavedView(two, { name: "Dark", values: viewValues(DEFAULT_VIEW) });
    expect(replaced.map((each) => each.name)).toEqual(["Dark", "Plain"]);
    expect(withSavedView(two, { name: "  ", values: DARK })).toEqual(two);
    expect(withoutView(two, "Dark").map((each) => each.name)).toEqual(["Plain"]);
  });

  it("are read back as stored, leaving out what this module did not write", () => {
    const views = [{ name: "Dark", values: DARK }];
    expect(readNamedViews(namedViewsText(views))).toEqual(views);
    expect(readNamedViews('[{"name":"Odd","values":{"switches":{}}}]')).toEqual([]);
    expect(readNamedViews("not json")).toEqual([]);
    expect(namedViewsText([])).toBe("");
  });

  it("set their values over the view, and compare a switch at its default with one left out", () => {
    expect(withViewValues({ ...DEFAULT_VIEW, zoom: 150 }, DARK)).toMatchObject({ zoom: 150, width: 360 });
    const theme = DEFAULT_SWITCHES.find((each) => each.id === "theme");
    const atDefault = { ...viewValues(DEFAULT_VIEW), switches: { theme: theme?.default ?? "" } };
    expect(isSameView(atDefault, viewValues(DEFAULT_VIEW), DEFAULT_SWITCHES)).toBe(true);
    expect(isSameView(DARK, viewValues(DEFAULT_VIEW), DEFAULT_SWITCHES)).toBe(false);
  });
});

describe("the catalogue's named views", () => {
  it("are read in the address's form or as words, and a later list's replaces an earlier one's", () => {
    const merged = mergedLists([
      { views: [{ name: "Night", view: "theme=dark" }] },
      { views: [{ name: "Night", view: "dark 360" }] }
    ]);
    const settings = catalogueSettings("A", DEFAULT_SWITCHES, merged);
    expect(settings.views).toHaveLength(1);
    expect(settings.views[0]?.name).toBe("Night");
    expect(settings.views[0]?.query).toContain("width=360");
  });

  it("stop a catalogue whose view cannot be read", () => {
    expect(() =>
      catalogueSettings("A", DEFAULT_SWITCHES, { views: [{ name: "Odd", view: "nowhere" }] })
    ).toThrow('Forgebook\'s view "Odd"');
  });

  describe("a named view picked again", () => {
    it("falls back to the default for what the catalogue no longer offers", () => {
      const catalogue = catalogueSettings("A", DEFAULT_SWITCHES, { controls: { sheets: false } });
      const picked = withViewValues(DEFAULT_VIEW, {
        ...viewValues(DEFAULT_VIEW),
        backdrop: "gone",
        text: 175,
        sheets: "structure"
      });
      const checked = checkedView(picked, catalogue);
      expect([checked.backdrop, checked.text, checked.sheets]).toEqual(["plain", 100, "full"]);
    });
  });
});
