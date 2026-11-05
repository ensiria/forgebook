/**
 * Tests for the props in their groups: the order of the groups, the props naming none first, and the required props
 * where each layout puts them, as the story, the component, the catalogue and the reader's switch choose.
 *
 * @module
 */

import type { RequiredFirst } from "@forgebook/story-format/csf";
import { describe, expect, it } from "vitest";

import {
  canOrderRequired,
  groupedProps,
  hasPropGroups,
  laidOutProps,
  propGroupOrder,
  REQUIRED_FIRST_LAYOUTS,
  requiredFirstLayout,
  requiredPropsFirst
} from "../src/propGroups.ts";

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

/** A prop as the layout reads it: a name, maybe a group, whether it is required, and its kind. */
type LaidProp = {
  readonly name: string;
  readonly group?: string;
  readonly isRequired: boolean;
  readonly kind: "text" | "event";
};

/**
 * A prop for the layout's tests.
 *
 * @param name - its name; a `*` at its end makes it required, an `on` at its start an event.
 * @param group - its group, if any.
 */
const prop = (name: string, group?: string): LaidProp => ({
  name: name.endsWith("*") ? name.slice(0, -1) : name,
  ...(group === undefined ? {} : { group }),
  isRequired: name.endsWith("*"),
  kind: name.startsWith("on") ? "event" : "text"
});

/** A component with groups: required props and events in and out of them, in the order of its source. */
const GROUPED: readonly LaidProp[] = [
  prop("size"),
  prop("page", "Paging"),
  prop("value*"),
  prop("selected", "Selection"),
  prop("onChange*"),
  prop("pageSize*", "Paging"),
  prop("onOpen"),
  prop("isMultiple*", "Selection"),
  prop("rows*")
];

/** The same component, its props naming no group. */
const PLAIN: readonly LaidProp[] = GROUPED.map(({ group: _group, ...rest }) => rest);

/** A layout as names, for a short comparison: the "Required" section, each group, the events. */
const layoutShape = (
  props: readonly LaidProp[],
  layout: RequiredFirst
): { required: string[]; groups: [string | undefined, string[]][]; events: string[] } => {
  const laid = laidOutProps(props, ["Selection"], layout);
  return {
    required: laid.required.map((each) => each.name),
    groups: laid.groups.map((group) => [group.name, group.props.map((each) => each.name)]),
    events: laid.events.map((each) => each.name)
  };
};

describe("laidOutProps", () => {
  it("puts the required props first in each group and among the events, the rest in their order (in-groups)", () => {
    expect(layoutShape(GROUPED, "in-groups")).toEqual({
      required: [],
      groups: [
        [undefined, ["value", "rows", "size"]],
        ["Selection", ["isMultiple", "selected"]],
        ["Paging", ["pageSize", "page"]]
      ],
      events: ["onChange", "onOpen"]
    });
  });

  it("gathers the required props in one section before the groups, each group's in its turn, events last (section)", () => {
    expect(layoutShape(GROUPED, "section")).toEqual({
      required: ["value", "rows", "isMultiple", "pageSize", "onChange"],
      groups: [
        [undefined, ["size"]],
        ["Selection", ["selected"]],
        ["Paging", ["page"]]
      ],
      events: ["onOpen"]
    });
  });

  it("keeps the order of the source when the ordering is off (false)", () => {
    expect(layoutShape(GROUPED, false)).toEqual({
      required: [],
      groups: [
        [undefined, ["size", "value", "rows"]],
        ["Selection", ["selected", "isMultiple"]],
        ["Paging", ["page", "pageSize"]]
      ],
      events: ["onChange", "onOpen"]
    });
  });

  it("gives props that name no group one list, required first, in both layouts; the source's order when off", () => {
    const required = {
      required: [],
      groups: [[undefined, ["value", "pageSize", "isMultiple", "rows", "size", "page", "selected"]]],
      events: ["onChange", "onOpen"]
    };
    expect(layoutShape(PLAIN, "in-groups")).toEqual(required);
    // a section before no group is the same single list
    expect(layoutShape(PLAIN, "section")).toEqual(required);
    expect(layoutShape(PLAIN, false)).toEqual({
      required: [],
      groups: [[undefined, ["size", "page", "value", "selected", "pageSize", "isMultiple", "rows"]]],
      events: ["onChange", "onOpen"]
    });
  });

  it("leaves out a group whose props are all in the section, and draws no section when none is required", () => {
    const allRequired = [prop("value*"), prop("page*", "Paging"), prop("size", "Look")];
    expect(layoutShape(allRequired, "section")).toEqual({
      required: ["value", "page"],
      groups: [["Look", ["size"]]],
      events: []
    });
    const noneRequired = [prop("size"), prop("page", "Paging")];
    expect(layoutShape(noneRequired, "section")).toEqual({
      required: [],
      groups: [
        [undefined, ["size"]],
        ["Paging", ["page"]]
      ],
      events: []
    });
  });
});

describe("requiredPropsFirst and canOrderRequired", () => {
  it("moves the required props first, keeping both parts in their order", () => {
    expect(requiredPropsFirst(GROUPED).map((each) => each.name)).toEqual([
      "value",
      "onChange",
      "pageSize",
      "isMultiple",
      "rows",
      "size",
      "page",
      "selected",
      "onOpen"
    ]);
  });

  it("offers the switch only where it changes something: a required prop and one that is not", () => {
    expect(canOrderRequired(GROUPED)).toBe(true);
    expect(canOrderRequired([prop("value*"), prop("rows*")])).toBe(false);
    expect(canOrderRequired([prop("size")])).toBe(false);
    expect(canOrderRequired([])).toBe(false);
  });
});

describe("requiredFirstLayout", () => {
  it("takes the narrowest setting: the story's or the component's, else the catalogue's", () => {
    for (const catalogue of REQUIRED_FIRST_LAYOUTS) {
      expect(requiredFirstLayout(undefined, catalogue, undefined)).toBe(catalogue);
      for (const own of REQUIRED_FIRST_LAYOUTS)
        expect(requiredFirstLayout(own, catalogue, undefined)).toBe(own);
    }
  });

  it("turns the ordering off over every level when the reader switches it off", () => {
    for (const catalogue of REQUIRED_FIRST_LAYOUTS) {
      expect(requiredFirstLayout(undefined, catalogue, false)).toBe(false);
      for (const own of REQUIRED_FIRST_LAYOUTS)
        expect(requiredFirstLayout(own, catalogue, false)).toBe(false);
    }
  });

  it("turns it on keeping the developer's layout: the narrowest set, the catalogue's past a false, else in-groups", () => {
    expect(requiredFirstLayout("section", "in-groups", true)).toBe("section");
    expect(requiredFirstLayout("in-groups", "section", true)).toBe("in-groups");
    expect(requiredFirstLayout(undefined, "section", true)).toBe("section");
    expect(requiredFirstLayout(false, "section", true)).toBe("section");
    expect(requiredFirstLayout(false, false, true)).toBe("in-groups");
    expect(requiredFirstLayout(undefined, false, true)).toBe("in-groups");
  });
});
