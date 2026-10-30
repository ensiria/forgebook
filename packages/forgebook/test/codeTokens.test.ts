/**
 * Tests for the code tokens of signatures and calls.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { codeTokens } from "../src/shell/codeTokens";

/** Tokens as `kind:text`, spaces left out. */
const kinds = (text: string, names: readonly string[] = []): string[] =>
  codeTokens(text, new Set(names))
    .filter((token) => token.kind !== "space")
    .map((token) => `${token.kind}:${token.text}`);

describe("codeTokens", () => {
  it("colours a signature's parameters, keywords, types and punctuation", () => {
    expect(kinds("(option: SelectOption, isOpen: boolean) => void", ["option", "isOpen"])).toEqual([
      "punctuation:(",
      "name:option",
      "punctuation::",
      "type:SelectOption",
      "punctuation:,",
      "name:isOpen",
      "punctuation::",
      "keyword:boolean",
      "punctuation:)",
      "punctuation:=>",
      "keyword:void"
    ]);
  });

  it("colours a call's strings and numbers", () => {
    expect(kinds('onValueChange("mon\\"thly", 3)', ["onValueChange"])).toEqual([
      "name:onValueChange",
      "punctuation:(",
      'string:"mon\\"thly"',
      "punctuation:,",
      "number:3",
      "punctuation:)"
    ]);
  });

  it("keeps every character, spaces included", () => {
    const text = "(value: string) => void";
    expect(
      codeTokens(text)
        .map((token) => token.text)
        .join("")
    ).toBe(text);
  });
});
