/**
 * Tests for the React props extractor, on the fixture package `@fixture/kit`.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractComponentDocs,
  extractFileComponent,
  extractStoryComponent
} from "../src/vite/extractDocs.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** The fixture package's components, a workspace package of the core's tests. */
const KIT = join(KIT_DIR, "src");

describe("a hook's signature", () => {
  it("reads each parameter with its type, its @param text and whether it is optional, and the return value", () => {
    const docs = extractComponentDocs(join(KIT, "useUndo.stories.tsx"));
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.name).toBe("useUndo");
    expect(docs.signature).toEqual({
      parameters: [
        { name: "initial", type: "TValue", description: "the first value.", isOptional: false },
        { name: "limit", type: "number", description: "how many values back it keeps.", isOptional: true }
      ],
      returns: "UndoState<TValue>",
      returnsDescription: "the value now, and how to set, undo and redo it."
    });
  });
});

describe("extractComponentDocs", () => {
  const docs = extractComponentDocs(join(KIT, "Select.stories.tsx"));

  it("reads the meta's component, its summary and only the props the package declares", () => {
    expect(docs).toMatchObject({
      name: "Select",
      description: "Lets the user pick one value from a list.",
      summary: "A select for the catalogue's tests: one value picked from a list, in three sizes."
    });
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.props.map((prop) => prop.name)).toEqual([
      "value",
      "size",
      "rows",
      "isDisabled",
      "onValueChange",
      "options",
      "hint",
      "classNames"
    ]);
  });

  it("gives every prop its kind, summary, default and requirement", () => {
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
    expect(byName["value"]).toMatchObject({
      kind: "text",
      type: "string",
      description: "The chosen value, when controlled.",
      isRequired: false
    });
    expect(byName["size"]).toMatchObject({
      kind: "choice",
      choices: ["sm", "md", "lg"],
      defaultValue: '"md"'
    });
    expect(byName["rows"]?.kind).toBe("number");
    expect(byName["isDisabled"]).toMatchObject({ kind: "toggle", defaultValue: "false" });
    expect(byName["onValueChange"]).toMatchObject({
      kind: "event",
      signature: { parameters: [{ name: "value", type: "string" }], returns: "void" }
    });
    expect(byName["options"]).toMatchObject({ kind: "other", isRequired: true });
    expect(byName["options"]?.canTakeText).toBeUndefined();
    // a node takes a text, so the panel can set it
    expect(byName["hint"]).toMatchObject({ kind: "other", canTakeText: true });
  });

  it("lists the parts from the classNames map", () => {
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.parts).toEqual(["root", "trigger", "list"]);
  });

  it("reads the parts the meta names in subcomponents, by their key, with their props like the component's", () => {
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.subcomponents.map((part) => part.name)).toEqual(["SelectGroup"]);
    const [group] = docs.subcomponents;
    expect(group?.description).toBe("Groups a select's options under a label.");
    expect(group?.props.map((prop) => prop.name)).toEqual(["label", "isFolded", "onFoldChange", "children"]);
    expect(group?.props[0]).toMatchObject({ kind: "text", isRequired: true });
    expect(group?.props[1]).toMatchObject({ kind: "toggle", defaultValue: "false" });
    expect(group?.props[2]).toMatchObject({
      kind: "event",
      signature: { parameters: [{ name: "isFolded", type: "boolean" }], returns: "void" }
    });
  });

  it("names the files its docs come from, its parts' too, so the catalogue renews them when one is edited", () => {
    const component = extractStoryComponent(join(KIT, "Select.stories.tsx"));
    if (typeof component === "string" || !("sources" in component)) throw new Error(String(component));
    expect(component.file).toBe(join(KIT, "Select.tsx"));
    expect(component.sources).toEqual([join(KIT, "Select.tsx"), join(KIT, "SelectGroup.tsx")]);
  });

  it("answers no component for a page without one", () => {
    expect(extractComponentDocs(join(KIT, "Page.stories.tsx"))).toEqual({ name: null });
  });
});

describe("the order of the docs", () => {
  const Ordered = join(import.meta.dirname, "fixtures", "order", "ordered", "Ordered.stories.tsx");
  const lines = (): string[] => {
    const component = extractStoryComponent(Ordered);
    if (typeof component === "string" || !("props" in component.docs)) throw new Error("no docs");
    return component.docs.props.map((prop) => `${prop.name}:${prop.type}`);
  };

  it("lists the props by declaration, the component's folder first, and writes each type as the source does", () => {
    expect(lines()).toEqual([
      "label:ReactNode",
      'size:"md" | "sm"',
      'textStyle:"body" | "caption" | "badge"',
      'variant:"default" | "grid"',
      'opens:"top" | "bottom" | "left" | "right"',
      'indicator:"spinner" | "dot"',
      "shared:string",
      'side:"top" | "bottom" | "left" | "right"'
    ]);
  });

  it("answers the same after other files were read first: no order comes from what the checker met before", () => {
    const first = lines();
    extractStoryComponent(join(KIT, "Select.stories.tsx"));
    expect(lines()).toEqual(first);
  });
});

describe("a story file no tsconfig.json holds", () => {
  it("reads a JavaScript story file that no tsconfig.json holds, from the file's own imports", () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-js-"));
    writeFileSync(
      join(dir, "Tag.jsx"),
      "/** A tag. */\nexport const Tag = (/** @type {{ label: string }} */ { label }) => <span>{label}</span>;\n"
    );
    writeFileSync(
      join(dir, "Tag.stories.jsx"),
      'import { Tag } from "./Tag";\nexport default { title: "Tags/Tag", component: Tag };\nexport const Shown = {};\n'
    );
    const component = extractStoryComponent(join(dir, "Tag.stories.jsx"));
    expect(typeof component === "string" ? component : component.docs.name).toBe("Tag");
    expect(
      typeof component === "string" || !("file" in component)
        ? []
        : component.docs.props.map((prop) => prop.name)
    ).toEqual(["label"]);
  });
});

describe("extractFileComponent", () => {
  it("reads the component a file exports, with the same props as through a story's meta", () => {
    const fromFile = extractFileComponent(join(KIT, "Select.tsx"));
    const fromStory = extractStoryComponent(join(KIT, "Select.stories.tsx"));
    if (typeof fromFile === "string" || !("file" in fromFile)) throw new Error(String(fromFile));
    if (typeof fromStory === "string" || !("file" in fromStory)) throw new Error(String(fromStory));
    expect(fromFile.docs.name).toBe("Select");
    expect(fromFile.docs.props.map((prop) => prop.name)).toEqual(
      fromStory.docs.props.map((prop) => prop.name)
    );
  });

  it("says when a file exports no component, or not the one named", () => {
    expect(extractFileComponent(join(KIT, "formatSize.ts"))).toContain("exports no component");
    expect(extractFileComponent(join(KIT, "Select.tsx"), "Missing")).toContain(
      "exports no component Missing"
    );
  });
});
