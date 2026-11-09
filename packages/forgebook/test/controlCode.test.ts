/**
 * Tests for the code a custom control writes its values as, and where the story's code uses it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PanelProp } from "../src/argTypes.ts";
import { controlCodeOf } from "../src/controlCode.ts";
import { UNSET_ARG } from "../src/messages.ts";
import { writtenArgsOf } from "../src/storyCodeText.ts";

/** A prop a control sets. */
const prop = (name: string, customControl?: string): PanelProp => ({
  name,
  kind: "other",
  type: "IconComponent",
  description: "",
  isRequired: false,
  ...(customControl === undefined ? {} : { customControl })
});

/** The icon picker's `toCode`: an icon's name is the icon. */
const CODERS = {
  icon: (value: unknown): string | undefined =>
    typeof value === "string" && value.startsWith("Icon") ? value : undefined,
  throwing: (): never => {
    throw new Error("no");
  },
  silent: undefined
};

describe("controlCodeOf", () => {
  it("writes a control's value as the code its toCode gives, with the arg it is told of", () => {
    const seen: unknown[] = [];
    const code = controlCodeOf(
      [prop("startIcon", "icon"), prop("endIcon", "icon"), prop("label")],
      { startIcon: "IconStar", endIcon: "nope", label: "Go" },
      {
        icon: (value: unknown, argType: { readonly name: string }): string | undefined => {
          seen.push(argType.name);
          return CODERS.icon(value);
        }
      }
    );
    expect(code).toEqual({ startIcon: "IconStar" });
    expect(seen).toEqual(["startIcon", "endIcon"]);
  });

  it("writes as JSON a value with no code, no value, a control without toCode, and one that throws", () => {
    const props = [
      prop("a", "icon"),
      prop("b", "silent"),
      prop("c", "throwing"),
      prop("d", "icon"),
      prop("e", "gone")
    ];
    const args = { a: UNSET_ARG, b: "IconStar", c: "IconStar", e: "IconStar" };
    expect(controlCodeOf(props, args, CODERS)).toEqual({});
  });
});

describe("writtenArgsOf", () => {
  const code = { Basic: { args: { icon: "IconSearch", onPress: "fn()" } } };

  it("writes a control's code where the file writes none, or the arg was set", () => {
    const source = { code, exportName: "Basic", componentName: "Button", args: {} };
    expect(writtenArgsOf({ ...source, argCode: { icon: "IconStar", end: "IconHeart" } })).toEqual({
      icon: "IconSearch",
      end: "IconHeart",
      onPress: "fn()"
    });
    expect(writtenArgsOf({ ...source, edited: ["icon"], argCode: { icon: "IconStar" } })).toEqual({
      icon: "IconStar",
      onPress: "fn()"
    });
  });
});
