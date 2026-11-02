/**
 * Tests for the Solid docs module, on its fixture: a component's props, events and children, read from its types.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractComponentDocs, extractFileComponent, storyTypesModule } from "../src/vite/extractDocs.ts";

/** The fixture's components. */
const DOCS = join(import.meta.dirname, "..", "fixtures", "docs", "src");

describe("the Solid docs module", () => {
  it("reads a component's props in their order, with their kind and texts, events as their handlers", () => {
    const docs = extractComponentDocs(join(DOCS, "Badge.stories.tsx"));
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.name).toBe("Badge");
    expect(docs.summary).toBe("A short label beside what it describes.");
    expect(docs.props.map((prop) => [prop.name, prop.kind, prop.isRequired])).toEqual([
      ["label", "text", true],
      ["tone", "choice", false],
      ["count", "number", false],
      ["onRemove", "event", false],
      ["children", "other", false]
    ]);
    expect(docs.props.find((prop) => prop.name === "onRemove")?.signature).toEqual({
      parameters: [{ name: "reason", type: "string" }],
      returns: "void"
    });
    expect(docs.props.find((prop) => prop.name === "children")?.canTakeText).toBe(true);
  });

  it("reads a component from its file for its first stories, typed by this package", () => {
    const component = extractFileComponent(join(DOCS, "Badge.tsx"));
    if (typeof component === "string" || component.docs.name === null) throw new Error(String(component));
    expect(component.docs.name).toBe("Badge");
    expect(storyTypesModule).toBe("@forgebook/solid");
  });
});
