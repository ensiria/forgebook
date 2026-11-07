/**
 * Tests for the cases of a stress run: each needs something to set, and a case with nothing to set is named, not passed.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { RTL_TEXT, stressPlan } from "../bin/forgebook/stressCases.ts";
import { isStressFailure, stressText } from "../bin/forgebook/stressText.ts";
import type { StoryControl } from "../src/storyControls.ts";
import { catalogueSwitches } from "../src/switches.ts";
import { WORST_NUMBER, WORST_TEXT, WORST_WORD } from "../src/worstCase.ts";

const control = (
  name: string,
  kind: StoryControl["control"],
  extra: Partial<StoryControl> = {}
): StoryControl => ({
  name,
  control: kind,
  type: "string",
  isRequired: false,
  ...extra
});

const SWITCHES = catalogueSwitches(undefined, [], undefined);

describe("stressPlan", () => {
  it("fills every text and number prop, and runs every view the catalogue has", () => {
    const plan = stressPlan(
      [control("label", "text"), control("count", "number", { max: 99 }), control("tone", "select")],
      SWITCHES
    );
    const byName = new Map(plan.cases.map((each) => [each.name, each]));
    expect(byName.get("long-text")?.args).toEqual({ label: WORST_TEXT });
    expect(byName.get("unbreakable")?.args).toEqual({ label: WORST_WORD });
    expect(byName.get("empty")?.args).toEqual({ label: "" });
    expect(byName.get("empty")?.expectedRules).toContain("button-name");
    expect(byName.get("huge-number")?.args).toEqual({ count: 99 });
    expect(byName.get("rtl")).toMatchObject({ args: { label: RTL_TEXT }, view: "dir=rtl" });
    expect(byName.get("narrow")?.width).toBe(320);
    expect(byName.get("zoom-200")?.width).toBe(640);
    expect(byName.get("dark")?.view).toBe("theme=dark");
    expect(byName.get("contrast")?.view).toContain("more");
    expect(plan.skipped).toEqual([]);
  });

  it("leaves alone the text props that name something rather than show it", () => {
    const names = [
      "icon",
      "startIcon",
      "id",
      "className",
      "qa",
      "aria-labelledby",
      "popupClassName",
      "href",
      "data-test",
      "name"
    ];
    const plan = stressPlan([control("label", "text"), ...names.map((name) => control(name, "text"))], []);
    expect(plan.cases.find((each) => each.name === "long-text")?.args).toEqual({ label: WORST_TEXT });
  });

  it("names a case with nothing to set as not run", () => {
    const plan = stressPlan([control("open", "boolean")], []);
    expect(plan.cases.map((each) => each.name)).toEqual(["rtl", "zoom-200", "narrow"]);
    expect(plan.skipped).toEqual([
      "long-text: no prop takes text",
      "unbreakable: no prop takes text",
      "empty: no prop takes text",
      "huge-number: no prop takes a number",
      "dark: the catalogue has no dark scheme",
      "contrast: the catalogue has no more-contrast value"
    ]);
    expect(plan.cases.find((each) => each.name === "rtl")?.isRtl).toBe(true);
  });

  it("gives a number with no highest value the worst number", () => {
    expect(stressPlan([control("n", "number")], []).cases[0]?.args).toEqual({ n: WORST_NUMBER });
  });
});

describe("stressText", () => {
  const plain = {
    name: "plain",
    storyId: "kit:a--b",
    args: {},
    frame: "f",
    problems: [{ kind: "axe" as const, message: "old" }]
  };

  it("fails on what a case adds, never on what the plain story already has", () => {
    expect(isStressFailure({ schema: 1, cases: [plain], skipped: [] })).toBe(false);
    const broken = {
      ...plain,
      name: "narrow",
      problems: [{ kind: "spill" as const, message: "spills 40px" }]
    };
    expect(isStressFailure({ schema: 1, cases: [plain, broken], skipped: [] })).toBe(true);
    expect(stressText({ schema: 1, cases: [plain, broken], skipped: ["kit:a--b: dark: none"] })).toBe(
      "kit:a--b narrow: spills 40px\nnot run: kit:a--b: dark: none\n1 cases, 1 break what the plain story does not"
    );
  });

  it("fails on a case it could not judge", () => {
    const unjudged = { ...plain, name: "rtl", problems: [], notVerified: "did not draw" };
    expect(isStressFailure({ schema: 1, cases: [plain, unjudged], skipped: [] })).toBe(true);
  });
});
