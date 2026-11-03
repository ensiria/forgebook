/**
 * Tests for where the toolbar's controls sit: the catalogue's starting places, a person's arrangement resolved
 * against the catalogue as it is now, moving and hiding controls, and the stored text read back.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import {
  arrangementOf,
  arrangementText,
  type PlacedControl,
  placedControls,
  readArrangement,
  withHidden,
  withPinned,
  withPosition
} from "../src/toolbarLayout.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

/** The ids and where each shows, the way the tests compare them: `p` pinned, `h` hidden in View, `-` neither. */
const layout = (placed: readonly PlacedControl[]): string[] =>
  placed.map((each) =>
    `${each.control.id}:${each.isPinned ? "p" : ""}${each.isHidden ? "h" : ""}`.replace(/:$/, ":-")
  );

const CATALOGUE = catalogueSettings("Acme", FIXTURE_SWITCHES);

describe("placedControls", () => {
  it("starts today's bar: the colour scheme, the contrast, the width and the device pinned, every other control in View", () => {
    expect(CATALOGUE.toolbar).toEqual(["theme", "contrast", "width", "forgebook.device"]);
    expect(layout(placedControls(CATALOGUE, undefined))).toEqual([
      "theme:p",
      "contrast:p",
      "width:p",
      "forgebook.device:p",
      "motion:-",
      "speed:-",
      "press:-",
      "lang:-",
      "dir:-",
      "touch:-",
      "backdrop:-",
      "sheets:-",
      "text:-"
    ]);
  });

  it("starts the toolbar a catalogue names, in its order, and leaves out the controls it turned off", () => {
    const catalogue = catalogueSettings("Acme", FIXTURE_SWITCHES, {
      toolbar: ["lang", "theme"],
      controls: { sheets: false, width: false }
    });
    expect(layout(placedControls(catalogue, undefined))).toEqual([
      "lang:p",
      "theme:p",
      "contrast:-",
      "motion:-",
      "speed:-",
      "press:-",
      "dir:-",
      "touch:-",
      "forgebook.device:-",
      "backdrop:-",
      "text:-"
    ]);
  });

  it("refuses a toolbar that names no control at all, or one twice, and leaves out one turned off", () => {
    expect(() => catalogueSettings("Acme", FIXTURE_SWITCHES, { toolbar: ["density"] })).toThrow(
      /"density", which is no control/
    );
    expect(() =>
      catalogueSettings("Acme", FIXTURE_SWITCHES, { toolbar: ["theme"], controls: { sheets: false } })
    ).not.toThrow();
    // a control turned off (by a preset or the catalogue) is only left out of the toolbar
    expect(
      catalogueSettings("Acme", FIXTURE_SWITCHES, {
        toolbar: ["sheets", "theme"],
        controls: { sheets: false }
      }).toolbar
    ).toEqual(["theme"]);
    expect(() => catalogueSettings("Acme", FIXTURE_SWITCHES, { toolbar: ["theme", "theme"] })).toThrow(
      /"theme" twice/
    );
  });

  it("follows a person's arrangement, drops a control the catalogue no longer has, and puts a new one in View", () => {
    const placed = placedControls(CATALOGUE, {
      order: ["motion", "gone", "theme", "contrast", "width", "speed", "press", "backdrop", "sheets", "text"],
      pinned: ["motion", "gone", "theme"],
      hidden: ["contrast", "theme"]
    });
    expect(layout(placed)).toEqual([
      "motion:p",
      // on the toolbar, and no row in View
      "theme:ph",
      "contrast:h",
      "width:-",
      "speed:-",
      "press:-",
      "backdrop:-",
      "sheets:-",
      "text:-",
      // not in the arrangement: the language switch came after it was made
      "lang:-",
      "dir:-",
      "touch:-",
      "forgebook.device:-"
    ]);
  });
});

describe("arranging", () => {
  const start = placedControls(CATALOGUE, undefined);

  it("pins and hides as two choices, each keeping the control's position", () => {
    const placed = withHidden(withPinned(withHidden(start, "width", true), "motion", true), "motion", true);
    expect(layout(placed).slice(0, 5)).toEqual([
      "theme:p",
      "contrast:p",
      "width:ph",
      "forgebook.device:p",
      "motion:ph"
    ]);
    expect(layout(withPinned(placed, "width", false))[2]).toBe("width:h");
  });

  it("moves a control among the shown ones, the hidden ones keeping their position", () => {
    const hidden = withHidden(start, "contrast", true);
    // shown: theme, width, the device, motion, speed…; motion to the first position
    const placed = withPosition(hidden, "motion", 0);
    expect(layout(placed).slice(0, 6)).toEqual([
      "motion:-",
      "contrast:ph",
      "theme:p",
      "width:p",
      "forgebook.device:p",
      "speed:-"
    ]);
    // to the end, past the last; a hidden control does not move
    expect(layout(withPosition(placed, "motion", 99)).at(-1)).toBe("motion:-");
    expect(withPosition(placed, "contrast", 3)).toEqual(placed);
  });

  it("keeps an arrangement through its stored text, and reads none from a text it did not write", () => {
    const arrangement = arrangementOf(withHidden(withPinned(start, "speed", true), "press", true));
    expect(readArrangement(arrangementText(arrangement))).toEqual(arrangement);
    expect(arrangementText(undefined)).toBe("");
    expect(readArrangement("")).toBeUndefined();
    expect(readArrangement(null)).toBeUndefined();
    expect(readArrangement("{not json")).toBeUndefined();
    expect(readArrangement('["theme"]')).toBeUndefined();
    // the older shape, with one place per control
    expect(readArrangement('{"order":["theme"],"places":{"theme":"toolbar"}}')).toBeUndefined();
    // what is not an id is left out
    expect(readArrangement('{"order":["theme",3],"pinned":[null,"theme"],"hidden":[]}')).toEqual({
      order: ["theme"],
      pinned: ["theme"],
      hidden: []
    });
  });
});
