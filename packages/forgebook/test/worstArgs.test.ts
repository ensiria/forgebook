/**
 * Tests for the worst case the Props tab sets: the value each kind of prop gets, the props left as they are, and when
 * the values shown are the worst case.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PanelProp } from "../src/argTypes.ts";
import { worstOfShape } from "../src/shapeValues.ts";
import { isWorstCase, worstArgs } from "../src/shell/worstArgs.ts";
import { WORST_ARG_TEXT, WORST_NUMBER, WORST_WORD } from "../src/worstCase.ts";

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

  it("fills nested fields, lists and a union's first member with a worst case", () => {
    const args = worstArgs(
      [
        prop("tags", "other", { shape: { kind: "list", of: { kind: "text" } } }),
        prop("box", "other", {
          shape: {
            kind: "object",
            fields: [
              { name: "label", shape: { kind: "text" }, isRequired: true },
              { name: "tone", shape: { kind: "choice", values: ["a", "b"] }, isRequired: true },
              { name: "isOn", shape: { kind: "boolean" }, isRequired: false }
            ]
          }
        }),
        prop("size", "other", {
          shape: { kind: "union", of: [{ kind: "choice", values: ["sm"] }, { kind: "number" }] }
        }),
        prop("free", "other", { shape: { kind: "json" } }),
        prop("flag", "other", { shape: { kind: "boolean" } })
      ],
      {},
      worstOfShape
    );
    expect(args["box"]).toEqual({ label: WORST_ARG_TEXT, tone: "a" });
    expect(args["size"]).toBe(WORST_NUMBER);
    expect(Array.isArray(args["tags"]) && args["tags"].length).toBe(12);
    expect(args).not.toHaveProperty("free");
    expect(args).not.toHaveProperty("flag");
  });

  it("reads a value that came back from the address as the worst case it is", () => {
    const worst = { box: { label: WORST_ARG_TEXT }, tags: [WORST_ARG_TEXT] };
    expect(isWorstCase(worst, JSON.parse(JSON.stringify(worst)))).toBe(true);
    expect(isWorstCase(worst, { ...worst, tags: [] })).toBe(false);
  });
});
