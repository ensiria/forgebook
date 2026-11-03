/**
 * The component docs the plugin hands the shell: a selector, for a framework that matches components by one, is checked
 * on arrival and names the component in the story's code.
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
