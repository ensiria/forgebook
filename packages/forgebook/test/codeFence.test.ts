/**
 * Tests for a code fence's whole line read, and its code drawn by it: a title, marked, inserted and deleted lines, a
 * diff, wrapping, and what the copy button copies.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type FenceInfo, fencedCode, fenceInfo, htmlLines, missingLine } from "../src/vite/codeFence.ts";
import { noteText, type PageNote } from "../src/vite/docDirectives.ts";

/** A fence's line read from column 4 of line 1, with its notes as a person reads them. */
const infoOf = (info: string): { readonly read: FenceInfo; readonly notes: string[] } => {
  const notes: PageNote[] = [];
  const read = fenceInfo(info, { line: 1, column: 4 }, notes);
  return { read, notes: notes.map(noteText) };
};

describe("fenceInfo", () => {
  it("reads the language, a quoted title, marked lines, inserted and deleted lines, and wrap", () => {
    const { read, notes } = infoOf('tsx title="Save button.tsx" {1,4-6} ins={2} del={3} wrap');
    expect(read).toMatchObject({ language: "tsx", title: "Save button.tsx", isDiff: false, isWrapped: true });
    expect([...read.marked]).toEqual([1, 4, 5, 6]);
    expect([...read.inserted]).toEqual([2]);
    expect([...read.deleted]).toEqual([3]);
    expect(notes).toEqual([]);
  });

  it("colours a diff in the language its lang names", () => {
    expect(infoOf('diff lang="tsx"').read).toMatchObject({ language: "tsx", isDiff: true });
    expect(infoOf("diff").read).toMatchObject({ language: undefined, isDiff: true });
  });

  it("notes each word it does not read, at its column, and keeps the rest", () => {
    const { read, notes } = infoOf('ts file=a.ts {x} lang="tsx" title="T"');
    expect(read.title).toBe("T");
    expect(notes).toEqual([
      'line 1, column 7: the code fence\'s "file=a.ts" is not read: it reads title="…", {1,4-6}, ins={…}, del={…} and wrap',
      'line 1, column 17: "{x}" is not a list of lines: write {1,4-6}',
      'line 1, column 21: the code fence\'s "lang="tsx"" is not read: `lang` goes with a diff (```diff lang="tsx")'
    ]);
  });
});

describe("htmlLines", () => {
  it("closes every span at a line's end and opens it again on the next", () => {
    expect(htmlLines('<span class="a">one\ntwo</span>\nthree')).toEqual([
      '<span class="a">one</span>',
      '<span class="a">two</span>',
      "three"
    ]);
  });
});

describe("fencedCode", () => {
  it("leaves code without marks as it was coloured", () => {
    const drawn = fencedCode("const a = 1;", infoOf("ts").read);
    expect(drawn.html).not.toContain("forgebook-code-line");
    expect(drawn.text).toBe("const a = 1;");
  });

  it("makes each line an element of its kind, and copies the code without its deleted lines", () => {
    const drawn = fencedCode("one\ntwo\nthree\nfour", infoOf("txt {1} ins={2} del={3}").read);
    expect(drawn.html.split("\n")).toEqual([
      '<mark class="forgebook-code-line">one</mark>',
      '<ins class="forgebook-code-line">two</ins>',
      '<del class="forgebook-code-line">three</del>',
      '<span class="forgebook-code-line">four</span>'
    ]);
    expect(drawn.text).toBe("one\ntwo\nfour");
  });

  it("reads a diff's signs, colours the rest in its language, and copies the code after the change", () => {
    const drawn = fencedCode(" const a = 1;\n-const b = 2;\n+const b = 3;", infoOf('diff lang="ts"').read);
    expect(drawn.html).toContain(
      '<del class="forgebook-code-line"><span class="forgebook-hl-keyword">const</span>'
    );
    expect(drawn.html).toContain('<ins class="forgebook-code-line">');
    expect(drawn.text).toBe("const a = 1;\nconst b = 3;");
  });
});

describe("missingLine", () => {
  it("names the first line a fence marks that its code does not have", () => {
    expect(missingLine("one\ntwo", infoOf("txt {1,5} ins={3}").read)).toEqual({ line: 3, count: 2 });
    expect(missingLine("one\ntwo", infoOf("txt {2}").read)).toBeUndefined();
  });
});
