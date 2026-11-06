/**
 * Tests for the schema of a custom control's value: what each keyword refuses, and a schema that says more than this check
 * reads, which is refused whole.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ValueSchema } from "../src/argControl.ts";
import type { ArgValue } from "../src/messages.ts";
import { isValueSchema, schemaProblem } from "../src/valueSchema.ts";

describe("schemaProblem", () => {
  it.each<[string, ValueSchema, ArgValue, boolean]>([
    ["a type", { type: "integer" }, 3, true],
    ["a type", { type: "integer" }, 3.5, false],
    ["a type", { type: "integer" }, "3", false],
    ["several types", { type: ["string", "null"] }, null, true],
    ["several types", { type: ["string", "null"] }, 1, false],
    ["an enum", { enum: ["a", 2] }, 2, true],
    ["an enum", { enum: ["a", 2] }, "b", false],
    ["a const", { const: { a: 1 } }, { a: 1 }, true],
    ["a const", { const: "a" }, "b", false],
    ["bounds", { minimum: 1, maximum: 3 }, 2, true],
    ["bounds", { minimum: 1, maximum: 3 }, 4, false],
    ["a text's length", { minLength: 1, maxLength: 2 }, "abc", false],
    ["a pattern", { pattern: "^a" }, "ab", true],
    ["a pattern", { pattern: "^a" }, "ba", false],
    ["items", { items: { type: "string" }, minItems: 1, maxItems: 2 }, ["a"], true],
    ["items", { items: { type: "string" } }, ["a", 1], false],
    ["items", { minItems: 1 }, [], false],
    ["fields", { properties: { a: { type: "string" } }, required: ["a"] }, { a: "x" }, true],
    ["fields", { required: ["a"] }, {}, false],
    ["fields", { properties: { a: { type: "string" } } }, { a: 1 }, false],
    ["other fields", { properties: {}, additionalProperties: false }, { a: 1 }, false],
    ["other fields", { additionalProperties: { type: "number" } }, { a: "x" }, false],
    ["other fields", {}, { a: 1 }, true],
    ["forms", { anyOf: [{ type: "string" }, { type: "number" }] }, 1, true],
    ["forms", { anyOf: [{ type: "string" }, { type: "number" }] }, true, false]
  ])("reads %s: %j, %j", (_keyword, schema, value, fits) => {
    expect(schemaProblem(schema, value) === undefined).toBe(fits);
  });

  it("does not read a field through an object's prototype", () => {
    expect(schemaProblem({ required: ["toString"] }, {})).toContain("toString");
    expect(schemaProblem({ properties: { a: { type: "string" } } }, { toString: 1 })).toBeUndefined();
  });

  it("reads an object's fields in any order, and counts characters as a reader does", () => {
    expect(schemaProblem({ const: { a: 1, b: 2 } }, { b: 2, a: 1 })).toBeUndefined();
    expect(schemaProblem({ enum: [{ a: [1] }] }, { a: [2] })).toBeDefined();
    expect(schemaProblem({ maxLength: 1 }, "👍")).toBeUndefined();
  });

  it("says where a nested value is wrong, and that a pattern is broken instead of throwing", () => {
    expect(schemaProblem({ items: { properties: { a: { type: "string" } } } }, [{ a: 1 }])).toContain(
      "[0].a"
    );
    expect(schemaProblem({ pattern: "(" }, "x")).toBeDefined();
  });
});

describe("isValueSchema", () => {
  it("refuses a keyword it cannot read, at any depth", () => {
    expect(isValueSchema({ type: "string", title: "A" })).toBe(true);
    expect(isValueSchema({ oneOf: [] })).toBe(false);
    expect(isValueSchema(Object.fromEntries([["$ref", "#"]]))).toBe(false);
    expect(isValueSchema({ items: { not: {} } })).toBe(false);
    expect(isValueSchema({ properties: { a: { allOf: [] } } })).toBe(false);
    expect(isValueSchema(null)).toBe(false);
    expect(isValueSchema({ minimum: "abc" })).toBe(false);
    expect(isValueSchema({ type: "text" })).toBe(false);
    expect(isValueSchema({ required: [1] })).toBe(false);
    expect(isValueSchema({ pattern: "(" })).toBe(false);
    expect(isValueSchema({ pattern: "^(a+)+$" })).toBe(false);
    expect(isValueSchema({ pattern: "^a+$" })).toBe(true);
  });
});
