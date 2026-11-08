/**
 * Tests for the JSX of a story drawn from its args.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { jsxCode } from "../src/jsxCode.ts";

describe("jsxCode", () => {
  it("writes each kind of value as a developer would", () => {
    expect(jsxCode("Counter", { value: 12, tone: "danger", isRaised: true, isOpen: false, max: null })).toBe(
      '<Counter value={12} tone="danger" isRaised isOpen={false} max={null} />'
    );
  });

  it("writes nested values as literals", () => {
    expect(jsxCode("Box", { style: { top: 1, "z-index": [2, "x"], on: null } })).toBe(
      '<Box style={{ top: 1, "z-index": [2, "x"], on: null }} />'
    );
    expect(jsxCode("Box", { icons: [{ of: "Icon", named: "Star" }], none: {} })).toBe(
      "<Box icons={[Star]} none={{}} />"
    );
  });

  it("writes a named value by its name", () => {
    expect(jsxCode("IconTile", { icon: { of: "IconComponent", named: "IconFolder" } })).toBe(
      "<IconTile icon={IconFolder} />"
    );
  });

  it("puts a text with a quote in braces, and children between the tags", () => {
    expect(jsxCode("Button", { label: 'Say "hi"', children: "Save" })).toBe(
      '<Button label={"Say \\"hi\\""}>Save</Button>'
    );
  });

  it("writes a component without args, and breaks a long line into one attribute per line", () => {
    expect(jsxCode("Divider", {})).toBe("<Divider />");
    const long = jsxCode("IconTile", {
      accessibleLabel: "A tile for the settings category",
      color: "violet",
      tone: "accent"
    });
    expect(long).toBe(
      '<IconTile\n  accessibleLabel="A tile for the settings category"\n  color="violet"\n  tone="accent"\n/>'
    );
  });

  it("writes a list as an array literal, its texts quoted", () => {
    expect(jsxCode("Select", { options: ["weekly", "monthly"], counts: [1, 2] })).toBe(
      '<Select options={["weekly", "monthly"]} counts={[1, 2]} />'
    );
  });

  it("writes the args the file writes as code as written, over their values, functions and elements included", () => {
    expect(
      jsxCode(
        "Button",
        { label: "Star", items: ["a"] },
        { onClick: "fn()", icon: "<IconStar size={16} />", items: "ITEMS" }
      )
    ).toBe('<Button label="Star" items={ITEMS} onClick={fn()} icon={<IconStar size={16} />} />');
  });

  it("puts written children between the tags: an element as it is, other code in braces", () => {
    expect(jsxCode("Menu", {}, { children: "<Menu.Item>Copy</Menu.Item>" })).toBe(
      "<Menu><Menu.Item>Copy</Menu.Item></Menu>"
    );
    expect(jsxCode("Text", {}, { children: "greeting.trim()" })).toBe("<Text>{greeting.trim()}</Text>");
  });

  it("indents written code that spans lines under its attribute", () => {
    expect(jsxCode("Button", { label: "Go" }, { onClick: "() => {\n  save();\n}" })).toBe(
      '<Button\n  label="Go"\n  onClick={() => {\n    save();\n  }}\n/>'
    );
    expect(jsxCode("Card", {}, { children: "<>\n  <Body />\n</>" })).toBe(
      "<Card>\n  <>\n    <Body />\n  </>\n</Card>"
    );
  });
});
