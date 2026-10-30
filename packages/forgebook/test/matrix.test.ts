/**
 * Tests for a story's matrix.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PropDocs } from "../src/componentDocs";
import { isMatrix, matrixOf, matrixProps } from "../src/matrix";

/** A prop of the given kind. */
const prop = (name: string, kind: PropDocs["kind"], choices?: readonly (string | number)[]): PropDocs => ({
  name,
  kind,
  type: "",
  description: "",
  isRequired: false,
  ...(choices === undefined ? {} : { choices })
});

const PROPS: readonly PropDocs[] = [
  prop("tone", "choice", ["neutral", "accent", "danger"]),
  prop("size", "choice", ["sm", "md"]),
  prop("isRaised", "toggle"),
  prop("label", "text"),
  prop("one", "choice", ["only"])
];

describe("the matrix", () => {
  it("offers the choices and toggles with a short set of values as axes", () => {
    expect(matrixProps(PROPS).map((entry) => entry.name)).toEqual(["tone", "size", "isRaised"]);
  });

  it("builds rows, and columns when a second axis is named", () => {
    expect(matrixOf(PROPS, ["tone"])).toEqual({
      rows: { name: "tone", values: ["neutral", "accent", "danger"] }
    });
    expect(matrixOf(PROPS, ["size", "isRaised"])).toEqual({
      rows: { name: "size", values: ["sm", "md"] },
      columns: { name: "isRaised", values: [false, true] }
    });
  });

  it("names no matrix for an unknown or unusable first axis, and drops a repeated or unusable second one", () => {
    expect(matrixOf(PROPS, [])).toBeUndefined();
    expect(matrixOf(PROPS, ["label"])).toBeUndefined();
    expect(matrixOf(PROPS, ["tone", "tone"])).toEqual({
      rows: { name: "tone", values: ["neutral", "accent", "danger"] }
    });
    expect(matrixOf(PROPS, ["tone", "label"])?.columns).toBeUndefined();
  });

  it("checks a matrix on arrival", () => {
    expect(isMatrix({ rows: { name: "tone", values: ["a", 1, true] } })).toBe(true);
    expect(isMatrix({ rows: { name: "tone", values: [{}] } })).toBe(false);
    expect(isMatrix({ columns: { name: "tone", values: [] } })).toBe(false);
  });
});
