/**
 * Tests for the two forms of an address's `args`: Storybook's links read as Storybook reads them, Forgebook's JSON told
 * apart from them, a value that cannot be read named and never lost silently; and a round trip across the panel's
 * control types, through a real address, in both forms.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type ArgDeclaration, checkedAddressArgs } from "../src/addressArgs.ts";
import { type ArgsParamRead, readArgsParam as readFirstScreen } from "../src/addressArgsParam.ts";
import type { PropDocs } from "../src/componentDocs.ts";
import { type ArgValue, type PanelArgs, panelArgsParam } from "../src/messages.ts";
import { readStorybookArgs } from "../src/storybookArgs.ts";

/** A parameter read whole: what the first screen reads, then what a link in Storybook's form loads its reader for. */
const readArgsParam = (param: string | null): ArgsParamRead => {
  const read = readFirstScreen(param);
  return read.link?.isWaiting === true ? readStorybookArgs(read.link.param) : read;
};

/** The parameter as a page reads it from an address's query. */
const fromAddress = (query: string): string | null => new URLSearchParams(query).get("args");

describe("readArgsParam, Storybook's form", () => {
  // the forms of Storybook's own tests (`parseArgsParam.test.ts`)
  it.each<[string, Readonly<Record<string, ArgValue>>]>([
    ["key:val", { key: "val" }],
    ["one:A;two:B;three:C", { one: "A", two: "B", three: "C" }],
    ["key:!null", { key: null }],
    ["key:!true", { key: true }],
    ["key:!false", { key: false }],
    ["key:!hex(ff4785)", { key: "#ff4785" }],
    [
      "rgb:!rgb(255,71,133);rgba:!rgba(255,71,133,0.5)",
      { rgb: "rgb(255, 71, 133)", rgba: "rgba(255, 71, 133, 0.5)" }
    ],
    [
      "hsl:!hsl(45,99,70);hsla:!hsla(45,99,70,0.5)",
      { hsl: "hsl(45, 99%, 70%)", hsla: "hsla(45, 99%, 70%, 0.5)" }
    ],
    ["key:!date(2001-02-03T04:05:06.789Z)", { key: Date.UTC(2001, 1, 3, 4, 5, 6, 789) }],
    ["arr[]:A;arr[]:B;arr[]:C", { arr: ["A", "B", "C"] }],
    ["arr[0]:A;arr[1]:B;arr[2]:C", { arr: ["A", "B", "C"] }],
    ["arr:A;arr:B;arr:C", { arr: ["A", "B", "C"] }]
  ])("reads %s", (param, args) => {
    const read = readArgsParam(param);
    expect(read.args).toEqual(args);
    expect(read.link?.typeValue).toBeDefined();
    expect(read.link?.unread).toEqual([]);
  });

  it("keeps a text's colons, and a mark that means nothing", () => {
    expect(readArgsParam("at:12:30;mark:!nope;zero:!rgb(a)").args).toEqual({
      at: "12:30",
      mark: "!nope",
      zero: "!rgb(a)"
    });
  });

  it("reads spaces and non-ASCII text as an address writes them", () => {
    expect(fromAddress("args=key:one+two+three")).toBe("key:one two three");
    expect(readArgsParam(fromAddress("args=key:one+two+three")).args).toEqual({ key: "one two three" });
    expect(readArgsParam(fromAddress("args=label:caf%C3%A9;who:%E6%97%A5%E6%9C%AC")).args).toEqual({
      label: "café",
      who: "日本"
    });
    // encoded twice, as a link passed through Storybook's own query parser may be; a stray `%` is the text's
    expect(readArgsParam(fromAddress("args=label:caf%25C3%25A9;off:50%25")).args).toEqual({
      label: "café",
      off: "50%"
    });
  });

  it.each([
    ["an object", "style.color:red;label:Hi", ["style"]],
    ["a nested list", "obj.foo[0]:A;label:Hi", ["obj"]],
    ["a list of objects", "arr[0].one:A;label:Hi", ["arr"]],
    ["a list with a hole", "arr[1]:B;label:Hi", ["arr"]],
    ["a list holding what a list cannot", "arr[0]:!true;label:Hi", ["arr"]],
    ["a date that is none", "at:!date(soon);label:Hi", ["at"]],
    ["no colon", "flag;label:Hi", ["flag"]],
    ["no name", ":x;label:Hi", [":x"]]
  ])("names %s as unread, and keeps the others", (_kind, param, unread) => {
    const read = readArgsParam(param);
    expect(read.link?.unread).toEqual(unread);
    expect(read.args).toEqual({ label: "Hi" });
  });

  it("never touches an object's prototype", () => {
    const read = readArgsParam("__proto__:x;constructor.prototype.y:z");
    expect(Object.getPrototypeOf(read.args)).toBe(Object.prototype);
    expect(Object.keys(read.args)).toEqual(["__proto__"]);
    expect(read.link?.unread).toEqual(["constructor"]);
  });
});

describe("readArgsParam, Forgebook's form", () => {
  it("leaves a link in Storybook's form to its reader, and says it is waiting", () => {
    expect(readFirstScreen("a:b;c:d")).toEqual({
      args: {},
      link: { param: "a:b;c:d", isWaiting: true, unread: [] }
    });
  });

  it("is told apart by its first character, and has nothing else to say", () => {
    expect(readArgsParam('{"a":"b:c;d:e"}')).toEqual({ args: { a: "b:c;d:e" }, link: undefined });
    expect(readArgsParam(null)).toEqual({ args: {}, link: undefined });
    expect(readArgsParam("")).toEqual({ args: {}, link: undefined });
  });

  it("names what it cannot read, entry by entry, or the whole parameter", () => {
    const read = readArgsParam('{"a":"b","nested":{"c":1},"list":[true],"bad":{"__proto__":{}}}');
    expect(read.args).toEqual({ a: "b", nested: { c: 1 }, list: [true] });
    expect(read.link?.unread).toEqual(["bad"]);
    expect(read.link?.typeValue).toBeUndefined();
    expect(readArgsParam("{not json").link?.unread).toEqual(["args"]);
    expect(readArgsParam("{not json").args).toEqual({});
  });
});

/** A prop of every control type. */
const PROP_BASE = { description: "", isRequired: false } as const;

/** A story declaring a prop of each of the panel's controls. */
const DECLARATION: ArgDeclaration = {
  props: [
    { ...PROP_BASE, name: "text", kind: "text", type: "string" },
    { ...PROP_BASE, name: "code", kind: "text", type: "string" },
    { ...PROP_BASE, name: "count", kind: "number", type: "number" },
    { ...PROP_BASE, name: "isOpen", kind: "toggle", type: "boolean" },
    { ...PROP_BASE, name: "size", kind: "choice", type: '"sm" | "lg"', choices: ["sm", "lg"] },
    { ...PROP_BASE, name: "level", kind: "choice", type: "1 | 2", choices: [1, 2] }
  ] satisfies readonly PropDocs[],
  argTypes: {
    tone: { isHidden: false, control: "radio", options: ["calm", "loud"] },
    tags: { isHidden: false, control: "check", options: ["top", "é", 3] },
    picked: { isHidden: false, control: "multi-select", options: ["a", "b"] },
    volume: { isHidden: false, control: "range", min: 0, max: 10 },
    color: { isHidden: false, control: "color" },
    at: { isHidden: false, control: "date" },
    isLoud: { isHidden: false, control: "boolean" },
    name: { isHidden: false, control: "text" }
  },
  controls: "all",
  storyArgs: {},
  namedValues: {}
};

/** A value of every control type. */
const VALUES: PanelArgs = {
  text: "Perché 日本語 🎉 a:b;c=d & e",
  code: "007",
  count: -1.5,
  isOpen: true,
  size: "lg",
  level: 2,
  tone: "loud",
  tags: ["top", "é", 3],
  picked: ["b"],
  volume: 4,
  color: "#336699",
  at: Date.UTC(2026, 0, 2),
  isLoud: false,
  name: ""
};

/** The values a story receives from a parameter, through an address's encoding. */
const received = (param: string): PanelArgs => {
  const read = readArgsParam(fromAddress(new URLSearchParams({ args: param }).toString()));
  expect(read.link?.unread ?? []).toEqual([]);
  const checked = checkedAddressArgs(read.args, DECLARATION, read.link?.typeValue);
  expect(checked.dropped).toEqual([]);
  return checked.accepted;
};

/**
 * Values in Storybook's form, as its `buildArgsParam` writes them: marked booleans, hex colours and dates, unmarked
 * numbers and texts, a list by its indexes. Its own writer refuses `;` in a text, so the text here holds none.
 */
const storybookParam = (values: PanelArgs): string =>
  Object.entries(values)
    .flatMap(([name, value]): string[] => {
      if (Array.isArray(value)) return value.map((item, index) => `${name}[${index}]:${String(item)}`);
      if (typeof value === "boolean") return [`${name}:!${value}`];
      if (typeof value === "string" && value.startsWith("#")) return [`${name}:!hex(${value.slice(1)})`];
      return [`${name}:${String(value)}`];
    })
    .join(";");

describe("a round trip of every control type", () => {
  it("keeps every value in Forgebook's form", () => {
    expect(received(panelArgsParam(VALUES))).toEqual(VALUES);
  });

  it("keeps every value in Storybook's form, typed by the props, and in JSON once checked", () => {
    const { text: _hasSemicolon, ...others } = VALUES;
    const values = { ...others, text: "Perché 日本語 🎉 a:b" };
    const accepted = received(storybookParam(values));
    expect(accepted).toEqual(values);
    // a panel's edit writes them as JSON: they read the same from there
    expect(received(panelArgsParam(accepted))).toEqual(values);
  });

  it("keeps a text that writes a number as it is written, for a prop that takes text", () => {
    expect(received("code:007;text:1.50")).toEqual({ code: "007", text: "1.50" });
    expect(received("count:5;level:2")).toEqual({ count: 5, level: 2 });
    expect(received("isOpen:true;isLoud:false")).toEqual({ isOpen: true, isLoud: false });
  });

  it('types a Storybook link only: Forgebook\'s form still keeps `"12"` and `12` apart', () => {
    const { accepted, dropped } = checkedAddressArgs({ count: "12", isOpen: "true" }, DECLARATION);
    expect(accepted).toEqual({});
    expect(dropped.map((each) => each.reason)).toEqual(["type", "type"]);
  });

  it("drops what a story does not take from a Storybook link as from any other", () => {
    const read = readArgsParam("innerHTML:x;count:many;isOpen:!null;tone:shout");
    const { accepted, dropped } = checkedAddressArgs(read.args, DECLARATION, read.link?.typeValue);
    expect(accepted).toEqual({});
    expect(dropped).toEqual([
      { name: "innerHTML", reason: "undeclared" },
      { name: "count", reason: "type" },
      { name: "isOpen", reason: "type" },
      { name: "tone", reason: "type" }
    ]);
  });
});

describe("a list written by repeating a key", () => {
  it("reads a long link in a moment", () => {
    const started = performance.now();
    const read = readArgsParam("a:1;".repeat(100_000));
    expect(read.args["a"]).toHaveLength(100_000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
