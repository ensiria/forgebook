/**
 * Tests for reading a sentence's code spans as CommonMark does.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { codeSpan, sentencePieces } from "../src/shell/codeSpans.ts";

describe("sentencePieces", () => {
  it("reads single-backtick spans as before", () => {
    expect(sentencePieces("Pass `href` or `onClick`.")).toEqual([
      { text: "Pass ", isCode: false },
      { text: "href", isCode: true },
      { text: " or ", isCode: false },
      { text: "onClick", isCode: true },
      { text: ".", isCode: false }
    ]);
  });

  it("closes a span only with a run of the same length, and leaves an unclosed run as text", () => {
    expect(sentencePieces("a ``x`y`` b")).toEqual([
      { text: "a ", isCode: false },
      { text: "x`y", isCode: true },
      { text: " b", isCode: false }
    ]);
    expect(sentencePieces("it costs `5")).toEqual([{ text: "it costs `5", isCode: false }]);
  });
});

describe("codeSpan", () => {
  it("writes any text as one span that reads back the same", () => {
    for (const text of ["plain", "`on-click`", "a``b", "`"]) {
      expect(sentencePieces(codeSpan(text))).toEqual([{ text, isCode: true }]);
    }
  });
});
