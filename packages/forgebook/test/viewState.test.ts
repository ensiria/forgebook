/**
 * Tests for the view in the address, over a design system's switches.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type CatalogueSettings, catalogueSettings } from "../src/catalogue.ts";
import { switchesProblem, touchChoiceOf, type ViewSwitch } from "../src/switches.ts";
import {
  codeGlobalsOf,
  componentAddressOf,
  DEFAULT_VIEW,
  defaultView,
  frameAddress,
  frameAddressOf,
  hasViewChanges,
  isMoreContrastOf,
  isSameLiveView,
  isTouchView,
  type LiveView,
  languageOf,
  parseView,
  schemeOf,
  type ViewState,
  viewParams,
  withTouch,
  withTouchOf
} from "../src/viewState.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

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
      lang: "",
      dir: "ltr",
      touch: "mouse"
    });
  });

  it("writes only what differs from the defaults, the language last, and reads back the same view", () => {
    expect(viewParams(DEFAULTS, SWITCHES).toString()).toBe("");
    const view = withSwitches({ motion: "all", speed: "fast", lang: "pseudo" }, { text: 150 });
    expect(viewParams(view, SWITCHES).toString()).toBe("motion=all&speed=fast&text=150&lang=pseudo");
    expect(parseView(viewParams(view, SWITCHES).toString(), CATALOGUE)).toEqual(view);
  });

  it("marks the View menu when one of its controls changed, not a control on the toolbar, nor the width", () => {
    const inMenu = ["motion", "speed", "press", "lang", "backdrop", "sheets", "text"];
    expect(hasViewChanges(withSwitches({ theme: "dark", contrast: "more" }), SWITCHES, inMenu)).toBe(false);
    expect(hasViewChanges(withSwitches({ speed: "slow" }), SWITCHES, inMenu)).toBe(true);
    expect(hasViewChanges(withSwitches({}, { sheets: "restyled" }), SWITCHES, inMenu)).toBe(true);
    expect(hasViewChanges(withSwitches({ lang: "pseudo" }), SWITCHES, inMenu)).toBe(true);
    expect(hasViewChanges(withSwitches({}, { width: 360 }), SWITCHES, [...inMenu, "width"])).toBe(false);
    // the theme moved into View: its change now marks it
    expect(hasViewChanges(withSwitches({ theme: "dark" }), SWITCHES, ["theme"])).toBe(true);
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

  it("keeps the story's height from the foot handle, and reads one out of range as the story's own", () => {
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

  it("keeps a control the catalogue turned off at its default, and never compares across it", () => {
    const catalogue = catalogueSettings("Fixture", SWITCHES, { controls: { sheets: false, text: false } });
    const view = parseView("?sheets=structure&text=150&backdrop=checkerboard&compare=text", catalogue);
    expect(view.sheets).toBe("full");
    expect(view.text).toBe(100);
    expect(view.backdrop).toBe("checkerboard");
    expect(view.compare).toEqual([]);
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

  it("keeps an audience in the page's address, never in a frame's", () => {
    const view = parseView("?audience=designer", CATALOGUE);
    expect(view.audience).toBe("designer");
    expect(viewParams(view, SWITCHES).toString()).toBe("audience=designer");
    expect(frameAddress("frame.html", "a--b", view, SWITCHES)).toBe("frame.html?story=a--b");
    expect(frameAddressOf("frame.html", "a--b", "audience=designer&theme=dark")).toBe(
      "frame.html?theme=dark&story=a--b"
    );
    expect(parseView("?audience=manager", CATALOGUE).audience).toBe("everyone");
  });

  it("writes nothing for everyone, so today's addresses and pages stay as they are", () => {
    expect(viewParams(DEFAULTS, SWITCHES).toString()).toBe("");
    expect(DEFAULTS.audience).toBe("everyone");
  });

  it("starts from the catalogue's audience, whose everyone a link must then name", () => {
    const catalogue = catalogueSettings("Fixture", SWITCHES, { audience: "designer" });
    const view = defaultView(catalogue);
    expect(view.audience).toBe("designer");
    expect(viewParams(view, SWITCHES, "designer").toString()).toBe("");
    const all = viewParams({ ...view, audience: "everyone" }, SWITCHES, "designer").toString();
    expect(all).toBe("audience=everyone");
    expect(parseView(all, catalogue).audience).toBe("everyone");
    expect(hasViewChanges(view, SWITCHES, ["audience"], "designer")).toBe(false);
    expect(hasViewChanges({ ...view, audience: "coder" }, SWITCHES, ["audience"], "designer")).toBe(true);
  });

  it("leaves the catalogue's audience alone when it turned the control off", () => {
    const catalogue = catalogueSettings("Fixture", SWITCHES, {
      audience: "tester",
      controls: { audience: false }
    });
    expect(parseView("?audience=designer", catalogue).audience).toBe("tester");
  });

  it("names a component's page in an audience's view, for a tool", () => {
    expect(componentAddressOf("http://a/", "kit:select", "audience=designer&story=x&page=y")).toBe(
      "http://a/?audience=designer&component=kit%3Aselect"
    );
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

  it("hands the story the switches applied by code, the language here, and the touch switch", () => {
    expect(codeGlobalsOf(withSwitches({ theme: "dark", lang: "pseudo" }), SWITCHES)).toEqual({
      lang: "pseudo",
      touch: "mouse"
    });
    expect(codeGlobalsOf(withSwitches({ touch: "touch" }), SWITCHES)["touch"]).toBe("touch");
  });
});

describe("the touch a story marked for a phone is drawn with", () => {
  const choice = touchChoiceOf(SWITCHES);

  it("finds the touch switch with a finger's value, and none without one", () => {
    expect(choice).toEqual({ id: "touch", touch: "touch", mouse: "mouse" });
    expect(touchChoiceOf([])).toBeUndefined();
    const own: ViewSwitch = {
      id: "input",
      label: "Input",
      role: "touch",
      apply: { kind: "code" },
      default: "pen",
      values: [{ value: "pen", label: "Pen" }]
    };
    expect(touchChoiceOf([own])).toBeUndefined();
  });

  it("turns a finger on and off, and keeps a view that already is", () => {
    if (choice === undefined) throw new Error("the fixture has a touch switch");
    const touched = withTouch(DEFAULTS, choice, true);
    expect(touched.switches["touch"]).toBe("touch");
    expect(isTouchView(touched, choice)).toBe(true);
    expect(withTouch(touched, choice, true)).toBe(touched);
    expect(withTouch(touched, choice, false).switches).toEqual(DEFAULTS.switches);
    expect(withTouch(DEFAULTS, choice, false)).toBe(DEFAULTS);
  });

  it("puts back the touch value another view has", () => {
    if (choice === undefined) throw new Error("the fixture has a touch switch");
    const changed = withSwitches({ touch: "touch", theme: "dark" });
    expect(withTouchOf(changed, DEFAULTS, choice).switches).toEqual(withSwitches({ theme: "dark" }).switches);
    expect(withTouchOf(changed, changed, choice)).toBe(changed);
  });
});

describe("the device in the address", () => {
  it("reads off and a model's id, the story's own (auto) for anything else, and writes only what is set", () => {
    expect(parseView("", CATALOGUE)).toMatchObject({ device: "auto", orientation: "auto" });
    expect(parseView("forgebook.device=pixel-9&forgebook.orientation=landscape", CATALOGUE)).toMatchObject({
      device: "pixel-9",
      orientation: "landscape"
    });
    expect(parseView("forgebook.device=off", CATALOGUE).device).toBe("off");
    expect(
      parseView("forgebook.device=nokia-3310&forgebook.orientation=upside-down", CATALOGUE)
    ).toMatchObject({
      device: "auto",
      orientation: "auto"
    });
    const view: ViewState = { ...DEFAULT_VIEW, device: "ipad-mini", orientation: "landscape" };
    expect(viewParams(view, SWITCHES).toString()).toBe(
      "forgebook.device=ipad-mini&forgebook.orientation=landscape"
    );
    expect(viewParams(DEFAULT_VIEW, SWITCHES).toString()).toBe("");
  });

  it("leaves the device out of a frame's address: the frame is the story's own document, never the device", () => {
    const view: ViewState = { ...DEFAULT_VIEW, device: "iphone-16" };
    expect(frameAddress("frame.html", "kit:a--b", view, SWITCHES)).toBe("frame.html?story=kit%3Aa--b");
    expect(
      frameAddressOf(
        "frame.html",
        "kit:a--b",
        "forgebook.device=iphone-16&forgebook.orientation=landscape&theme=dark"
      )
    ).toBe("frame.html?theme=dark&story=kit%3Aa--b");
  });

  it("leaves `device` and `orientation` to a catalogue's own switches of those names", () => {
    const own = (id: string): ViewSwitch => ({
      id,
      label: id,
      apply: { kind: "attribute", name: `data-${id}` },
      default: "desktop",
      values: [
        { value: "desktop", label: "Desktop" },
        { value: "tablet", label: "Tablet" }
      ]
    });
    const switches = [own("device"), own("orientation")];
    expect(switchesProblem(switches)).toBeUndefined();
    const catalogue = catalogueSettings("Fixture", switches);
    const view = parseView("device=tablet&orientation=tablet&forgebook.device=pixel-9", catalogue);
    expect(view).toMatchObject({
      switches: { device: "tablet", orientation: "tablet" },
      device: "pixel-9",
      orientation: "auto"
    });
    expect(viewParams(view, switches).toString()).toBe(
      "device=tablet&orientation=tablet&forgebook.device=pixel-9"
    );
  });
});

describe("whether two live views show the same", () => {
  const shown: LiveView = { switches: { theme: "dark", lang: "it" }, backdrop: "plain", text: 100 };

  it("reads the values, not the objects or the order of the switches", () => {
    expect(
      isSameLiveView(shown, { switches: { lang: "it", theme: "dark" }, backdrop: "plain", text: 100 })
    ).toBe(true);
  });

  it.each([
    ["a switch's value", { ...shown, switches: { theme: "light", lang: "it" } }],
    ["the language", { ...shown, switches: { theme: "dark", lang: "en" } }],
    ["a switch set", { ...shown, switches: { theme: "dark", lang: "it", motion: "reduced" } }],
    ["a switch taken away", { ...shown, switches: { theme: "dark" } }],
    ["another switch in its place", { ...shown, switches: { theme: "dark", dir: "it" } }],
    ["the backdrop", { ...shown, backdrop: "paper" }],
    ["the text size", { ...shown, text: 110 }]
  ])("sees a change of %s", (_name, other) => {
    expect(isSameLiveView(shown, other)).toBe(false);
    expect(isSameLiveView(other, shown)).toBe(false);
  });
});
