/**
 * Tests for what a value of several parts looks like: which values fit a shape, which a link's author cannot slip through
 * it, what the panel starts from, and the shape a story's own arg shows.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ArgValue } from "../src/messages.ts";
import {
  isFileList,
  isValueOfShape,
  resolvedShape,
  shapeOfValue,
  startValueOf,
  worstOfShape
} from "../src/shapeValues.ts";
import { canSetShape, type ValueShape } from "../src/valueShape.ts";
import { WORST_ARG_TEXT, WORST_NUMBER } from "../src/worstCase.ts";

/** An object with a required and an optional field. */
const ADDRESS: ValueShape = {
  kind: "object",
  fields: [
    { name: "street", shape: { kind: "text" }, isRequired: true },
    { name: "floor", shape: { kind: "number" }, isRequired: false }
  ]
};

/** A union of a choice and a number. */
const SIZE: ValueShape = {
  kind: "union",
  of: [{ kind: "choice", values: ["sm", "md"] }, { kind: "number" }]
};

/** A field only the source's named values can fill. */
const ICON: ValueShape = { kind: "named", type: "Icon" };

/** Named values of the fixtures. */
const NAMED = { Icon: { Star: (): string => "*" } };

/** Whether a value fits, with the fixtures' named values. */
const fits = (shape: ValueShape, value: ArgValue): boolean => isValueOfShape(shape, value, NAMED);

describe("isValueOfShape", () => {
  it("takes an object with what its type declares, and refuses any other name", () => {
    expect(fits(ADDRESS, { street: "a" })).toBe(true);
    expect(fits(ADDRESS, { street: "a", floor: 2 })).toBe(true);
    expect(fits(ADDRESS, { floor: 2 })).toBe(false);
    expect(fits(ADDRESS, { street: "a", onclick: "x" })).toBe(false);
    expect(fits(ADDRESS, { street: 1 })).toBe(false);
    expect(fits(ADDRESS, ["a"])).toBe(false);
  });

  it("does not read a field through an object's prototype", () => {
    const shape: ValueShape = {
      kind: "object",
      fields: [{ name: "toString", shape: { kind: "text" }, isRequired: true }]
    };
    expect(fits(shape, {})).toBe(false);
  });

  it("takes a list of its items, a tuple of its length, a union's members", () => {
    expect(fits({ kind: "list", of: { kind: "text" } }, ["a", "b"])).toBe(true);
    expect(fits({ kind: "list", of: { kind: "text" } }, ["a", 1])).toBe(false);
    const pair: ValueShape = { kind: "tuple", items: [{ kind: "number" }, { kind: "number" }] };
    expect(fits(pair, [1, 2])).toBe(true);
    expect(fits(pair, [1])).toBe(false);
    expect(fits(pair, [1, 2, 3])).toBe(false);
    expect(fits(SIZE, "sm")).toBe(true);
    expect(fits(SIZE, 12)).toBe(true);
    expect(fits(SIZE, "xl")).toBe(false);
    expect(fits(SIZE, true)).toBe(false);
  });

  it("takes a named part only among the source's own values, never through a prototype", () => {
    expect(fits(ICON, { of: "Icon", named: "Star" })).toBe(true);
    expect(fits(ICON, { of: "Icon", named: "Nope" })).toBe(false);
    expect(fits(ICON, { of: "Icon", named: "constructor" })).toBe(false);
    expect(fits(ICON, { of: "Other", named: "Star" })).toBe(false);
    expect(fits(ICON, "text")).toBe(false);
    expect(fits({ ...ICON, canTakeText: true }, "text")).toBe(true);
  });

  it("keeps out of what no type describes the names that run a script or write markup", () => {
    const json: ValueShape = { kind: "json" };
    expect(fits(json, { a: [1, { b: null }], once: true, only: 1 })).toBe(true);
    for (const name of [
      "onclick",
      "onClick",
      "onerror",
      "innerHTML",
      "dangerouslySetInnerHTML",
      "srcDoc",
      "srcdoc"
    ]) {
      expect(fits(json, { [name]: "x" })).toBe(false);
      expect(fits(json, { deep: [{ [name]: "x" }] })).toBe(false);
      expect(fits({ kind: "record", of: { kind: "text" } }, { [name]: "x" })).toBe(false);
    }
    expect(fits({ kind: "record", of: { kind: "number" } }, { a: 1, b: 2 })).toBe(true);
    expect(fits({ kind: "record", of: { kind: "number" } }, { a: "x" })).toBe(false);
  });
});

describe("canSetShape", () => {
  it("says no when a required part has no named value to fill it", () => {
    const required: ValueShape = {
      kind: "object",
      fields: [{ name: "icon", shape: { kind: "named", type: "Gone" }, isRequired: true }]
    };
    const optional: ValueShape = {
      kind: "object",
      fields: [{ name: "icon", shape: { kind: "named", type: "Gone" }, isRequired: false }]
    };
    expect(canSetShape(required, NAMED)).toBe(false);
    expect(canSetShape(optional, NAMED)).toBe(true);
    expect(canSetShape({ kind: "list", of: { kind: "named", type: "Gone" } }, NAMED)).toBe(false);
    expect(canSetShape({ kind: "list", of: ICON }, NAMED)).toBe(true);
  });
});

describe("startValueOf", () => {
  it("starts from what the required parts must hold, which fits the shape", () => {
    expect(startValueOf(ADDRESS, NAMED)).toEqual({ street: "" });
    expect(startValueOf(SIZE, NAMED)).toBe("sm");
    expect(startValueOf({ kind: "tuple", items: [{ kind: "number" }, { kind: "boolean" }] }, NAMED)).toEqual([
      0,
      false
    ]);
    expect(startValueOf(ICON, NAMED)).toEqual({ of: "Icon", named: "Star" });
    expect(startValueOf({ kind: "named", type: "Gone" }, NAMED)).toBeUndefined();
    const shapes: readonly ValueShape[] = [
      ADDRESS,
      SIZE,
      ICON,
      { kind: "list", of: ADDRESS },
      { kind: "record", of: SIZE }
    ];
    for (const shape of shapes) {
      const start = startValueOf(shape, NAMED);
      expect(start !== undefined && fits(shape, start)).toBe(true);
    }
  });
});

describe("shapeOfValue", () => {
  it("reads fields from an object and an item's shape from a list that looks alike", () => {
    const shape = shapeOfValue({ a: "x", b: [1, 2], c: { d: true } });
    expect(shape).toEqual({
      kind: "object",
      fields: [
        { name: "a", shape: { kind: "text" }, isRequired: false },
        { name: "b", shape: { kind: "list", of: { kind: "number" } }, isRequired: false },
        {
          name: "c",
          shape: { kind: "object", fields: [{ name: "d", shape: { kind: "boolean" }, isRequired: false }] },
          isRequired: false
        }
      ]
    });
    expect(shapeOfValue(["a", 1])).toEqual({ kind: "list", of: { kind: "json" } });
    expect(shapeOfValue([])).toEqual({ kind: "list", of: { kind: "json" } });
    expect(shapeOfValue(null)).toEqual({ kind: "json" });
  });
});

describe("what a link may not give through what no type describes", () => {
  it("refuses Vue's marks, an address that runs and a named value", () => {
    const json: ValueShape = { kind: "json" };
    for (const name of [".innerHTML", "^onclick", ":href", "@click", "xlink:href"]) {
      expect(fits(json, { [name]: "x" })).toBe(false);
    }
    for (const text of [
      "javascript:alert(1)",
      " JavaScript:x",
      "java\tscript:x",
      "vbscript:x",
      "data:text/html,x"
    ]) {
      expect(fits(json, { href: text })).toBe(false);
      expect(fits(json, [text])).toBe(false);
    }
    expect(fits(json, { of: "Icon", named: "Star" })).toBe(false);
    expect(fits(json, { deep: { of: "Icon", named: "Star" } })).toBe(false);
    expect(fits(json, { href: "https://example.com", src: "a.png" })).toBe(true);
  });
});

describe("isFileList", () => {
  it("keeps small files of the types no browser runs as a page", () => {
    expect(
      isFileList(["data:image/png;base64,AA==", "data:text/plain,hi", "data:application/pdf;base64,AA=="])
    ).toBe(true);
    for (const type of [
      "text/html",
      "image/svg+xml",
      "application/xhtml+xml",
      "text/xml",
      "application/javascript"
    ]) {
      expect(isFileList([`data:${type},x`])).toBe(false);
    }
    expect(isFileList(["https://example.com/a.png"])).toBe(false);
    expect(isFileList([`data:image/png;base64,${"A".repeat(9000)}`])).toBe(false);
    expect(isFileList("data:image/png;base64,AA==")).toBe(false);
  });
});

describe("a shape read from a story's own arg", () => {
  it("is read when it is needed, and holds a link to what the arg looks like", () => {
    const like: ValueShape = { kind: "like", value: { a: "x" } };
    expect(resolvedShape(like)).toEqual(shapeOfValue({ a: "x" }));
    expect(fits(like, { a: "y" })).toBe(true);
    expect(fits(like, { b: "y" })).toBe(false);
  });
});

describe("worstOfShape", () => {
  it("fills what a type allows, and leaves out what no address could hold", () => {
    expect(worstOfShape({ kind: "number" }, NAMED)).toBe(WORST_NUMBER);
    expect(worstOfShape({ kind: "list", of: { kind: "text" } }, NAMED)).toHaveLength(12);
    let deep: ValueShape = { kind: "text" };
    for (let level = 0; level < 5; level += 1) deep = { kind: "list", of: deep };
    expect(worstOfShape(deep, NAMED)).toBeUndefined();
    const nested = worstOfShape({ kind: "list", of: { kind: "list", of: { kind: "number" } } }, NAMED);
    expect(JSON.stringify(nested).length).toBeLessThan(3000);
    expect(worstOfShape({ kind: "choice", values: ["a"] }, NAMED)).toBeUndefined();
    expect(WORST_ARG_TEXT.length).toBeGreaterThan(40);
  });
});
