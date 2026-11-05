/**
 * Tests for what a story fixes of the view: switches by its `globals`, the background and the width as Storybook's
 * stories write them, shown over the user's view and never written into it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { fixedViewOf, NOT_FIXED, withFixed, withOwnFixed } from "../src/storyGlobals.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { DEFAULT_VIEW } from "../src/viewState.ts";

/** A catalogue with the default switches, a custom background and named widths. */
const CATALOGUE = catalogueSettings("Kit", DEFAULT_SWITCHES, {
  widths: [{ width: 360, label: "Phone" }, { width: 1024 }],
  backgrounds: { custom: [{ id: "paper", label: "Paper", light: { color: "#faf8f2" } }] }
});

describe("fixedViewOf", () => {
  it("fixes the switches the story's globals name with a value the switch has", () => {
    const fixed = fixedViewOf({ theme: "dark", other: "x", contrast: "loudest" }, {}, CATALOGUE);
    expect(fixed).toEqual({ switches: { theme: "dark" } });
  });

  it("picks a background and a width by Storybook's globals, by id or name", () => {
    const fixed = fixedViewOf(
      { backgrounds: { value: "Paper" }, viewport: { value: "phone" } },
      {},
      CATALOGUE
    );
    expect(fixed).toEqual({ switches: {}, backdrop: "paper", width: 360 });
  });

  it("reads Storybook's older parameters, a width by its number, and leaves out what the catalogue lacks", () => {
    const parameters = { backgrounds: { default: "paper" }, viewport: { defaultViewport: "1024px" } };
    expect(fixedViewOf({}, parameters, CATALOGUE)).toEqual({ switches: {}, backdrop: "paper", width: 1024 });
    expect(
      fixedViewOf({ viewport: { value: "iphone6" }, backgrounds: { value: "neon" } }, {}, CATALOGUE)
    ).toEqual(NOT_FIXED);
  });
});

describe("withFixed and withOwnFixed", () => {
  const own = { ...DEFAULT_VIEW, switches: { theme: "light" }, width: 768 as const };
  const fixed = { switches: { theme: "dark", contrast: "more" }, width: 360 };

  it("shows the story's values over the user's view", () => {
    const shown = withFixed(own, fixed);
    expect(shown.switches).toEqual({ theme: "dark", contrast: "more" });
    expect(shown.width).toBe(360);
  });

  it("keeps the view's switches object when the story fixes no switch", () => {
    expect(withFixed(own, NOT_FIXED).switches).toBe(own.switches);
  });

  it("keeps the user's own values in the address when anything else changes", () => {
    const changed = { ...withFixed(own, fixed), text: 125 };
    const kept = withOwnFixed(changed, own, fixed);
    expect(kept.switches).toEqual({ theme: "light" });
    expect(kept.width).toBe(768);
    expect(kept.text).toBe(125);
  });
});
