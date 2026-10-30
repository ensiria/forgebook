/**
 * Tests for the JSX of a story drawn from its args.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyJsx } from "../src/storyJsx";

describe("storyJsx", () => {
  it("writes each kind of value as a developer would", () => {
    expect(storyJsx("Counter", { value: 12, tone: "danger", isRaised: true, isOpen: false, max: null })).toBe(
      '<Counter value={12} tone="danger" isRaised isOpen={false} max={null} />'
    );
  });

  it("writes a named value by its name", () => {
    expect(storyJsx("IconTile", { icon: { of: "IconComponent", named: "IconFolder" } })).toBe(
      "<IconTile icon={IconFolder} />"
    );
  });

  it("puts a text with a quote in braces, and children between the tags", () => {
    expect(storyJsx("Button", { label: 'Say "hi"', children: "Save" })).toBe(
      '<Button label={"Say \\"hi\\""}>Save</Button>'
    );
  });

  it("writes a component without args, and breaks a long line into one attribute per line", () => {
    expect(storyJsx("Divider", {})).toBe("<Divider />");
    const long = storyJsx("IconTile", {
      accessibleLabel: "A tile for the settings category",
      color: "violet",
      tone: "accent"
    });
    expect(long).toBe(
      '<IconTile\n  accessibleLabel="A tile for the settings category"\n  color="violet"\n  tone="accent"\n/>'
    );
  });
});
