/**
 * The docs of Vue components: single-file components, `defineComponent`, composables, and the ways a project is
 * configured.
 *
 * @module
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ComponentDocs, isComponentDocs, type PropDocs } from "forgebook/component-docs";
import { normalizePath } from "vite";
import { describe, expect, it } from "vitest";

import {
  extractComponentDocs,
  extractFileComponent,
  extractStoryComponent,
  sourcesChanged,
  storyFileShape
} from "../src/vite/extractDocs.ts";

/** The fixtures' folder. */
const FIXTURES = join(import.meta.dirname, "..", "fixtures");

/** A single-file component with one prop. */
const SFC_WITH_PROP = (name: string): string =>
  `<script setup lang="ts">\ndefineProps<{ ${name}: string }>();\n</script>\n<template><i /></template>\n`;

/** A docs fixture's file. */
const docsFile = (name: string): string => join(FIXTURES, "docs", "src", name);

/** A story file's docs, which must be a component's. */
const docsOf = (storyFile: string): ComponentDocs => {
  const docs = extractComponentDocs(storyFile);
  if (!isComponentDocs(docs)) throw new Error(`No docs: ${JSON.stringify(docs)}`);
  return docs;
};

/** A prop of a component, by name. */
const propOf = (docs: ComponentDocs, name: string): PropDocs => {
  const prop = docs.props.find((each) => each.name === name);
  if (prop === undefined) throw new Error(`No prop ${name}: ${docs.props.map((each) => each.name).join()}`);
  return prop;
};

describe("a single-file component", () => {
  const docs = docsOf(docsFile("Badge.stories.ts"));

  it("is named after the meta's import, and says what its opening comment says", () => {
    expect(docs.name).toBe("Badge");
    expect(docs.summary).toBe("A short label beside a thing.");
    expect(docs.guidance).toEqual({
      useWhen: ["A count or a state beside a title."],
      avoidWhen: ["The text is a sentence."],
      alternatives: ["Tag", "Pill"]
    });
  });

  it("lists its props in the source's order, each with its kind and its TSDoc", () => {
    expect(
      docs.props
        .filter((prop) => prop.kind !== "event" && !prop.name.startsWith("#"))
        .map((prop) => prop.name)
    ).toEqual(["label", "tone", "size", "quiet", "count", "meta", "note"]);
    expect(propOf(docs, "label")).toMatchObject({
      kind: "text",
      type: "string",
      description: "The text it shows.",
      isRequired: true
    });
    expect(propOf(docs, "quiet").kind).toBe("toggle");
    expect(propOf(docs, "count").kind).toBe("number");
    expect(propOf(docs, "meta").kind).toBe("other");
  });

  it("gives a choice's values in the order the source writes them, through an alias", () => {
    expect(propOf(docs, "size").choices).toEqual(["xl", "sm"]);
    expect(propOf(docs, "tone")).toMatchObject({
      kind: "choice",
      choices: ["neutral", "info", "danger"],
      type: '"neutral" | "info" | "danger"'
    });
  });

  it("takes a default from TSDoc, or from `withDefaults`", () => {
    expect(propOf(docs, "tone").defaultValue).toBe('"neutral"');
    expect(propOf(docs, "count").defaultValue).toBe("3");
    expect(propOf(docs, "count").isRequired).toBe(false);
  });

  it("lists an event as the listener a story sets, with what it passes", () => {
    expect(propOf(docs, "onRemove")).toMatchObject({
      kind: "event",
      description: "The person took it away.",
      type: "(id: string, force: boolean) => void",
      signature: {
        parameters: [
          { name: "id", type: "string" },
          { name: "force", type: "boolean" }
        ],
        returns: "void"
      }
    });
  });

  it("gives a model's event what it passes", () => {
    expect(propOf(docs, "onUpdate:note").signature?.parameters).toEqual([
      { name: "value", type: "string | undefined" }
    ]);
  });

  it("lists a slot as the arg that fills it, taking a text", () => {
    expect(propOf(docs, "#default")).toMatchObject({
      kind: "other",
      canTakeText: true,
      description: "What goes after the label.",
      isRequired: false
    });
    expect(propOf(docs, "#default").type).toContain("label: string");
    expect(propOf(docs, "#icon").type).toBe("Slot");
  });

  it("reads an event's comment when a plain script comes first", () => {
    const component = extractFileComponent(docsFile("TwoScripts.vue"));
    if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
    expect(propOf(component.docs, "onPick").description).toBe("The person picked it.");
  });

  it("reads the meta's subcomponents, through an alias of the project's", () => {
    expect(docs.subcomponents.map((each) => each.name)).toEqual(["Item", "Plain"]);
    const [item] = docs.subcomponents;
    expect(item?.description).toBe("A row of a list of badges.");
    expect(item?.props.map((prop) => prop.name)).toEqual(["text"]);
  });

  it("names the files its docs come from, so an edit to any renews them", () => {
    const component = extractStoryComponent(docsFile("Badge.stories.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error("No component");
    // TypeScript names files with forward slashes on every system, as Vite does
    expect(component.file).toBe(normalizePath(docsFile("Badge.vue")));
    expect(component.sources).toContain(normalizePath(docsFile("Badge.vue")));
    expect(component.sources).toContain(normalizePath(docsFile("Item.vue")));
  });
});

describe("a component in TypeScript", () => {
  const docs = docsOf(docsFile("Plain.stories.ts"));

  it("reads a `defineComponent`'s runtime props and events", () => {
    expect(docs.name).toBe("Plain");
    expect(docs.summary).toBe("A component with no single-file component behind it.");
    expect(docs.description).toBe("A plain block.");
    expect(docs.guidance).toEqual({ deprecated: "Use `Badge`." });
    expect(propOf(docs, "title")).toMatchObject({ kind: "text", isRequired: true });
    expect(propOf(docs, "mode")).toMatchObject({ kind: "choice", isRequired: false, defaultValue: '"wide"' });
    expect(propOf(docs, "onPick").signature?.parameters).toEqual([{ name: "id", type: "number" }]);
  });
});

describe("a story file without a component to draw", () => {
  it("documents a composable's signature", () => {
    const docs = docsOf(docsFile("useToggle.stories.ts"));
    expect(docs.name).toBe("useToggle");
    expect(docs.props).toEqual([]);
    expect(docs.signature).toMatchObject({
      returns: "Ref<boolean>",
      returnsDescription: "the value.",
      parameters: [{ name: "start", isOptional: true, description: "where it starts." }]
    });
  });

  it("says when a meta names no component", () => {
    expect(extractComponentDocs(docsFile("Foundations.stories.ts"))).toEqual({ name: null });
  });
});

describe("the ways a project is configured", () => {
  it("follows a configuration that only lists references", () => {
    const docs = docsOf(join(FIXTURES, "references", "src", "Chip.stories.ts"));
    expect(propOf(docs, "text")).toMatchObject({ kind: "text", isRequired: true });
  });

  it("reads a project with no configuration, in JavaScript", () => {
    const docs = docsOf(join(FIXTURES, "loose", "src", "Tile.stories.js"));
    expect(propOf(docs, "text")).toMatchObject({ kind: "text", isRequired: true });
  });
});

describe("reading again", () => {
  it("sees an edit once the worker hears of it", () => {
    const folder = mkdtempSync(join(FIXTURES, "edited-"));
    try {
      writeFileSync(
        join(folder, "tsconfig.json"),
        readFileSync(join(FIXTURES, "docs", "tsconfig.json"), "utf8")
      );
      writeFileSync(join(folder, "Edited.vue"), SFC_WITH_PROP("before"));
      writeFileSync(
        join(folder, "Edited.stories.ts"),
        'import Edited from "./Edited.vue";\nexport default { title: "Edited", component: Edited };\n'
      );
      const include = '"include": ["."]';
      const config = join(folder, "tsconfig.json");
      writeFileSync(config, readFileSync(config, "utf8").replace('"include": ["src"]', include));
      const story = join(folder, "Edited.stories.ts");
      expect(docsOf(story).props.map((prop) => prop.name)).toEqual(["before"]);
      writeFileSync(join(folder, "Edited.vue"), SFC_WITH_PROP("after"));
      sourcesChanged();
      expect(docsOf(story).props.map((prop) => prop.name)).toEqual(["after"]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("what `forgebook new` reads", () => {
  it("reads a single-file component from its file, named after it", () => {
    const component = extractFileComponent(docsFile("Badge.vue"));
    if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
    expect(component.docs.name).toBe("Badge");
    expect(component.docs.props.map((prop) => prop.name)).toContain("label");
  });

  it("writes a kebab-case file's import as a component's name", () => {
    expect(storyFileShape("MyButton", "/kit/src/my-button.vue").importStatement).toBe(
      'import MyButton from "./my-button.vue";'
    );
  });

  it("reads a component exported as a function, or by name", () => {
    for (const [name, prop] of [
      ["Plate", "width"],
      ["Shelf", "depth"]
    ] as const) {
      const component = extractFileComponent(docsFile("Plain.ts"), name);
      if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
      expect(component.docs.props.map((each) => each.name)).toEqual([prop]);
    }
  });

  it("gives a message for a file it cannot read, instead of throwing", () => {
    expect(extractStoryComponent(docsFile("Missing.stories.ts"))).toBeTypeOf("string");
  });

  it("asks which component of a file with several", () => {
    expect(extractFileComponent(docsFile("Plain.ts"))).toContain("several components (");
    const component = extractFileComponent(docsFile("Plain.ts"), "Plain");
    expect(typeof component === "string" ? component : component.docs.name).toBe("Plain");
  });

  it("writes stories in TypeScript, importing a single-file component by its default export", () => {
    expect(storyFileShape("Badge", "/kit/src/Badge.vue")).toEqual({
      extension: ".stories.ts",
      importStatement: 'import Badge from "./Badge.vue";'
    });
    expect(storyFileShape("Plain", "/kit/src/Plain.ts").importStatement).toBe(
      'import { Plain } from "./Plain";'
    );
  });
});
