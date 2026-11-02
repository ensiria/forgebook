/**
 * Tests for `forgebook-docs`' reading of Sass modules and style sheets; its components, read by a framework, are
 * tested in that framework's package (`@forgebook/react`).
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { CatalogueComponent } from "../bin/forgebook-docs/catalogueDocs.types.ts";
import { catalogueMarkdown } from "../bin/forgebook-docs/catalogueMarkdown.ts";
import { sassMembers, styleSheetSummary } from "../bin/forgebook-docs/sassDocs.ts";

describe("sassDocs", () => {
  it("reads every documented member with its parameters and its summary across lines", () => {
    expect(
      sassMembers("/// One.\n/// Two.\n/// @param x\n@mixin a(\n  $x,\n  $y: 1px\n) {}\n@function b() {}")
    ).toEqual([
      { kind: "mixin", name: "a", parameters: ["$x", "$y"], summary: "One. Two." },
      { kind: "function", name: "b", parameters: [], summary: "" }
    ]);
  });

  it("gives a style sheet the first sentence of its leading comment", () => {
    expect(styleSheetSummary('// The sheet. More words.\n// Still the comment.\n@use "x";')).toBe(
      "The sheet."
    );
  });
});

describe("catalogueMarkdown", () => {
  it("ends a component's line with its design, when it has one", () => {
    const component: CatalogueComponent = {
      title: "Actions/Button",
      subpath: "./button",
      docs: {
        name: "Button",
        description: "A button.",
        summary: "",
        props: [],
        parts: [],
        subcomponents: []
      },
      stories: ["Overview"],
      mainStory: "Overview",
      isLogic: false,
      design: "https://www.figma.com/design/File1/Kit?node-id=1-2"
    };
    const text = catalogueMarkdown(
      {
        packageName: "@acme/ui",
        description: undefined,
        sourceId: undefined,
        components: [component],
        modules: [],
        sassModules: [],
        styleSheets: []
      },
      ["components"]
    );
    expect(text).toContain(" · design: https://www.figma.com/design/File1/Kit?node-id=1-2");
  });
});
