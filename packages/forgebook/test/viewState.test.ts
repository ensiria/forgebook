/**
 * Tests for the view in the address, over a Kaji-like library's switches.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type CatalogueSettings, catalogueSettings } from "../src/catalogue";
import type { ViewSwitch } from "../src/switches";
import {
  codeGlobalsOf,
  DEFAULT_VIEW,
  defaultView,
  frameAddress,
  hasViewChanges,
  isMoreContrastOf,
  languageOf,
  parseView,
  schemeOf,
  type ViewState,
  viewParams
} from "../src/viewState";
import { FIXTURE_SWITCHES } from "./fixtureSwitches";

/** The fixture's switches, read from and written to an address. */
const SWITCHES: readonly ViewSwitch[] = FIXTURE_SWITCHES;

/** The fixture's catalogue: its switches, and every list at its default. */
const CATALOGUE: CatalogueSettings = catalogueSettings("Fixture", SWITCHES);

/** The view without any change. */
const DEFAULTS: ViewState = defaultView(CATALOGUE);

/**
 * A view with some switches set.
 *
 * @param values - the switches' values.
 * @param rest - the rest of the view.
 */
const withSwitches = (
  values: Readonly<Record<string, string>>,
  rest: Partial<ViewState> = {}
): ViewState => ({
  ...DEFAULTS,
  ...rest,
  switches: { ...DEFAULTS.switches, ...values }
});

describe("the view in the address", () => {
  it("reads every switch, and the defaults for anything missing or invalid", () => {
    expect(
      parseView(
        "?theme=dark&contrast=more&motion=reduced&speed=slow&press=darken&sheets=structure&text=125&lang=pseudo&compare=1",
        CATALOGUE
      )
    ).toEqual(
      withSwitches(
        {
          theme: "dark",
          contrast: "more",
          motion: "reduced",
          speed: "slow",
          press: "darken",
          lang: "pseudo"
        },
        { sheets: "structure", text: 125, compare: ["theme", "contrast"] }
      )
    );
    expect(parseView("?theme=purple&text=110&motion=fast", CATALOGUE)).toEqual(DEFAULTS);
    expect(DEFAULTS.switches).toEqual({
      theme: "light",
      contrast: "standard",
      motion: "system",
      speed: "normal",
      press: "default",
      lang: ""
    });
  });

  it("writes only what differs from the defaults, the language last, and reads back the same view", () => {
    expect(viewParams(DEFAULTS, SWITCHES).toString()).toBe("");
    const view = withSwitches({ motion: "all", speed: "fast", lang: "pseudo" }, { text: 150 });
    expect(viewParams(view, SWITCHES).toString()).toBe("motion=all&speed=fast&text=150&lang=pseudo");
    expect(parseView(viewParams(view, SWITCHES).toString(), CATALOGUE)).toEqual(view);
  });

  it("marks the View menu when a menu switch, the style sheets or the text size changed, not the theme or contrast", () => {
    expect(hasViewChanges(withSwitches({ theme: "dark", contrast: "more" }), SWITCHES)).toBe(false);
    expect(hasViewChanges(withSwitches({ speed: "slow" }), SWITCHES)).toBe(true);
    expect(hasViewChanges(withSwitches({}, { sheets: "restyled" }), SWITCHES)).toBe(true);
    expect(hasViewChanges(withSwitches({ lang: "pseudo" }), SWITCHES)).toBe(true);
  });

  it("gives a frame the story and the view, never what only the shell reads", () => {
    expect(
      frameAddress(
        "frame.html",
        "kit:a-b--c",
        withSwitches(
          { theme: "dark" },
          {
            compare: ["lang"],
            width: 560,
            height: 320,
            isPanelOpen: false,
            panelTab: "code",
            zoom: 200,
            tools: ["grid"]
          }
        ),
        SWITCHES
      )
    ).toBe("frame.html?theme=dark&story=kit%3Aa-b--c");
  });

  it("keeps the stage's width and the closed panel, and reads a width out of range as the whole stage", () => {
    const view = withSwitches({}, { width: 560, isPanelOpen: false, panelTab: "a11y" });
    expect(viewParams(view, SWITCHES).toString()).toBe("width=560&panel=closed&tab=a11y");
    expect(parseView(viewParams(view, SWITCHES).toString(), CATALOGUE)).toEqual(view);
    expect(parseView("?width=12", CATALOGUE).width).toBe("fill");
    expect(parseView("?width=500.5", CATALOGUE).width).toBe("fill");
    expect(parseView("?width=wide", CATALOGUE).width).toBe("fill");
  });

  it("keeps the story's height from the foot handle, and reads one out of range as the story's own (note 142)", () => {
    const view = withSwitches({}, { width: 560, height: 320 });
    expect(viewParams(view, SWITCHES).toString()).toBe("width=560&height=320");
    expect(parseView(viewParams(view, SWITCHES).toString(), CATALOGUE)).toEqual(view);
    expect(parseView("?height=12", CATALOGUE).height).toBe("auto");
    expect(parseView("?height=99999", CATALOGUE).height).toBe("auto");
    expect(parseView("?height=tall", CATALOGUE).height).toBe("auto");
  });

  it("reads the compared axes: switches, text or sheets, two at most, and the older names", () => {
    expect(parseView("?compare=text", CATALOGUE).compare).toEqual(["text"]);
    expect(parseView("?compare=motion,speed,press", CATALOGUE).compare).toEqual(["motion", "speed"]);
    expect(parseView("?compare=1", CATALOGUE).compare).toEqual(["theme", "contrast"]);
    expect(parseView("?compare=theme", CATALOGUE).compare).toEqual(["theme", "contrast"]);
    expect(parseView("?compare=language", CATALOGUE).compare).toEqual(["lang"]);
    expect(parseView("?compare=sideways", CATALOGUE).compare).toEqual([]);
    expect(viewParams(withSwitches({}, { compare: ["sheets"] }), SWITCHES).toString()).toBe("compare=sheets");
  });

  it("keeps the zoom and the tools, in the tools' order, leaving out unknown ones", () => {
    const view = withSwitches({}, { zoom: 150, tools: ["outline", "measure"] });
    expect(viewParams(view, SWITCHES).toString()).toBe("zoom=150&tools=outline%2Cmeasure");
    expect(parseView(viewParams(view, SWITCHES).toString(), CATALOGUE)).toEqual(view);
    expect(parseView("?tools=measure,ruler,outline&zoom=300", CATALOGUE)).toMatchObject({
      tools: ["outline", "measure"],
      zoom: 100
    });
  });
});

describe("what the catalogue reads of the switches", () => {
  it("reads the scheme, the contrast and the language from their roles", () => {
    const view = withSwitches({ theme: "system", contrast: "more", lang: "pseudo" });
    expect(schemeOf(view, SWITCHES)).toBe("system");
    expect(isMoreContrastOf(view, SWITCHES)).toBe(true);
    expect(languageOf(view, SWITCHES)).toBe("pseudo");
  });

  it("draws light at the standard contrast in a catalogue without those switches", () => {
    expect(schemeOf(DEFAULT_VIEW, [])).toBe("light");
    expect(isMoreContrastOf(DEFAULT_VIEW, [])).toBe(false);
    expect(languageOf(DEFAULT_VIEW, [])).toBe("");
  });

  it("hands the story the switches applied by code: the language here", () => {
    expect(codeGlobalsOf(withSwitches({ theme: "dark", lang: "pseudo" }), SWITCHES)).toEqual({
      lang: "pseudo"
    });
  });
});
