/**
 * Tests for a story's code as text, as the shell shows it and an agent reads it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { jsxCode } from "../src/jsxCode.ts";
import { storyCodeText } from "../src/storyCodeText.ts";

describe("storyCodeText", () => {
  const code = {
    Row: { text: "(args) => <Row />", html: "" },
    Spy: { args: { onClick: "fn()", items: "ITEMS" } }
  };

  it("gives a render as written, whatever the values", () => {
    expect(
      storyCodeText({ code, exportName: "Row", componentName: "Button", args: { label: "Go" } }, jsxCode)
    ).toBe("(args) => <Row />");
  });

  it("writes the args the file writes as code, but those set in the panel from their values", () => {
    const source = { code, exportName: "Spy", componentName: "Button", args: { items: ["a"] } };
    expect(storyCodeText(source, jsxCode)).toBe("<Button items={ITEMS} onClick={fn()} />");
    expect(storyCodeText({ ...source, edited: ["items"] }, jsxCode)).toBe(
      '<Button items={["a"]} onClick={fn()} />'
    );
  });

  it("writes a story with no code of its own from its values", () => {
    expect(
      storyCodeText({ code, exportName: "Plain", componentName: "Button", args: { label: "Go" } }, jsxCode)
    ).toBe('<Button label="Go" />');
  });
});
