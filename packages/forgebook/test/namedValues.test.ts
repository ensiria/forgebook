/**
 * Tests for the values a source names for the props panel.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type NamedValues, nameOf, panelArgsOf, storyArgsOf } from "../src/namedValues";

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

  it("gives the panel a story's texts, numbers, booleans, nulls and named values, and nothing else", () => {
    expect(
      panelArgsOf(
        { size: "sm", rows: 3, isOpen: true, none: null, onX: () => 1, list: [], icon: IconBell },
        NAMED
      )
    ).toEqual({
      size: "sm",
      rows: 3,
      isOpen: true,
      none: null,
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
});
