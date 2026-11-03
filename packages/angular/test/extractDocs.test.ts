/**
 * The docs an Angular component gives the catalogue: its selector, its inputs (signal and decorated, aliased, required,
 * inherited), its projected content, its outputs (a model's change among them), a directive's, a function's signature.
 *
 * @module
 */
import { join } from "node:path";

import type { ComponentDocs, PropDocs } from "forgebook/component-docs";
import { describe, expect, it } from "vitest";

import { extractComponentDocs, extractFileComponent, storyFileShape } from "../src/vite/extractDocs.ts";
import { contentSelectors } from "../src/vite/templateContent.ts";

/** The fixture's folder. */
const FIXTURE = join(import.meta.dirname, "..", "fixtures", "docs", "src");

/** A story file's component docs, which the test expects. */
const docsOf = (file: string): ComponentDocs => {
  const docs = extractComponentDocs(join(FIXTURE, file));
  if (typeof docs === "string" || docs.name === null) throw new Error(`no docs: ${JSON.stringify(docs)}`);
  return docs;
};

/** A prop of the docs, by name. */
const propOf = (docs: ComponentDocs, name: string): PropDocs | undefined =>
  docs.props.find((prop) => prop.name === name);

describe("an Angular component's docs", () => {
  const badge = docsOf("Badge.stories.ts");

  it("names the component, its selector, its TSDoc and its file's summary", () => {
    expect(badge.name).toBe("Badge");
    expect(badge.selector).toBe("fb-badge");
    expect(badge.description).toBe("A badge: a label in a tone.");
    expect(badge.summary).toBe("A short status next to what it describes.");
  });

  it("lists its inputs, then its projected content, then its outputs", () => {
    expect(badge.props.map((prop) => prop.name)).toEqual([
      "label",
      "tone",
      "count",
      "removable",
      "size",
      "old",
      "shown",
      "aria-label",
      "tip",
      "#[icon]",
      "#default",
      "countChange",
      "removed",
      "pressed",
      "hover"
    ]);
  });

  it("reads a signal input's value, a choice in the source's order, and whether it is required", () => {
    expect(propOf(badge, "label")).toMatchObject({ kind: "text", type: "string", isRequired: true });
    expect(propOf(badge, "tone")).toMatchObject({
      kind: "choice",
      choices: ["info", "success", "danger"],
      defaultValue: '"info"',
      isRequired: false
    });
    expect(propOf(badge, "count")).toMatchObject({ kind: "number", defaultValue: "0" });
  });

  it("reads a decorated input by its alias, its transform's type and its required option", () => {
    expect(propOf(badge, "removable")).toMatchObject({ kind: "toggle", defaultValue: "false" });
    expect(propOf(badge, "size")).toMatchObject({ kind: "choice", choices: ["sm", "md"] });
    expect(propOf(badge, "old")).toMatchObject({
      kind: "text",
      description: "A member listed in the decorator."
    });
    expect(propOf(badge, "shown")).toMatchObject({ kind: "toggle", isRequired: true });
    // inherited from its base class, by its alias, with no default written
    expect(propOf(badge, "aria-label")).toMatchObject({ kind: "text", isRequired: false });
    expect(propOf(badge, "aria-label")?.defaultValue).toBeUndefined();
    expect(propOf(badge, "internal")).toBeUndefined();
    // listed by its base class's decorator, by its alias
    expect(propOf(badge, "tip")).toMatchObject({
      kind: "text",
      description: "A hint, listed by the base's decorator."
    });
  });

  it("lists the content its template file projects as args any text fills, a commented one left out", () => {
    expect(propOf(badge, "#[icon]")).toMatchObject({ kind: "other", canTakeText: true });
    expect(propOf(badge, "#default")).toMatchObject({ type: "ng-content" });
    expect(propOf(badge, "#.ignored")).toBeUndefined();
  });

  it("lists its outputs as events with what they pass, a model's change and an aliased one among them", () => {
    expect(propOf(badge, "countChange")).toMatchObject({ kind: "event", type: "(value: number) => void" });
    expect(propOf(badge, "removed")?.signature).toEqual({
      parameters: [{ name: "value", type: "string" }],
      returns: "void"
    });
    expect(propOf(badge, "pressed")).toMatchObject({ type: "(value: MouseEvent) => void" });
    expect(propOf(badge, "hover")).toMatchObject({ type: "(value: number) => void" });
  });

  it("reads the subcomponents the meta names", () => {
    expect(badge.subcomponents.map((each) => [each.name, each.props.map((prop) => prop.name)])).toEqual([
      ["Tooltip", ["fbTooltip", "side"]]
    ]);
  });

  it("reads a directive by its attribute selector", () => {
    const tooltip = docsOf("Tooltip.stories.ts");
    expect(tooltip.selector).toBe("[fbTooltip]");
    expect(tooltip.props.map((prop) => prop.name)).toEqual(["fbTooltip", "side"]);
    // a setter's parameter is what a binding sets, whatever the getter, declared first, returns
    expect(tooltip.props[1]).toMatchObject({
      kind: "choice",
      choices: ["top", "bottom"],
      type: '"top" | "bottom"'
    });
  });

  it("gives a function its signature, and a page with no component none", () => {
    const toggle = docsOf("injectToggle.stories.ts");
    expect(toggle.signature?.returns).toBe("WritableSignal<boolean>");
    expect(toggle.props).toEqual([]);
    expect(extractComponentDocs(join(FIXTURE, "Foundations.stories.ts"))).toEqual({ name: null });
  });
});

describe("a component file, for its first stories", () => {
  it("reads the file's only component, and says when a name is not one", () => {
    const read = extractFileComponent(join(FIXTURE, "badge.component.ts"));
    expect(typeof read === "string" ? read : read.docs.name).toBe("Badge");
    expect(extractFileComponent(join(FIXTURE, "badge.component.ts"), "Nope")).toContain("Nope");
  });

  it("imports the class by its name from its file", () => {
    expect(storyFileShape("Badge", join(FIXTURE, "badge.component.ts"))).toEqual({
      extension: ".stories.ts",
      importStatement: 'import { Badge } from "./badge.component";'
    });
  });
});

describe("the content a template projects", () => {
  it("reads each ng-content once, in order, and none a comment holds, wherever the comment starts", () => {
    const template = [
      '<ng-content select="[icon]" />',
      '<!-- <ng-content select=".hidden" /> -->',
      "<ng-content />",
      '<!-<!---->- <ng-content select=".after" />',
      '<ng-content select="[icon]" />',
      '<!-- unclosed <ng-content select=".never" />'
    ].join("\n");
    expect(contentSelectors(template)).toEqual(["[icon]", undefined, ".after"]);
  });
});
