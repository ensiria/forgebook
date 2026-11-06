/**
 * The texts an address may hand a story whose framework writes them into markup.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { addressArgsFor, isPlainText } from "../src/addressTexts.ts";

describe("isPlainText", () => {
  it("takes words of any script, digits, spaces and the marks that close nothing", () => {
    for (const text of [
      "",
      "Save",
      "Perché no",
      "保存する",
      "50% off",
      "#ff0000",
      "v1.2-beta, ok!",
      "a_b + c?"
    ])
      expect(isPlainText(text), text).toBe(true);
  });

  it("refuses what can close a tag, an attribute or start an address", () => {
    for (const text of [
      "<b>",
      "a>b",
      'say "hi"',
      "it's",
      "`x`",
      "a&b",
      "javascript:alert(1)",
      "a=b",
      "x(1)",
      "a;b"
    ])
      expect(isPlainText(text), text).toBe(false);
  });
});

describe("addressArgsFor", () => {
  const args = {
    label: "<img src=x onerror=alert(1)>",
    tone: "danger",
    count: 3,
    isOpen: true,
    none: null,
    tags: ["a", "b"],
    bad: ["a", '"b'],
    icon: { of: "Icon", named: "starIcon" },
    "x><img src=x>": "a",
    onclick: "alert"
  };

  it("hands every value on for a framework whose texts stay text", () => {
    expect(addressArgsFor(args, "any")).toBe(args);
  });

  it("reads a nested value's texts and names too, for one whose texts may become markup", () => {
    expect(addressArgsFor({ ok: { label: "plain", list: ["a", 1] } }, "plain")).toEqual({
      ok: { label: "plain", list: ["a", 1] }
    });
    expect(addressArgsFor({ bad: { label: "<img>" } }, "plain")).toEqual({});
    expect(addressArgsFor({ bad: ["fine", { x: "<b>" }] }, "plain")).toEqual({});
    expect(addressArgsFor({ bad: { "a b<": 1 } }, "plain")).toEqual({});
  });

  it("keeps only values whose name and texts are plain for one whose texts may become markup", () => {
    expect(addressArgsFor(args, "plain")).toEqual({
      tone: "danger",
      count: 3,
      isOpen: true,
      none: null,
      tags: ["a", "b"],
      icon: { of: "Icon", named: "starIcon" },
      onclick: "alert"
    });
  });
});
