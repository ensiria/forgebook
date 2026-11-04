/**
 * Tests for values written into generated code: each literal evaluates back to its value, and none holds a character
 * that could end an inline script or, in an older parser, a string.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { codeLiteral, codeOfJson } from "../src/codeLiteral.ts";

/**
 * What a literal evaluates to, run as the code it is written into.
 *
 * @param literal - the literal.
 */
const evaluated = (literal: string): unknown => new Function(`return ${literal};`)();

/** Values a generator writes: paths of every system, names, and text that tries to leave a script. */
const VALUES: readonly unknown[] = [
  "/Users/ada/app/src/Button.stories.tsx?forgebook-docs",
  "C:\\Users\\ada\\app\\src\\Button.stories.tsx",
  "//server/share/app/x.ts",
  "</script><script>alert(1)</script>",
  "<!-- a comment -->",
  "a\u2028line\u2029and a paragraph",
  "quotes \" and ' and `",
  "ünïcödé and emoji 🧪",
  "",
  0,
  -1.5,
  true,
  null,
  ["</script>", "C:\\a\\b", { nested: "a/b>c" }],
  { "</script>": "key", path: "src/a.ts", count: 2, list: [] }
];

describe("codeLiteral", () => {
  it.each(VALUES.map((value) => [value]))("evaluates back to %j", (value) => {
    expect(evaluated(codeLiteral(value))).toEqual(value);
  });

  it("leaves no character that ends a script or a string in an older parser", () => {
    for (const value of VALUES) {
      // a slash stays, escaped: `<\/script>` reads as `</script>` in the string and as nothing in the page
      expect(codeLiteral(value)).not.toMatch(/[<>\u2028\u2029]|(?<!\\)\//);
    }
  });

  it("keeps a Windows path's backslashes", () => {
    const literal = codeLiteral("C:\\app\\src\\x.tsx");
    expect(literal).toBe('"C:\\\\app\\\\src\\\\x.tsx"');
    expect(evaluated(literal)).toBe("C:\\app\\src\\x.tsx");
  });

  it("refuses a value JSON writes nothing for, which would leave a hole in the code", () => {
    expect(() => codeLiteral(undefined)).toThrow(TypeError);
    expect(() => codeLiteral(() => 1)).toThrow(TypeError);
    expect(() => codeLiteral(Symbol("x"))).toThrow(TypeError);
  });
});

describe("codeOfJson", () => {
  it("writes JSON text as code of the same value", () => {
    const json = JSON.stringify({ file: "</script>\u2028", at: "a/b" });
    expect(JSON.parse(json)).toEqual(evaluated(codeOfJson(json)));
    expect(codeOfJson(json)).toBe('{"file":"\\u003c\\/script\\u003e\\u2028","at":"a\\/b"}');
  });
});
