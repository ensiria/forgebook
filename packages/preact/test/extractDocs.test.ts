/**
 * Tests for the Preact docs module, on its fixture: a function component's props and events, and a class component's
 * props.
 *
 * @module
 */
import { join } from "node:path";

import type { ComponentDocs } from "forgebook/component-docs";
import { describe, expect, it } from "vitest";

import { extractComponentDocs, extractFileComponent, storyTypesModule } from "../src/vite/extractDocs.ts";

/** The fixture's components. */
const DOCS = join(import.meta.dirname, "..", "fixtures", "docs", "src");

/**
 * A story file's component docs, failing the test when it has none.
 *
 * @param storyFile - the story file's name in the fixture.
 */
const docsOf = (storyFile: string): ComponentDocs => {
  const docs = extractComponentDocs(join(DOCS, storyFile));
  if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
  return docs;
};

describe("the Preact docs module", () => {
  it("reads a function component's props in their order, with their kind, texts and defaults", () => {
    const docs = docsOf("Badge.stories.tsx");
    expect(docs.name).toBe("Badge");
    expect(docs.summary).toBe("A short label beside what it describes.");
    expect(docs.props.map((prop) => [prop.name, prop.kind, prop.isRequired])).toEqual([
      ["label", "text", true],
      ["tone", "choice", false],
      ["count", "number", false],
      ["onRemove", "event", false],
      ["children", "other", false]
    ]);
    expect(docs.props.find((prop) => prop.name === "tone")?.choices).toEqual(["info", "danger"]);
    expect(docs.props.find((prop) => prop.name === "children")?.canTakeText).toBe(true);
    expect(docs.props.find((prop) => prop.name === "onRemove")?.description).toBe(
      "Called when the person takes the badge away."
    );
  });

  it("reads a class component's props from what it is constructed with", () => {
    const docs = docsOf("Meter.stories.tsx");
    expect(docs.name).toBe("Meter");
    expect(docs.props.map((prop) => [prop.name, prop.kind])).toEqual([
      ["value", "number"],
      ["label", "text"]
    ]);
    expect(docs.description).toBe("A level between nothing and full.");
  });

  it("reads a component from its file for its first stories, typed by this package", () => {
    const component = extractFileComponent(join(DOCS, "Meter.tsx"));
    if (typeof component === "string" || component.docs.name === null) throw new Error(String(component));
    expect(component.docs.name).toBe("Meter");
    expect(storyTypesModule).toBe("@forgebook/preact");
  });
});
