/**
 * Tests for the props in their groups: the order of the groups, the props naming none first.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { groupedProps, hasPropGroups, propGroupOrder } from "../src/propGroups.ts";

/** A prop with a name and, maybe, a group. */
type Prop = { readonly name: string; readonly group?: string };

/** The props of a component with groups, in the order of its source. */
const PROPS: readonly Prop[] = [
  { name: "value" },
  { name: "page", group: "Paging" },
  { name: "selected", group: "Selection" },
  { name: "onChange" },
  { name: "pageSize", group: "Paging" },
  { name: "texts", group: "Texts" },
  { name: "isMultiple", group: "Selection" }
];

/** The groups as names and their props' names, for a short comparison. */
const shape = (props: readonly Prop[], order: readonly string[]): [string | undefined, string[]][] =>
  groupedProps(props, order).map((group) => [group.name, group.props.map((prop) => prop.name)]);

describe("groupedProps", () => {
  it("lists the props naming no group first, then each group in the order it first appears", () => {
    expect(shape(PROPS, [])).toEqual([
      [undefined, ["value", "onChange"]],
      ["Paging", ["page", "pageSize"]],
      ["Selection", ["selected", "isMultiple"]],
      ["Texts", ["texts"]]
    ]);
  });

  it("puts the groups the order names first, in its order, and the others after them as they appear", () => {
    expect(shape(PROPS, ["Texts", "Selection"])).toEqual([
      [undefined, ["value", "onChange"]],
      ["Texts", ["texts"]],
      ["Selection", ["selected", "isMultiple"]],
      ["Paging", ["page", "pageSize"]]
    ]);
  });

  it("never lists a group the order names but no prop is in, nor an empty list of ungrouped props", () => {
    const grouped = PROPS.filter((prop) => prop.group !== undefined);
    expect(shape(grouped, ["Missing", "Paging"])).toEqual([
      ["Paging", ["page", "pageSize"]],
      ["Selection", ["selected", "isMultiple"]],
      ["Texts", ["texts"]]
    ]);
  });

  it("gives props that name no group one list, as they always were", () => {
    const plain: readonly Prop[] = [{ name: "value" }, { name: "onChange" }];
    expect(hasPropGroups(plain)).toBe(false);
    expect(hasPropGroups(PROPS)).toBe(true);
    expect(shape(plain, ["Paging"])).toEqual([[undefined, ["value", "onChange"]]]);
  });
});

describe("propGroupOrder", () => {
  it("names the component's groups first, then the catalogue's not named yet, each once", () => {
    expect(propGroupOrder(["Selection", "Paging"], ["Texts", "Selection"])).toEqual([
      "Selection",
      "Paging",
      "Texts"
    ]);
    expect(propGroupOrder(undefined, ["Texts"])).toEqual(["Texts"]);
    expect(propGroupOrder()).toEqual([]);
  });
});
