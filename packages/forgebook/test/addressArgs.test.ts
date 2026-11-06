/**
 * Tests for the check of the panel's values an address names: only the props the story declares, with values of
 * their type, reach its frame.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type ArgDeclaration,
  checkedAddressArgs,
  checkedArgsMessage,
  declaredArgProps
} from "../src/addressArgs.ts";
import type { PropDocs } from "../src/componentDocs.ts";
import { type PanelArgs, UNSET_ARG } from "../src/messages.ts";
import { isFileList, isValueOfShape } from "../src/shapeValues.ts";

/** A component's props as its types give them. */
const PROPS: readonly PropDocs[] = [
  {
    name: "size",
    kind: "choice",
    type: '"sm" | "lg"',
    description: "",
    isRequired: false,
    choices: ["sm", "lg"]
  },
  { name: "label", kind: "text", type: "string", description: "", isRequired: true },
  { name: "count", kind: "number", type: "number", description: "", isRequired: false },
  { name: "isOpen", kind: "toggle", type: "boolean", description: "", isRequired: false },
  { name: "icon", kind: "other", type: "IconComponent", description: "", isRequired: false },
  {
    name: "children",
    kind: "other",
    type: "ReactNode",
    description: "",
    isRequired: false,
    canTakeText: true
  },
  { name: "render", kind: "other", type: "() => ReactNode", description: "", isRequired: false },
  { name: "onPress", kind: "event", type: "() => void", description: "", isRequired: false }
];

/** An icon the source names. */
const IconBell = (): null => null;

/** A story of that component, with every control set. */
const DECLARATION: ArgDeclaration = {
  props: PROPS,
  argTypes: {
    tone: { isHidden: false, control: "radio", options: ["calm", 2] },
    sides: { isHidden: false, control: "check", options: ["top", "bottom"] },
    accent: { isHidden: false, control: "color" },
    when: { isHidden: false, control: "date" },
    level: { isHidden: false, control: "range", min: 0, max: 10 },
    payload: { isHidden: false, control: "none" },
    secret: { isHidden: true }
  },
  controls: "all",
  storyArgs: {
    label: "Save",
    caption: "own",
    ratio: 0.5,
    isDense: false,
    sideIcon: { of: "IconComponent", named: "IconBell" }
  },
  namedValues: { IconComponent: { IconBell } }
};

/** The names the check left out. */
const droppedNames = (args: PanelArgs, declaration: ArgDeclaration = DECLARATION): readonly string[] =>
  checkedAddressArgs(args, declaration, undefined, { isFileList, isValueOfShape }).dropped.map(
    (each) => each.name
  );

describe("the panel's values an address names", () => {
  it("keeps every value the panel itself could set, as a shared link writes it", () => {
    const args: PanelArgs = {
      size: "lg",
      label: "Delete",
      count: 3,
      isOpen: true,
      icon: { of: "IconComponent", named: "IconBell" },
      children: "Text",
      tone: 2,
      sides: ["top", "bottom"],
      accent: "#ff0000",
      when: 1_700_000_000_000,
      level: 4,
      caption: "theirs",
      ratio: 2,
      isDense: true,
      sideIcon: { of: "IconComponent", named: "IconBell" }
    };
    expect(checkedAddressArgs(args, DECLARATION)).toMatchObject({ accepted: args, dropped: [] });
  });

  it("leaves out a name the story does not declare: an element's handlers, its HTML, a prototype's keys", () => {
    const args: PanelArgs = JSON.parse(
      JSON.stringify({
        size: "sm",
        onclick: "alert(1)",
        onClick: "alert(1)",
        innerHTML: "<img src=x onerror=alert(1)>",
        srcDoc: "<script>alert(1)</script>",
        href: "javascript:alert(1)",
        style: "background:url(/leak)",
        dangerouslySetInnerHTML: { of: "a", named: "b" },
        constructor: "x",
        toString: "x"
      }).replace('"constructor"', '"__proto__":"x","constructor"')
    );
    const checked = checkedAddressArgs(args, DECLARATION);
    expect(checked.accepted).toEqual({ size: "sm" });
    expect(checked.dropped.every((each) => each.reason === "undeclared")).toBe(true);
    expect(checked.dropped.map((each) => each.name)).toEqual([
      "onclick",
      "onClick",
      "innerHTML",
      "srcDoc",
      "href",
      "style",
      "dangerouslySetInnerHTML",
      "__proto__",
      "constructor",
      "toString"
    ]);
  });

  it("leaves out a value not of its prop's type", () => {
    const checked = checkedAddressArgs(
      {
        size: "xl",
        label: 5,
        count: "3",
        isOpen: "true",
        children: ["a"],
        tone: "loud",
        sides: ["left"],
        accent: 1,
        when: "today",
        level: null,
        caption: 1,
        ratio: false,
        isDense: "no"
      },
      DECLARATION
    );
    expect(checked.accepted).toEqual({});
    expect(checked.dropped.every((each) => each.reason === "type")).toBe(true);
    expect(checked.dropped).toHaveLength(13);
  });

  it("takes a named value only among the source's own, for the prop's type: never a function through a prototype", () => {
    expect(
      droppedNames({
        icon: { of: "constructor", named: "constructor" },
        sideIcon: { of: "IconComponent", named: "constructor" },
        children: { of: "IconComponent", named: "IconBell" }
      })
    ).toEqual(["icon", "sideIcon", "children"]);
    expect(droppedNames({ icon: { of: "Other", named: "IconBell" } })).toEqual(["icon"]);
  });

  it("never takes a value for an event, a function prop, a hidden arg or one the panel only lists", () => {
    expect(droppedNames({ onPress: "x", render: "x", secret: "x", payload: "x" })).toEqual([
      "onPress",
      "render",
      "secret",
      "payload"
    ]);
  });

  it("takes only the props the story's controls let the panel set", () => {
    const declaration: ArgDeclaration = { ...DECLARATION, controls: ["size"] };
    expect(droppedNames({ size: "lg", label: "x", caption: "x" }, declaration)).toEqual(["label", "caption"]);
    expect(droppedNames({ size: "lg" }, { ...DECLARATION, controls: [] })).toEqual(["size"]);
  });

  it("declares the story's own args by the type of their value when neither the types nor the `argTypes` name them", () => {
    const declaration: ArgDeclaration = {
      props: [],
      argTypes: {},
      controls: "all",
      storyArgs: { title: "x", none: null, picks: ["a"], config: { depth: 1 } },
      namedValues: {}
    };
    expect(declaredArgProps(declaration).map((prop) => [prop.name, prop.kind])).toEqual([
      ["title", "text"],
      ["picks", "other"],
      ["config", "other"]
    ]);
    expect(droppedNames({ title: "y", none: null }, declaration)).toEqual(["none"]);
    // what the story's own arg looks like is what a link may give
    expect(droppedNames({ picks: [1], config: { depth: 2, extra: 1 } }, declaration)).toEqual([
      "picks",
      "config"
    ]);
    expect(droppedNames({ picks: ["b", "c"], config: { depth: 2 } }, declaration)).toEqual([]);
    // until what checks a shape has loaded, such a value is neither taken nor left out
    expect(checkedAddressArgs({ title: "y", picks: ["b"] }, declaration)).toMatchObject({
      isWaiting: true,
      accepted: { title: "y" },
      dropped: []
    });
  });

  it('takes the panel\'s "no value" for any prop it sets, and nothing else under that name', () => {
    expect(droppedNames({ label: UNSET_ARG }, DECLARATION)).toEqual([]);
    expect(droppedNames({ undeclared: UNSET_ARG }, DECLARATION)).toEqual(["undeclared"]);
  });
});

describe("the message that gives a frame its values", () => {
  it("takes only what the check accepted", () => {
    const raw: PanelArgs = { label: "x" };
    // @ts-expect-error an address's own values are not the check's, which the type checker holds every page to
    expect(checkedArgsMessage({ values: raw })).toEqual({ type: "forgebook:args", args: raw });
  });

  it("is written only where the check's values go in", () => {
    const sources = join(import.meta.dirname, "..", "src");
    const writers = readdirSync(sources, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => readFileSync(join(sources, file), "utf8").includes('"forgebook:args"'))
      .map((file) => file.replaceAll("\\", "/"))
      .sort();
    // the check's, the message's type, and the frame that hears it and its guard
    expect(writers).toEqual([
      "addressArgs.ts",
      "frame/mountFrame.ts",
      "frame/shellMessageCheck.ts",
      "messages.ts"
    ]);
  });
});
