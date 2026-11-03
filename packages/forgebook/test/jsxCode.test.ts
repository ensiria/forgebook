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
});
