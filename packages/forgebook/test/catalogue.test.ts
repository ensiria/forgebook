/**
 * Tests for a catalogue's lists: the defaults a catalogue that sets none gets, what each list changes, how presets
 * merge under the catalogue, and the shell's texts replaced.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings, groupLabel } from "../src/catalogue";
import { configureStrings, STRINGS } from "../src/shell/strings";
import { groupedStories } from "../src/storyTree";
import { DEFAULT_SWITCHES } from "../src/switches";
import { mergedLists } from "../src/vite/configFile";

describe("catalogueSettings", () => {
  it("gives a catalogue that sets no list today's: four widths, six zoom steps, three text sizes, five backgrounds", () => {
    const settings = catalogueSettings("Acme UI", DEFAULT_SWITCHES);
    expect(settings.id).toBe("acme-ui");
    expect(settings.widths.map((preset) => preset.width)).toEqual([360, 560, 768, 1024]);
    expect(settings.zooms).toEqual([50, 75, 100, 125, 150, 200]);
    expect(settings.textSizes).toEqual([100, 125, 150]);
    expect(settings.backdrops.map((backdrop) => backdrop.id)).toEqual([
      "checkerboard",
      "gradient",
      "lightDesktop",
      "darkDesktop",
      "content"
    ]);
    expect(settings.tabs).toEqual(["props", "events", "play", "parts", "code", "a11y"]);
    expect(settings.gridStep).toBe(8);
  });

  it("keeps the built-in backgrounds it names, adds its own, turns tabs off, and keeps 100 % among the steps", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES, {
      backgrounds: {
        builtIn: ["checkerboard"],
        custom: [{ id: "paper", label: "Paper", light: { color: "#fff" } }]
      },
      tabs: { a11y: false, parts: false },
      zooms: [150, 100, 50],
      textSizes: [110, 120]
    });
    expect(settings.backdrops.map((backdrop) => backdrop.id)).toEqual(["checkerboard", "paper"]);
    expect(settings.tabs).toEqual(["props", "events", "play", "code"]);
    expect(settings.zooms).toEqual([50, 100, 150]);
    // without 100 %, the view without change would have no text size: the default list stays
    expect(settings.textSizes).toEqual([100, 125, 150]);
    expect(catalogueSettings("A", DEFAULT_SWITCHES, { backgrounds: { builtIn: false } }).backdrops).toEqual(
      []
    );
  });
});

describe("mergedLists", () => {
  it("takes the catalogue's single values over its presets', and merges the entries by id", () => {
    const merged = mergedLists([
      {
        gridStep: 4,
        storyGroups: [
          { id: "states", label: "States" },
          { id: "motion", label: "Motion" }
        ],
        tabs: { a11y: false },
        a11y: { tags: ["wcag2a"], disabledRules: ["region"] },
        strings: { props: "Controls" }
      },
      {
        gridStep: 10,
        storyGroups: [{ id: "motion", label: "Animation" }],
        a11y: { disabledRules: ["color-contrast"] },
        strings: { events: "Actions" }
      }
    ]);
    expect(merged.gridStep).toBe(10);
    expect(merged.storyGroups).toEqual([
      { id: "states", label: "States" },
      { id: "motion", label: "Animation" }
    ]);
    expect(merged.tabs).toEqual({ a11y: false });
    expect(merged.a11y).toEqual({ tags: ["wcag2a"], disabledRules: ["region", "color-contrast"] });
    expect(merged.strings).toEqual({ props: "Controls", events: "Actions" });
  });
});

describe("story groups", () => {
  it("lists the named groups in the catalogue's order, then the others by id, and names an unnamed one by its id", () => {
    const story = (
      group: string | undefined
    ): { id: string; exportName: string; name: string; group: string | undefined } => ({
      id: group ?? "none",
      exportName: "X",
      name: "X",
      group
    });
    const sections = groupedStories(
      [story("zeta"), story("behaviour"), story(undefined), story("alpha"), story("states")].map((each) => ({
        ...each,
        controls: "all" as const,
        description: undefined,
        height: undefined,
        isMain: false
      })),
      ["states", "behaviour"]
    );
    expect(sections.map((section) => section.group)).toEqual([
      undefined,
      "states",
      "behaviour",
      "alpha",
      "zeta"
    ]);
    expect(groupLabel([{ id: "states", label: "States" }], "alpha")).toBe("alpha");
  });
});

describe("configureStrings", () => {
  it("replaces plain texts by their path, and leaves a text that takes values and an unknown path alone", () => {
    const allStories = STRINGS.allStories;
    configureStrings({
      "tabs.parts": "Parts and hooks",
      search: "Find",
      allStories: "All",
      "nothing.here": "x"
    });
    expect(STRINGS.tabs.parts).toBe("Parts and hooks");
    expect(STRINGS.allStories).toBe(allStories);
    expect(Object.keys(STRINGS)).not.toContain("nothing");
  });
});
