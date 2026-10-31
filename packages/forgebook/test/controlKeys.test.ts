/**
 * Tests for the keys that cycle the toolbar's controls: the catalogue's keys and their defaults, a reader's own over
 * them, the refusals, a press read, and a control's next value.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { catalogueKeys, cycledValue, pressedControl, shownKeys, withReaderKey } from "../src/controlKeys.ts";
import { cycledView } from "../src/shell/controlCycle.ts";
import { NOT_FIXED } from "../src/storyGlobals.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { DEFAULT_VIEW } from "../src/viewState.ts";

const IDS = ["theme", "contrast", "backdrop", "sheets", "text", "width"];

describe("catalogueKeys", () => {
  it("gives the ready-made switches their keys, and takes the catalogue's over them", () => {
    expect(catalogueKeys(IDS)).toEqual({ theme: "t", contrast: "c" });
    expect(catalogueKeys(IDS, { theme: "s", width: "w", contrast: false })).toEqual({
      theme: "s",
      width: "w"
    });
  });

  it("refuses an unknown control, a key twice, a key of the shell's and more than one character", () => {
    expect(catalogueKeys(IDS, { zoom: "z" })).toBe(
      'The keys name "zoom", which is no control of the catalogue'
    );
    expect(catalogueKeys(IDS, { width: "t" })).toBe('The key of width: "t" is theme\'s already');
    expect(catalogueKeys(IDS, { text: "/" })).toBe('The key of text: "/" is the shell\'s own');
    expect(catalogueKeys(IDS, { text: "ab" })).toBe(
      'The key of text: "ab" is not one character in lower case'
    );
  });

  it("stops a catalogue whose keys cannot be used", () => {
    expect(() => catalogueSettings("A", DEFAULT_SWITCHES, { keys: { theme: "[" } })).toThrow(
      "Forgebook's keys"
    );
  });
});

describe("a reader's keys", () => {
  const catalogue = { theme: "t", contrast: "c" };

  it("change or take away the catalogue's, and a key back to the catalogue's is no change", () => {
    const reader = withReaderKey(catalogue, {}, "theme", "s");
    expect(reader).toEqual({ theme: "s" });
    if (typeof reader === "string") return;
    const removed = withReaderKey(catalogue, reader, "contrast", null);
    expect(removed).toEqual({ theme: "s", contrast: null });
    if (typeof removed === "string") return;
    expect(shownKeys(catalogue, removed)).toEqual({ theme: "s" });
    expect(withReaderKey(catalogue, removed, "theme", "t")).toEqual({ contrast: null });
  });

  it("refuse a key another control has", () => {
    expect(withReaderKey(catalogue, {}, "theme", "c")).toBe('"c" is contrast\'s already');
  });
});

describe("pressedControl and cycledValue", () => {
  it("reads a press without a modifier, Shift going back, and goes round the values", () => {
    const keys = { theme: "t" };
    expect(pressedControl(keys, { key: "t", shiftKey: false, hasModifier: false })).toEqual({
      id: "theme",
      step: 1
    });
    expect(pressedControl(keys, { key: "T", shiftKey: true, hasModifier: false })).toEqual({
      id: "theme",
      step: -1
    });
    expect(pressedControl(keys, { key: "t", shiftKey: false, hasModifier: true })).toBeUndefined();
    expect(cycledValue(["a", "b", "c"], "c", 1)).toBe("a");
    expect(cycledValue(["a", "b", "c"], "a", -1)).toBe("c");
  });
});

describe("cycledView", () => {
  const catalogue = catalogueSettings("A", DEFAULT_SWITCHES);

  it("moves a switch and Forgebook's own controls to their next value", () => {
    const theme = DEFAULT_SWITCHES.find((each) => each.id === "theme");
    const next = cycledView(DEFAULT_VIEW, "theme", 1, catalogue, NOT_FIXED, true);
    expect(next?.switches["theme"]).toBe(theme?.values[1]?.value);
    expect(cycledView(DEFAULT_VIEW, "sheets", 1, catalogue, NOT_FIXED, true)?.sheets).toBe("structure");
    expect(cycledView(DEFAULT_VIEW, "width", 1, catalogue, NOT_FIXED, true)?.width).toBe(
      catalogue.widths[0]?.width
    );
  });

  it("leaves a control the story fixes, or the compare view draws, as it is", () => {
    expect(
      cycledView(DEFAULT_VIEW, "theme", 1, catalogue, { switches: { theme: "dark" } }, true)
    ).toBeUndefined();
    expect(
      cycledView({ ...DEFAULT_VIEW, compare: ["theme"] }, "theme", 1, catalogue, NOT_FIXED, true)
    ).toBeUndefined();
    expect(
      cycledView(DEFAULT_VIEW, "width", 1, catalogue, { switches: {}, width: 360 }, true)
    ).toBeUndefined();
  });
});
