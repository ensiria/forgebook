/**
 * Tests for the worst case the Props tab sets: the value each kind of prop gets, the props left as they are, and when
 * the values shown are the worst case.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PanelProp } from "../src/argTypes.ts";
import { isWorstCase, WORST_ARG_TEXT, worstArgs } from "../src/shell/worstArgs.ts";
import { WORST_NUMBER, WORST_WORD } from "../src/worstCase.ts";

/** A prop of a kind, with the rest of its docs plain. */
const prop = (name: string, kind: PanelProp["kind"], extra: Partial<PanelProp> = {}): PanelProp => ({
  name,
  kind,
  type: kind === "number" ? "number" : "string",
  description: "",
  isRequired: false,
  ...extra
});

describe("worstArgs", () => {
  it("gives a text the long text with the unbreakable word, a number a huge one", () => {
    const args = worstArgs([prop("label", "text"), prop("count", "number")]);
    expect(args).toEqual({ label: WORST_ARG_TEXT, count: WORST_NUMBER });
    expect(WORST_ARG_TEXT).toContain(WORST_WORD);
  });

  it("gives a node that takes a text the text, and a number with a highest value that value", () => {
    const args = worstArgs([
      prop("children", "other", { type: "ReactNode", canTakeText: true }),
      prop("value", "number", { max: 100, control: "range" })
    ]);
    expect(args).toEqual({ children: WORST_ARG_TEXT, value: 100 });
  });

  it("leaves choices, toggles, colours, dates, lists and nodes without a text as they are", () => {
    const args = worstArgs([
      prop("size", "choice", { choices: ["small", "large"] }),
      prop("isOpen", "toggle"),
      prop("accentColor", "text"),
      prop("tint", "text", { control: "color" }),
      prop("when", "number", { control: "date" }),
      prop("variant", "text", { control: "select" }),
      prop("icon", "other", { type: "IconComponent" })
    ]);
    expect(args).toEqual({});
  });
});

describe("isWorstCase", () => {
  it("is true only when every worst-case arg holds its worst value", () => {
    const worst = { label: WORST_ARG_TEXT, count: WORST_NUMBER };
    expect(isWorstCase(worst, { ...worst, isOpen: true })).toBe(true);
    expect(isWorstCase(worst, { label: WORST_ARG_TEXT, count: 3 })).toBe(false);
    expect(isWorstCase({}, {})).toBe(false);
  });
});
