/**
 * The docs of custom elements: read from a Custom Elements Manifest, or from a Lit element's TypeScript where there is
 * none, and the stories `forgebook new` writes from them.
 *
 * @module
 */
import { cpSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type ComponentDocs, isComponentDocs, type PropDocs } from "forgebook/component-docs";
import { afterAll, describe, expect, it } from "vitest";

import {
  extractComponentDocs,
  extractFileComponent,
  extractStoryComponent,
  storyFileShape
} from "../src/vite/extractDocs.ts";

/** The fixtures' folder. */
const FIXTURES = join(import.meta.dirname, "..", "fixtures");

/** A fixture's file. */
const fixtureFile = (fixture: string, name: string): string => join(FIXTURES, fixture, "src", name);

/** A story file's docs, which must be an element's. */
const docsOf = (storyFile: string): ComponentDocs => {
  const docs = extractComponentDocs(storyFile);
  if (!isComponentDocs(docs)) throw new Error(`No docs: ${JSON.stringify(docs)}`);
  return docs;
};

/** A prop, by name. */
const propOf = (docs: ComponentDocs, name: string): PropDocs => {
  const prop = docs.props.find((each) => each.name === name);
  if (prop === undefined) throw new Error(`No prop ${name}: ${docs.props.map((each) => each.name).join()}`);
  return prop;
};

describe("an element its manifest describes", () => {
  const docs = docsOf(fixtureFile("manifest", "Button.stories.ts"));

  it("is named by its tag, with its description and its module's", () => {
    expect(docs.name).toBe("x-button");
    expect(docs.description).toBe("A button.");
    expect(docs.summary).toBe("A button that does one thing.");
    expect(docs.parts).toEqual(["base", "label"]);
  });

  it("lists its attributes, its settable properties, its slots and its events, named as args", () => {
    expect(docs.props.map((prop) => prop.name)).toEqual([
      "variant",
      "max-length",
      "disabled",
      "label",
      "size",
      ".items",
      "#default",
      "#icon",
      "@press",
      "@blur"
    ]);
  });

  it("reads each attribute's kind from its type, its field's where its own is missing", () => {
    expect(propOf(docs, "variant")).toMatchObject({
      kind: "choice",
      choices: ["primary", "quiet"],
      type: "'primary' | 'quiet'",
      description: "How it looks.",
      defaultValue: "'primary'",
      isRequired: false
    });
    expect(propOf(docs, "max-length")).toMatchObject({
      kind: "number",
      description: "The longest label it shows.",
      defaultValue: "20"
    });
    expect(propOf(docs, "disabled").kind).toBe("toggle");
    expect(propOf(docs, "label")).toMatchObject({ kind: "text", type: "string" });
    expect(propOf(docs, ".items")).toMatchObject({ kind: "other", type: "string[]" });
  });

  it("spells out from the source a type the manifest only names", () => {
    expect(propOf(docs, "size")).toMatchObject({ kind: "choice", choices: ["sm", "lg"] });
  });

  it("lists slots as text the panel can set, and events with the event they pass", () => {
    expect(propOf(docs, "#default")).toMatchObject({
      kind: "other",
      canTakeText: true,
      description: "The label."
    });
    expect(propOf(docs, "@press")).toMatchObject({
      kind: "event",
      type: "(event: CustomEvent<{ count: number }>) => void",
      description: "The person pressed it.",
      signature: { parameters: [{ name: "event", type: "CustomEvent<{ count: number }>" }], returns: "void" }
    });
    expect(propOf(docs, "@blur").signature?.parameters).toEqual([{ name: "event", type: "Event" }]);
  });

  it("documents a subcomponent named by its tag, its summary standing for a missing description", () => {
    expect(docs.subcomponents).toEqual([
      {
        name: "Icon",
        description: "An icon.",
        props: [{ name: "name", kind: "text", type: "string", description: "", isRequired: false }]
      }
    ]);
  });

  it("points at the module's source and watches the manifest", () => {
    const component = extractStoryComponent(fixtureFile("manifest", "Button.stories.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error("No component");
    expect(component.file).toBe(fixtureFile("manifest", "Button.ts"));
    expect(component.sources).toEqual([join(FIXTURES, "manifest", "custom-elements.json"), component.file]);
  });

  it("finds an element named by its class, and still names it by its tag", () => {
    expect(docsOf(fixtureFile("manifest", "ButtonClass.stories.ts")).name).toBe("x-button");
  });
});

describe("a manifest that changes or breaks", () => {
  const folder = mkdtempSync(join(tmpdir(), "forgebook-wc-manifest-"));
  cpSync(join(FIXTURES, "manifest"), folder, { recursive: true });
  const storyFile = join(folder, "src", "ButtonClass.stories.ts");
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("is read again once its file changes", () => {
    expect(docsOf(storyFile).description).toBe("A button.");
    const manifest = join(folder, "custom-elements.json");
    writeFileSync(
      manifest,
      JSON.stringify({
        modules: [
          {
            path: "src/Button.js",
            declarations: [{ kind: "class", name: "XButton", tagName: "x-button", description: "Renamed." }]
          }
        ]
      })
    );
    utimesSync(manifest, new Date(), new Date(Date.now() + 5000));
    expect(docsOf(storyFile).description).toBe("Renamed.");
  });

  it("says why when it is no JSON", () => {
    const manifest = join(folder, "custom-elements.json");
    writeFileSync(manifest, "{ not json");
    utimesSync(manifest, new Date(), new Date(Date.now() + 10000));
    expect(extractComponentDocs(storyFile)).toMatch(/custom-elements\.json could not be read/);
  });
});

describe("a Lit element with no manifest", () => {
  const docs = docsOf(fixtureFile("lit", "Badge.stories.ts"));

  it("is found by its tag through HTMLElementTagNameMap, with its TSDoc", () => {
    expect(docs.name).toBe("ui-badge");
    expect(docs.description).toBe("A badge.");
    expect(docs.summary).toBe("A short label beside a thing.");
    expect(docs.guidance).toEqual({
      useWhen: ["A count or a state beside a title."],
      avoidWhen: ["The text is a sentence."]
    });
    expect(docs.parts).toEqual(["label"]);
  });

  it("lists its reactive properties by attribute, its own first, then its slots and events", () => {
    expect(docs.props.map((prop) => prop.name)).toEqual([
      "label",
      "tone",
      "item-count",
      "quiet",
      ".keywords",
      "density",
      "#default",
      "#icon",
      "@remove",
      "@removed"
    ]);
  });

  it("reads each property's kind, description and default", () => {
    expect(propOf(docs, "label")).toMatchObject({
      kind: "text",
      description: "The text it shows.",
      defaultValue: '""',
      isRequired: false
    });
    expect(propOf(docs, "tone")).toMatchObject({
      kind: "choice",
      choices: ["neutral", "info", "danger"],
      defaultValue: '"neutral"'
    });
    expect(propOf(docs, "item-count")).toMatchObject({ kind: "number", defaultValue: "0" });
    expect(propOf(docs, "quiet").kind).toBe("toggle");
    expect(propOf(docs, "density").choices).toEqual(["compact", "comfortable"]);
  });

  it("reads events from @fires and from what the class dispatches, slots from @slot", () => {
    expect(propOf(docs, "@remove")).toMatchObject({
      kind: "event",
      type: "(event: CustomEvent<string>) => void",
      description: "The person took it away."
    });
    expect(propOf(docs, "@removed").type).toBe("(event: Event) => void");
    expect(propOf(docs, "#default").description).toBe("The label, when it is more than text.");
    expect(propOf(docs, "#icon").description).toBe("An icon before the label.");
  });

  it("documents a subcomponent named by its class", () => {
    expect(docs.subcomponents.map((each) => [each.name, each.props.map((prop) => prop.name)])).toEqual([
      ["Plain", ["heading", "is-open"]]
    ]);
  });
});

describe("a Lit element written without decorators", () => {
  const docs = docsOf(fixtureFile("lit", "Plain.stories.ts"));

  it("is named by the tag its class is defined under, its static properties read", () => {
    expect(docs.name).toBe("ui-plain");
    expect(docs.description).toBe("A plain block.");
    expect(docs.guidance).toEqual({ deprecated: "Use `ui-badge`." });
    expect(propOf(docs, "heading")).toMatchObject({ kind: "text", defaultValue: '"Untitled"' });
    expect(propOf(docs, "is-open")).toMatchObject({ kind: "toggle", defaultValue: "false" });
    expect(docs.props.map((prop) => prop.name)).not.toContain("secret");
  });
});

describe("what is no element", () => {
  it("says so for a tag nothing defines", () => {
    expect(extractComponentDocs(fixtureFile("lit", "Missing.stories.ts"))).toMatch(
      /<ui-nowhere> is in no Custom Elements Manifest/
    );
  });

  it("gives no docs for a page with no element", () => {
    expect(extractComponentDocs(fixtureFile("lit", "Foundations.stories.ts"))).toEqual({ name: null });
  });

  it("documents a function's signature for a story about logic", () => {
    const docs = docsOf(fixtureFile("lit", "formatCount.stories.ts"));
    expect(docs.name).toBe("formatCount");
    expect(docs.signature?.parameters.map((parameter) => parameter.name)).toEqual(["count"]);
  });
});

describe("forgebook new", () => {
  it("reads the element a file exports, named by its class", () => {
    const component = extractFileComponent(fixtureFile("lit", "UiPlain.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
    expect(component.docs.name).toBe("UiPlain");
    expect(component.docs.props.map((prop) => prop.name)).toEqual(["heading", "is-open"]);
  });

  it("reads it from the manifest when the manifest lists the file", () => {
    const component = extractFileComponent(fixtureFile("manifest", "Button.ts"));
    if (typeof component === "string" || !("file" in component)) throw new Error(String(component));
    expect(component.docs.name).toBe("XButton");
    expect(component.docs.props.map((prop) => prop.name)).toContain("max-length");
  });

  it("says which class to name in a file with none", () => {
    expect(extractFileComponent(fixtureFile("lit", "format.ts"))).toMatch(/exports no custom element/);
  });

  it("writes a .stories.ts that imports the class", () => {
    expect(storyFileShape("UiPlain", fixtureFile("lit", "UiPlain.ts"))).toEqual({
      extension: ".stories.ts",
      importStatement: 'import { UiPlain } from "./UiPlain";'
    });
  });
});
