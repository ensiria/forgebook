/**
 * Tests for a catalogue's lists: the defaults a catalogue that sets none gets, what each list changes, how presets
 * merge under the catalogue, and the shell's texts replaced.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings, groupLabel } from "../src/catalogue.ts";
import { LATER_STRINGS } from "../src/shell/laterStrings.ts";
import { configureStrings, STRINGS, textsByName, textsOfGroup } from "../src/shell/strings.ts";
import { groupedStories } from "../src/storyTree.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { mergedLists } from "../src/vite/configFile.ts";

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
    expect(settings.tabs).toEqual(["props", "events", "play", "parts", "code", "a11y", "signature"]);
    expect(settings.gridStep).toBe(8);
    expect(settings.appearance).toBe("system");
    expect(settings.propGroups).toEqual([]);
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
    expect(settings.tabs).toEqual(["props", "events", "play", "code", "signature"]);
    expect(settings.zooms).toEqual([50, 100, 150]);
    // without 100 %, the view without change would have no text size: the default list stays
    expect(settings.textSizes).toEqual([100, 125, 150]);
    expect(catalogueSettings("A", DEFAULT_SWITCHES, { backgrounds: { builtIn: false } }).backdrops).toEqual(
      []
    );
  });
});

describe("the audience", () => {
  it("is everyone unless the catalogue says otherwise, with its control in the View menu only", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES);
    expect(settings.audience).toBe("everyone");
    expect(settings.ownControls).toContain("audience");
    expect(settings.toolbar).not.toContain("audience");
  });

  it("takes the catalogue's audience, and pins it when asked", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES, {
      audience: "tester",
      toolbar: ["audience"]
    });
    expect(settings.audience).toBe("tester");
    expect(settings.toolbar).toEqual(["audience"]);
  });

  it("keeps a configuration's audience through the merge of its lists", () => {
    expect(mergedLists([{ audience: "coder" }, { audience: "tester" }]).audience).toBe("tester");
  });
});

describe("the Embed button", () => {
  it("is offered unless a catalogue turns it off", () => {
    expect(catalogueSettings("A", DEFAULT_SWITCHES).hasEmbed).toBe(true);
    expect(catalogueSettings("A", DEFAULT_SWITCHES, { controls: { embed: false } }).hasEmbed).toBe(false);
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
    expect(mergedLists([{ appearance: "dark" }, {}]).appearance).toBe("dark");
    expect(mergedLists([{ appearance: "dark" }, { appearance: "light" }]).appearance).toBe("light");
    expect(merged.storyGroups).toEqual([
      { id: "states", label: "States" },
      { id: "motion", label: "Animation" }
    ]);
    expect(merged.tabs).toEqual({ a11y: false });
    expect(merged.a11y).toEqual({ tags: ["wcag2a"], disabledRules: ["region", "color-contrast"] });
    expect(merged.strings).toEqual({ props: "Controls", events: "Actions" });
  });

  it("turns off a control any of them turns off, and takes the last toolbar named", () => {
    const merged = mergedLists([
      { controls: { sheets: false }, toolbar: ["theme"] },
      { controls: { width: false } },
      { toolbar: ["contrast", "theme"] }
    ]);
    expect(merged.controls).toEqual({ sheets: false, width: false });
    expect(merged.toolbar).toEqual(["contrast", "theme"]);
    expect(mergedLists([{ toolbar: ["theme"] }, {}]).toolbar).toEqual(["theme"]);
  });

  it("takes the prop groups' order the last names, as a whole list", () => {
    expect(mergedLists([{ propGroups: ["Texts"] }, {}]).propGroups).toEqual(["Texts"]);
    expect(
      mergedLists([{ propGroups: ["Texts"] }, { propGroups: ["Selection", "Paging"] }]).propGroups
    ).toEqual(["Selection", "Paging"]);
    expect(catalogueSettings("A", DEFAULT_SWITCHES, { propGroups: ["Paging"] }).propGroups).toEqual([
      "Paging"
    ]);
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
        file: "x.stories.tsx",
        controls: "all" as const,
        description: undefined,
        height: undefined,
        device: undefined,
        design: undefined,
        tags: [],
        hasPlay: false,
        isMain: false,
        isTouch: false,
        isLogic: false
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
  it("reaches the texts that load after it", () => {
    configureStrings({ "lateTexts.title": "Replaced" });
    expect(textsOfGroup("lateTexts", { title: "Written", other: "Kept" })).toEqual({
      title: "Replaced",
      other: "Kept"
    });
    configureStrings({});
  });

  it("reaches the later parts' texts by the plain names they share with the first screen's", () => {
    configureStrings({
      copy: "Copia",
      "droppedArgReasons.type": "Tipo",
      "copied.x": "No",
      usedInMore: "Many"
    });
    const usedInMore = (count: number): string => String(count);
    const texts = textsByName({
      copy: "Copy",
      droppedArgReasons: { undeclared: "Not a prop", type: "Not its type" },
      usedInMore
    });
    expect(texts).toEqual({
      copy: "Copia",
      droppedArgReasons: { undeclared: "Not a prop", type: "Tipo" },
      usedInMore
    });
    configureStrings({});
  });

  it("keeps each text in one place: no later part's text has a name of the first screen's", () => {
    const shared = Object.keys(LATER_STRINGS).filter((name) => Object.hasOwn(STRINGS, name));
    expect(shared).toEqual([]);
  });

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

  it("frames no story by default, takes the catalogue's device, and leaves out a model that is none", () => {
    expect(catalogueSettings("Acme UI", DEFAULT_SWITCHES).device).toEqual({
      isFramed: false,
      model: "phone",
      orientation: "portrait",
      isTouch: true,
      isEdgeToEdge: false
    });
    expect(
      catalogueSettings("Acme UI", DEFAULT_SWITCHES, { device: { frame: true, model: "pixel-9" } }).device
    ).toEqual({
      isFramed: true,
      model: "pixel-9",
      orientation: "portrait",
      isTouch: true,
      isEdgeToEdge: false
    });
    expect(
      catalogueSettings("Acme UI", DEFAULT_SWITCHES, { device: { model: "nokia-3310" } }).device.model
    ).toBe("phone");
  });
});
