/**
 * Tests for an arg's condition (`argTypes.<name>.if`): what crosses from the frame, and what each test shows, as
 * Storybook's `includeConditionalArg` reads them.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isArgCondition, isArgShown } from "../src/argConditions.ts";
import { isPanelArgTypes } from "../src/argTypes.ts";
import { panelArgTypesOf } from "../src/storyArgTypes.ts";

describe("isArgShown", () => {
  it.each([
    [{ arg: "kind", eq: "link" }, { kind: "link" }, true],
    [{ arg: "kind", eq: "link" }, { kind: "text" }, false],
    [{ arg: "kind", neq: "link" }, { kind: "text" }, true],
    [{ arg: "kind", neq: "link" }, { kind: "link" }, false],
    [{ arg: "on" }, { on: true }, true],
    [{ arg: "on" }, { on: false }, false],
    [{ arg: "on" }, {}, false],
    [{ arg: "on", truthy: false }, { on: false }, true],
    [{ arg: "on", truthy: false }, { on: "yes" }, false],
    [{ arg: "on", exists: true }, { on: false }, true],
    [{ arg: "on", exists: true }, {}, false],
    [{ arg: "on", exists: false }, {}, true],
    [{ arg: "tags", eq: ["a", 1] }, { tags: ["a", 1] }, true],
    [{ arg: "tags", eq: ["a", 1] }, { tags: ["a"] }, false]
  ])("%j with %j is %s", (condition, args, isShown) => {
    expect(isArgShown(condition, args, {})).toBe(isShown);
  });

  it("reads a global from the switches, and shows an arg with no condition", () => {
    expect(isArgShown({ global: "theme", eq: "dark" }, { theme: "light" }, { theme: "dark" })).toBe(true);
    expect(isArgShown({ global: "theme", eq: "dark" }, { theme: "dark" }, { theme: "light" })).toBe(false);
    expect(isArgShown(undefined, {}, {})).toBe(true);
  });
});

describe("isArgCondition", () => {
  it("takes an arg or a global, not both or neither, and what can cross between the documents", () => {
    expect(isArgCondition({ arg: "a" })).toBe(true);
    expect(isArgCondition({ global: "a", neq: null })).toBe(true);
    expect(isArgCondition({ arg: "a", global: "b" })).toBe(false);
    expect(isArgCondition({ eq: "b" })).toBe(false);
    expect(isArgCondition({ arg: "a", eq: { b: 1 } })).toBe(false);
    expect(isArgCondition({ arg: "a", eq: () => true })).toBe(false);
    expect(isArgCondition("a")).toBe(false);
  });
});

describe("panelArgTypesOf", () => {
  it("sends a condition to the shell, and leaves out what is not one rather than fail to send", () => {
    const argTypes = panelArgTypesOf(
      { a: { if: { arg: "b", eq: "c" } }, d: { if: { arg: "b", eq: () => true } }, e: {} },
      []
    );
    expect(argTypes["a"]?.if).toEqual({ arg: "b", eq: "c" });
    expect(argTypes["d"]?.if).toBeUndefined();
    expect(argTypes["e"]?.if).toBeUndefined();
    expect(isPanelArgTypes(argTypes)).toBe(true);
    // what is sent must survive being sent: a function among its other fields would stop the frame's report
    expect(
      panelArgTypesOf({ a: { if: { arg: "b", eq: "c", note: () => true, truthy: () => true } } }, [])["a"]?.if
    ).toEqual({ arg: "b", eq: "c" });
    expect(isPanelArgTypes({ a: { isHidden: false, if: { eq: "b" } } })).toBe(false);
  });
});
