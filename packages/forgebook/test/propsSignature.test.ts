/**
 * Tests for the props' signature a story file `forgebook new` writes carries, and reading it back.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PropDocs } from "../src/componentDocs.ts";
import { propsMarkerLine, propsSignature, writtenSignature } from "../src/propsSignature.ts";

/** A prop, required unless said. */
const prop = (name: string, type: string, isRequired = true): PropDocs => ({
  name,
  kind: "other",
  type,
  description: "",
  isRequired
});

describe("propsSignature", () => {
  const props = [prop("label", "string"), prop("tone", '"neutral" | "danger"', false)];

  it("is eight hexadecimal digits, the same for the same props in any order", () => {
    expect(propsSignature(props)).toMatch(/^[0-9a-f]{8}$/);
    expect(propsSignature([...props].reverse())).toBe(propsSignature(props));
  });

  it("changes when a prop is added, removed, renamed, retyped or becomes required", () => {
    const base = propsSignature(props);
    expect(propsSignature([...props, prop("count", "number", false)])).not.toBe(base);
    expect(propsSignature(props.slice(0, 1))).not.toBe(base);
    expect(propsSignature([prop("text", "string"), props[1] ?? prop("x", "x")])).not.toBe(base);
    expect(propsSignature([prop("label", "number"), props[1] ?? prop("x", "x")])).not.toBe(base);
    expect(propsSignature([props[0] ?? prop("x", "x"), prop("tone", '"neutral" | "danger"')])).not.toBe(base);
  });

  it("ignores what the args do not depend on: descriptions and defaults", () => {
    const described = props.map((each) => ({ ...each, description: "said", defaultValue: "1" }));
    expect(propsSignature(described)).toBe(propsSignature(props));
  });
});

describe("writtenSignature", () => {
  it("reads back the line forgebook new writes", () => {
    const text = `/** x */\n${propsMarkerLine("0a1b2c3d")}\nimport type { Meta } from "x";\n`;
    expect(writtenSignature(text)).toBe("0a1b2c3d");
  });

  it("finds none in a file written by hand", () => {
    expect(writtenSignature('import type { Meta } from "x";\n// forgebook-props are fun\n')).toBeUndefined();
  });
});
