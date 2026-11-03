/**
 * Tests for the values a source names for the props panel.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type NamedValues, namedValueOf, nameOf, panelArgsOf, storyArgsOf } from "../src/namedValues.ts";

/** Two components a source names. */
const IconBell = (): null => null;
const IconFolder = (): null => null;

/** The source's named values. */
const NAMED: NamedValues = { IconComponent: { IconBell, IconFolder } };

describe("named values", () => {
  it("finds a value's name", () => {
    expect(nameOf(IconFolder, NAMED)).toEqual({ of: "IconComponent", named: "IconFolder" });
    expect(nameOf(() => null, NAMED)).toBeUndefined();
  });

  it("gives the panel a story's texts, numbers, booleans, nulls, choice lists and named values, nothing else", () => {
    expect(
      panelArgsOf(
        {
          size: "sm",
          rows: 3,
          isOpen: true,
          none: null,
          onX: () => 1,
          sides: ["top", 2],
          items: [{ id: 1 }],
          icon: IconBell
        },
        NAMED
      )
    ).toEqual({
      size: "sm",
      rows: 3,
      isOpen: true,
      none: null,
      sides: ["top", 2],
      icon: { of: "IconComponent", named: "IconBell" }
    });
  });

  it("turns the panel's names back into values, leaving out a name the source no longer offers", () => {
    expect(
      storyArgsOf(
        {
          size: "sm",
          icon: { of: "IconComponent", named: "IconFolder" },
          old: { of: "IconComponent", named: "IconGone" }
        },
        NAMED
      )
    ).toEqual({ size: "sm", icon: IconFolder });
  });

  it("never reaches a value through a prototype: a name is looked up among the source's own entries", () => {
    expect(
      storyArgsOf(
        {
          viaObject: { of: "constructor", named: "constructor" },
          viaPrototype: { of: "__proto__", named: "constructor" },
          viaEntry: { of: "IconComponent", named: "constructor" },
          viaToString: { of: "IconComponent", named: "toString" }
        },
        NAMED
      )
    ).toEqual({});
    expect(namedValueOf({}, "constructor", "constructor")).toBeUndefined();
    expect(namedValueOf(NAMED, "IconComponent", "IconBell")).toBe(IconBell);
  });
});
