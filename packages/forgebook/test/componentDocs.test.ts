/**
 * The component docs the plugin hands the shell: a selector, for a framework that matches components by one, is checked
 * on arrival and names the component in the story's code; a prop's group and its type's members are checked too.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type ComponentDocs, codeNameOf, isComponentDocs } from "../src/componentDocs.ts";

/** A component's docs, with nothing to list. */
const DOCS: ComponentDocs = {
  name: "Badge",
  description: "",
  summary: "",
  props: [],
  parts: [],
  subcomponents: []
};

describe("a component's selector", () => {
  it("names the component in its code when there is one, and its name otherwise", () => {
    expect(codeNameOf(DOCS)).toBe("Badge");
    expect(codeNameOf({ ...DOCS, selector: "fb-badge" })).toBe("fb-badge");
  });

  it("is checked on arrival", () => {
    expect(isComponentDocs({ ...DOCS, selector: "button[fbButton]" })).toBe(true);
    expect(isComponentDocs({ ...DOCS, selector: 3 })).toBe(false);
  });
});

describe("a prop's group and members", () => {
  /** A prop of kind `other`, with what a test lays over it. */
  const withProp = (extra: Readonly<Record<string, unknown>>): unknown => ({
    ...DOCS,
    props: [{ name: "texts", kind: "other", type: "Texts", description: "", isRequired: false, ...extra }]
  });

  it("are checked on arrival", () => {
    const member = {
      name: "empty",
      type: "string",
      description: "Said when nothing matches.",
      isRequired: true
    };
    expect(isComponentDocs(withProp({ group: "Texts", members: [member] }))).toBe(true);
    expect(isComponentDocs(withProp({ members: [{ ...member, defaultValue: '"None"' }] }))).toBe(true);
    expect(isComponentDocs(withProp({ group: 3 }))).toBe(false);
    expect(isComponentDocs(withProp({ members: [{ name: "empty" }] }))).toBe(false);
    expect(isComponentDocs(withProp({ members: "empty" }))).toBe(false);
  });
});

describe("a prop's condition and notes, and a component's props note", () => {
  /** A prop, with what a test lays over it. */
  const withProp = (extra: Readonly<Record<string, unknown>>): unknown => ({
    ...DOCS,
    props: [{ name: "href", kind: "text", type: "string", description: "", isRequired: false, ...extra }]
  });

  it("are checked on arrival, so the reference never reads a note that is not one", () => {
    expect(
      isComponentDocs(withProp({ onlyWhen: { prop: "kind", values: ["link"] }, notes: [{ reason: "any" }] }))
    ).toBe(true);
    expect(isComponentDocs(withProp({ notes: [null] }))).toBe(false);
    expect(isComponentDocs(withProp({ onlyWhen: { values: ["link"] } }))).toBe(false);
    expect(isComponentDocs({ ...DOCS, propsNote: { reason: "untyped" } })).toBe(true);
    expect(isComponentDocs({ ...DOCS, propsNote: "untyped" })).toBe(false);
  });
});
