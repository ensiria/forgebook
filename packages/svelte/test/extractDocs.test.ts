/**
 * The docs of Svelte components: a component with TypeScript and one with JSDoc, its snippets and callback props, a
 * function with runes, and the ways a project is configured.
 *
 * @module
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ComponentDocs, isComponentDocs, type PropDocs } from "forgebook/component-docs";
import { markSourcesChanged } from "forgebook/vite/docs-program";
import { normalizePath } from "vite";
import { describe, expect, it } from "vitest";

import {
  extractComponentDocs,
  extractFileComponent,
  extractStoryComponent,
  storyFileShape
} from "../src/vite/extractDocs.ts";

/** The fixtures' folder. */
const FIXTURES = join(import.meta.dirname, "fixtures");

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
  if (prop === undefined) throw new Error(`No prop ${name}`);
  return prop;
};

/** A component with one prop. */
const componentWithProp = (name: string): string =>
  `<script lang="ts">\n  const { ${name} }: { ${name}: string } = $props();\n</script>\n<i>{${name}}</i>\n`;

describe("a component with TypeScript", () => {
  const docs = docsOf(docsFile("Badge.stories.ts"));

  it("is named after the meta's import, and says what its @component and its script's comment say", () => {
    expect(docs.name).toBe("Badge");
    expect(docs.description).toBe("A short label that says what something is.");
    expect(docs.summary).toBe("The badge: a label, a tone and an optional icon.");
    expect(docs.guidance).toEqual({ useWhen: ["a status needs a word"] });
  });

  it("lists its own props in the source's order, with their kinds and TSDoc, and leaves out an element's", () => {
    expect(docs.props.map((prop) => prop.name)).toEqual([
      "label",
      "tone",
      "count",
      "removable",
      "#icon",
      "#trailing",
      "onremove",
      "note"
    ]);
    expect(propOf(docs, "label")).toMatchObject({
      kind: "text",
      isRequired: true,
      description: "What it says."
    });
    expect(propOf(docs, "tone")).toMatchObject({ kind: "choice", choices: ["neutral", "info", "danger"] });
    expect(propOf(docs, "removable")).toMatchObject({ kind: "toggle" });
  });

  it("takes each default from $props(), $bindable's included", () => {
    expect(propOf(docs, "tone").defaultValue).toBe('"neutral"');
    expect(propOf(docs, "count").defaultValue).toBe("0");
    expect(propOf(docs, "note").defaultValue).toBe('""');
    expect(propOf(docs, "label").defaultValue).toBeUndefined();
  });

  it("lists a snippet as the arg that fills it with a text", () => {
    expect(propOf(docs, "#icon")).toEqual({
      name: "#icon",
      kind: "other",
      type: "Snippet",
      description: "Drawn before the label.",
      isRequired: false,
      canTakeText: true
    });
    expect(propOf(docs, "#trailing").type).toBe("Snippet<[count: number]>");
  });

  it("lists a callback prop named as Svelte names one as an event, with what it passes", () => {
    expect(propOf(docs, "onremove")).toMatchObject({
      kind: "event",
      signature: { parameters: [{ name: "label", type: "string" }], returns: "void" }
    });
  });

  it("reads the meta's subcomponents", () => {
    expect(docs.subcomponents.map((each) => each.name)).toEqual(["Plain"]);
  });

  it("names the files its docs come from, a component as its .svelte file", () => {
    const component = extractStoryComponent(docsFile("Badge.stories.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error("No component");
    expect(component.file).toBe(normalizePath(docsFile("Badge.svelte")));
    expect(component.sources).toContain(normalizePath(docsFile("Badge.svelte")));
    expect(component.sources).toContain(normalizePath(docsFile("Plain.svelte")));
    expect(component.sources.some((file) => file.endsWith(".svelte.ts"))).toBe(false);
  });
});

describe("other components and stories", () => {
  it("reads a component written without TypeScript from its JSDoc", () => {
    const docs = docsOf(docsFile("Plain.stories.ts"));
    expect(docs.description).toBe("A component written without TypeScript.");
    expect(propOf(docs, "text")).toMatchObject({
      kind: "text",
      description: "What it shows.",
      defaultValue: '"Plain"'
    });
    expect(propOf(docs, "onclick").kind).toBe("event");
  });

  it("documents a function with runes by its signature", () => {
    const docs = docsOf(docsFile("toggle.stories.ts"));
    expect(docs.name).toBe("createToggle");
    expect(docs.props).toEqual([]);
    expect(docs.signature?.parameters.map((parameter) => parameter.name)).toEqual(["initial"]);
  });

  it("says when a meta names no component", () => {
    expect(extractComponentDocs(docsFile("Foundations.stories.ts"))).toEqual({ name: null });
  });

  it("sees an edit once the worker hears of it", () => {
    const folder = mkdtempSync(join(FIXTURES, "edited-"));
    try {
      const config = readFileSync(join(FIXTURES, "docs", "tsconfig.json"), "utf8");
      writeFileSync(join(folder, "tsconfig.json"), config.replace('"include": ["src"]', '"include": ["."]'));
      writeFileSync(join(folder, "Edited.svelte"), componentWithProp("before"));
      writeFileSync(
        join(folder, "Edited.stories.ts"),
        'import Edited from "./Edited.svelte";\nexport default { title: "Edited", component: Edited };\n'
      );
      const story = join(folder, "Edited.stories.ts");
      expect(docsOf(story).props.map((prop) => prop.name)).toEqual(["before"]);
      writeFileSync(join(folder, "Edited.svelte"), componentWithProp("after"));
      markSourcesChanged();
      expect(docsOf(story).props.map((prop) => prop.name)).toEqual(["after"]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("reads a component whose script does not parse as one with no props, instead of throwing", () => {
    const folder = mkdtempSync(join(FIXTURES, "broken-"));
    try {
      writeFileSync(join(folder, "Broken.svelte"), '<script lang="ts">\n  const = ;\n</script>\n');
      writeFileSync(
        join(folder, "Broken.stories.ts"),
        'import Broken from "./Broken.svelte";\nexport default { title: "Broken", component: Broken };\n'
      );
      expect(docsOf(join(folder, "Broken.stories.ts")).props).toEqual([]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("a component's file, for forgebook new", () => {
  it("reads a .svelte file's component, named after it", () => {
    const component = extractFileComponent(docsFile("Badge.svelte"));
    if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
    expect(component.docs.name).toBe("Badge");
    expect(component.file).toBe(normalizePath(docsFile("Badge.svelte")));
    expect(component.docs.props.map((prop) => prop.name)).toContain("label");
  });

  it("writes stories in TypeScript, importing a .svelte file by its default export", () => {
    expect(storyFileShape("Badge", docsFile("Badge.svelte"))).toEqual({
      extension: ".stories.ts",
      importStatement: 'import Badge from "./Badge.svelte";'
    });
  });
});
