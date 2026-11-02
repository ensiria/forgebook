/**
 * The docs of HTML story files: a function the meta names, a type the meta is checked against, a typed render, plain
 * JavaScript, and a file that types nothing.
 *
 * @module
 */
import { join } from "node:path";

import { type ComponentDocs, isComponentDocs, type PropDocs } from "forgebook/component-docs";
import { describe, expect, it } from "vitest";

import {
  extractComponentDocs,
  extractFileComponent,
  extractStoryComponent,
  storyFileShape
} from "../src/vite/extractDocs.ts";

/** The fixtures' folder. */
const FIXTURES = join(import.meta.dirname, "..", "fixtures");

/** A docs fixture's file. */
const docsFile = (name: string): string => join(FIXTURES, "docs", "src", name);

/** A story file's docs, which must be documented. */
const docsOf = (storyFile: string): ComponentDocs => {
  const docs = extractComponentDocs(storyFile);
  if (!isComponentDocs(docs)) throw new Error(`No docs: ${JSON.stringify(docs)}`);
  return docs;
};

/** An arg's docs, by name. */
const argOf = (docs: ComponentDocs, name: string): PropDocs => {
  const arg = docs.props.find((each) => each.name === name);
  if (arg === undefined) throw new Error(`No arg ${name}: ${docs.props.map((each) => each.name).join()}`);
  return arg;
};

describe("a function the meta names", () => {
  const docs = docsOf(docsFile("Button.stories.ts"));

  it("is named after the function, and says what its TSDoc and its module say", () => {
    expect(docs.name).toBe("createButton");
    expect(docs.description).toBe("A button that does one thing.");
    expect(docs.summary).toBe("A button drawn from its args.");
  });

  it("lists its first parameter's properties in the source's order, each with its kind and TSDoc", () => {
    expect(docs.props.map((each) => [each.name, each.kind])).toEqual([
      ["label", "text"],
      ["tone", "choice"],
      ["disabled", "toggle"],
      ["onClick", "event"]
    ]);
    expect(argOf(docs, "label")).toMatchObject({ isRequired: true, description: "The text on the button." });
    expect(argOf(docs, "tone")).toMatchObject({ choices: ["neutral", "danger"], defaultValue: '"neutral"' });
  });

  it("writes its signature, and documents the subcomponents the meta names", () => {
    expect(docs.signature?.parameters[0]?.type).toBe("ButtonArgs");
    expect(docs.subcomponents.map((each) => [each.name, each.props.map((arg) => arg.name)])).toEqual([
      ["icon", ["name"]]
    ]);
  });

  it("says which files the docs come from", () => {
    const component = extractStoryComponent(docsFile("Button.stories.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error("No component");
    expect(component.file).toBe(docsFile("button.ts"));
    expect(component.sources).toContain(docsFile("button.ts"));
  });
});

describe("a story file with no component", () => {
  it("reads the type its meta is checked against, named after the story file", () => {
    const docs = docsOf(docsFile("Card.stories.ts"));
    expect(docs.name).toBe("Card");
    expect(docs.description).toBe("A card: a heading over a sentence.");
    expect(docs.props.map((each) => [each.name, each.kind, each.isRequired])).toEqual([
      ["heading", "text", true],
      ["lines", "number", false]
    ]);
  });

  it("reads a function the meta's type names with typeof", () => {
    const docs = docsOf(docsFile("Typeof.stories.ts"));
    expect(docs.name).toBe("createButton");
    expect(docs.props.map((each) => each.name)).toContain("tone");
  });

  it("reads the type its render writes for the args", () => {
    expect(docsOf(docsFile("Rendered.stories.ts")).props.map((each) => each.name)).toEqual([
      "heading",
      "lines"
    ]);
  });

  it("names no component when nothing types the args, so the panel follows the argTypes", () => {
    expect(extractComponentDocs(docsFile("Foundations.stories.ts"))).toEqual({ name: null });
    expect(extractComponentDocs(join(FIXTURES, "loose", "src", "Untyped.stories.js"))).toEqual({
      name: null
    });
  });
});

describe("plain JavaScript", () => {
  it("reads a function's args from its JSDoc", () => {
    const docs = docsOf(join(FIXTURES, "loose", "src", "Tile.stories.js"));
    expect(docs.name).toBe("tile");
    expect(argOf(docs, "text")).toMatchObject({ kind: "text", isRequired: true });
    expect(argOf(docs, "wide")).toMatchObject({ kind: "toggle", isRequired: false });
  });
});

describe("forgebook new", () => {
  it("reads the function a file exports, by name when there are several", () => {
    expect(extractFileComponent(docsFile("button.ts"))).toContain("several components (createButton, icon)");
    const component = extractFileComponent(docsFile("button.ts"), "createButton");
    if (typeof component === "string") throw new Error(component);
    expect(component.docs.name).toBe("createButton");
  });

  it("writes a TypeScript stories file importing the function by name", () => {
    expect(storyFileShape("tile", "/x/src/tile.js")).toEqual({
      extension: ".stories.ts",
      importStatement: 'import { tile } from "./tile";'
    });
  });
});
