/**
 * Tests for what an agent reads of a story's controls and how it sets their values: the shape of the answer, as the CLI
 * and the MCP tool hand it on.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { UNSET_ARG } from "../src/messages.ts";
import { checkedSetArgs, type StoryDeclaration, storyControlsOf } from "../src/storyControls.ts";

/** A story with a prop of most kinds. */
const DECLARATION: StoryDeclaration = {
  props: [
    { name: "title", kind: "text", type: "string", description: "", isRequired: true },
    {
      name: "size",
      kind: "choice",
      type: '"sm" | "md"',
      description: "",
      isRequired: false,
      choices: ["sm", "md"]
    },
    { name: "isOpen", kind: "toggle", type: "boolean", description: "", isRequired: false },
    {
      name: "tags",
      kind: "other",
      type: "readonly string[]",
      description: "",
      isRequired: false,
      shape: { kind: "list", of: { kind: "text" } }
    },
    { name: "icon", kind: "other", type: "Icon", description: "", isRequired: false },
    { name: "accent", kind: "text", type: "string", description: "", isRequired: false, token: "color" },
    { name: "render", kind: "other", type: "() => void", description: "", isRequired: false },
    { name: "onPress", kind: "event", type: "() => void", description: "", isRequired: false }
  ],
  argTypes: { note: { isHidden: false, control: "textarea" } },
  controls: "all",
  storyArgs: {},
  namedValues: { Icon: { Star: (): string => "*" } }
};

describe("storyControlsOf", () => {
  it("lists what can be set, each with its control and what its value looks like", () => {
    const controls = storyControlsOf(DECLARATION);
    expect(controls.map((each) => [each.name, each.control])).toEqual([
      ["title", "text"],
      ["size", "select"],
      ["isOpen", "boolean"],
      ["tags", "object"],
      ["icon", "named"],
      ["accent", "token"],
      ["note", "textarea"]
    ]);
    expect(controls.find((each) => each.name === "tags")?.shape).toEqual({
      kind: "list",
      of: { kind: "text" }
    });
    expect(controls.find((each) => each.name === "icon")?.named).toEqual(["Star"]);
    expect(controls.find((each) => each.name === "size")?.choices).toEqual(["sm", "md"]);
    expect(controls.find((each) => each.name === "accent")?.tokens).toEqual({ of: "color" });
    expect(controls.find((each) => each.name === "title")?.isRequired).toBe(true);
  });
});

describe("checkedSetArgs", () => {
  it("keeps what the story takes and says why it leaves the rest out", () => {
    const set = checkedSetArgs(
      JSON.stringify({ title: "ü", tags: ["a"], size: "xl", nope: 1, icon: { of: "Icon", named: "Star" } }),
      DECLARATION
    );
    expect(set.accepted).toEqual({ title: "ü", tags: ["a"], icon: { of: "Icon", named: "Star" } });
    expect(set.dropped).toEqual([
      { name: "size", reason: "type" },
      { name: "nope", reason: "undeclared" }
    ]);
    expect(JSON.parse(set.param)).toEqual(set.accepted);
  });

  it("says a text that is no object of values cannot be read", () => {
    expect(checkedSetArgs("[1]", DECLARATION).dropped).toEqual([{ name: "args", reason: "unreadable" }]);
    expect(checkedSetArgs("{nope", DECLARATION).dropped).toEqual([{ name: "args", reason: "unreadable" }]);
    expect(checkedSetArgs("{}", DECLARATION).param).toBe("");
  });

  it("says what a framework that writes texts into markup would refuse", () => {
    const set = checkedSetArgs(JSON.stringify({ title: "<b>", tags: ["fine"] }), DECLARATION, "plain");
    expect(set.accepted).toEqual({ tags: ["fine"] });
    expect(set.dropped).toEqual([{ name: "title", reason: "type" }]);
  });

  it("takes the panel's no value", () => {
    expect(checkedSetArgs('{"title":{"forgebookUnset":true}}', DECLARATION).accepted).toEqual({
      title: UNSET_ARG
    });
  });
});

describe("a custom control, as an agent reads and sets it", () => {
  const declaration: StoryDeclaration = {
    ...DECLARATION,
    argTypes: {
      score: { isHidden: false, customControl: "rating" },
      lost: { isHidden: false, customControl: "gone" }
    },
    customSchemas: { rating: { type: "integer", maximum: 5 } }
  };

  it("says its name and its schema", () => {
    const score = storyControlsOf(declaration).find((each) => each.name === "score");
    expect(score).toMatchObject({
      control: "custom",
      custom: "rating",
      schema: { type: "integer", maximum: 5 }
    });
  });

  it("checks a value against the schema, and refuses one whose schema it cannot read", () => {
    const set = checkedSetArgs(JSON.stringify({ score: 3, lost: 1 }), declaration);
    expect(set.accepted).toEqual({ score: 3 });
    expect(set.dropped).toEqual([{ name: "lost", reason: "control" }]);
    expect(checkedSetArgs('{"score":9}', declaration).dropped).toEqual([
      { name: "score", reason: "control" }
    ]);
    expect(checkedSetArgs('{"score":{"onclick":"x"}}', declaration).accepted).toEqual({});
  });
});
