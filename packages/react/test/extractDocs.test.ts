/**
 * Tests for the React props extractor, on the fixture package `@fixture/kit`.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizePath } from "vite";
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
      typeParameters: ["TValue"],
      parameters: [
        {
          name: "initial",
          type: "TValue",
          description: "the first value.",
          isOptional: false,
          isRest: false
        },
        {
          name: "limit",
          type: "number",
          description: "how many values back it keeps.",
          isOptional: true,
          isRest: false
        }
      ],
      returns: "UndoState<TValue>",
      returnsDescription: "the value now, and how to set, undo and redo it."
    });
  });
});

describe("a signature's parameters, as the call writes them", () => {
  it("names a destructured parameter by its pattern, marks a rest one, and lists the type parameters", () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-signature-"));
    writeFileSync(
      join(dir, "useTotal.ts"),
      [
        "/** Options. */",
        "export type Options = { readonly start: number };",
        "/**",
        " * Adds numbers.",
        " *",
        " * @param options - where it starts.",
        " * @param values - the numbers.",
        " * @returns the total.",
        " */",
        "export const useTotal = <TUnit extends string>({ start }: Options, ...values: number[]): TUnit | number =>",
        "  values.reduce((total, value) => total + value, start);",
        ""
      ].join("\n")
    );
    writeFileSync(
      join(dir, "useTotal.stories.ts"),
      'import { useTotal } from "./useTotal";\nexport default { title: "Hooks/useTotal", component: useTotal };\nexport const Shown = {};\n'
    );
    const docs = extractComponentDocs(join(dir, "useTotal.stories.ts"));
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.signature).toEqual({
      typeParameters: ["TUnit extends string"],
      parameters: [
        {
          name: "{ start }",
          type: "Options",
          description: "where it starts.",
          isOptional: false,
          isRest: false
        },
        { name: "values", type: "number[]", description: "the numbers.", isOptional: false, isRest: true }
      ],
      returns: "TUnit | number",
      returnsDescription: "the total."
    });
  });
});

describe("a hook typed through an alias", () => {
  it("reads its @param and @returns texts from the comment on its declaration", () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-alias-"));
    writeFileSync(
      join(dir, "useTyped.ts"),
      [
        "/** A hook's type. */",
        "export type UseTyped = (count: number) => string;",
        "/**",
        " * Writes a count.",
        " *",
        " * @param count - how many.",
        " * @returns the text.",
        " */",
        "export const useTyped: UseTyped = (count) => String(count);",
        ""
      ].join("\n")
    );
    writeFileSync(
      join(dir, "useTyped.stories.ts"),
      'import { useTyped } from "./useTyped";\nexport default { title: "Hooks/useTyped", component: useTyped };\nexport const Shown = {};\n'
    );
    const docs = extractComponentDocs(join(dir, "useTyped.stories.ts"));
    if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
    expect(docs.signature?.parameters[0]).toMatchObject({
      name: "count",
      type: "number",
      description: "how many."
    });
    expect(docs.signature?.returnsDescription).toBe("the text.");
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
    // TypeScript names files with forward slashes on every system, as Vite does
    expect(component.file).toBe(normalizePath(join(KIT, "Select.tsx")));
    expect(component.sources).toEqual([
      normalizePath(join(KIT, "Select.tsx")),
      normalizePath(join(KIT, "SelectGroup.tsx"))
    ]);
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

describe("a component's guidance", () => {
  /** The docs of a component written with this TSDoc, in a folder of its own. */
  const docsOf = (tsdoc: string): unknown => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-guidance-"));
    writeFileSync(
      join(dir, "Card.tsx"),
      `${tsdoc}\nexport const Card = (props: { readonly label: string }) => <p>{props.label}</p>;\n`
    );
    writeFileSync(
      join(dir, "Card.stories.tsx"),
      'import { Card } from "./Card";\nexport default { title: "A/Card", component: Card };\n'
    );
    return extractComponentDocs(join(dir, "Card.stories.tsx"));
  };

  it("reads when to use it and when not, what to use instead and why not", () => {
    const docs = docsOf(`/**
 * A card.
 *
 * @useWhen a group of related facts.
 * @useWhen a link to a page.
 * @avoidWhen a single line of text.
 * @alternatives \`Row\`, \`Panel\`
 * @deprecated it does not scale.
 * @replacedBy \`Tile\`
 */`);
    expect(docs).toMatchObject({
      guidance: {
        useWhen: ["a group of related facts.", "a link to a page."],
        avoidWhen: ["a single line of text."],
        alternatives: ["Row", "Panel"],
        deprecated: "it does not scale.",
        replacedBy: "Tile"
      }
    });
  });

  it("says deprecated with no reason, since the tag alone means it", () => {
    expect(docsOf("/** A card.\n * @deprecated\n */")).toMatchObject({
      guidance: { deprecated: "Deprecated." }
    });
  });

  it("carries no field for a component that says nothing, so answers stay short", () => {
    expect(docsOf("/** A card. */")).not.toHaveProperty("guidance");
  });
});
