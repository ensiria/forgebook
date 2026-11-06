/**
 * Tests for what `check-markdown-blocks` finds: unbalanced fences, samples that do not parse and links to a heading
 * lost inside a block, and what it leaves alone.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { headingAnchor, markdownParts, markdownProblems } from "./markdownBlocks.ts";

/** The lines of a text's problems. */
const linesOf = (text: string): readonly number[] => markdownProblems(text).map((problem) => problem.line);

describe("markdownParts", () => {
  it("reads a block's language, line and body, and the prose around it", () => {
    const { blocks, prose } = markdownParts('before\n\n```TS title="a"\nconst a = 1;\n```\nafter\n');
    expect(blocks).toEqual([
      { language: "ts", line: 3, body: ["const a = 1;"], isClosed: true, openersInside: [] }
    ]);
    expect(prose.map((each) => each.text)).toEqual(["before", "", "after", ""]);
  });

  it("takes a fence indented in a list off its body", () => {
    const { blocks } = markdownParts("- item\n\n  ```yaml\n  a: 1\n  ```\n");
    expect(blocks[0]?.body).toEqual(["a: 1"]);
  });

  it("reads a line of inline code as prose", () => {
    expect(markdownParts("```a``` and more\n").blocks).toEqual([]);
  });
});

describe("markdownProblems", () => {
  it("leaves balanced fences alone", () => {
    expect(markdownProblems("```sh\nls\n```\n\n~~~\n```\n~~~\n")).toEqual([]);
  });

  it("fails on a fence that is never closed", () => {
    expect(markdownProblems("text\n\n```sh\nls\n")).toEqual([
      { line: 3, message: expect.stringContaining("never closed") }
    ]);
  });

  it("fails on a fence that opens inside a block of its length, a lost closing fence", () => {
    expect(linesOf("```yaml\na: 1\n\nprose\n\n```ts\nconst a = 1;\n```\n")).toEqual([6]);
  });

  it("lets a longer fence show shorter ones, and reads them", () => {
    expect(markdownProblems("````md\n```ts\na\n```\n````\n")).toEqual([]);
    expect(linesOf("text\n\n````md\n```ts\na\n````\n")).toEqual([3 + 1]);
  });

  it("finds what a Markdown sample's own samples break, at the file's line", () => {
    expect(linesOf("````md\n\n```yaml\na: [\n```\n````\n")).not.toEqual([]);
  });

  it("fails on YAML that does not parse, inside the block", () => {
    const workflow = "```yaml\nsteps:\n  - uses: a@v4\n      name: b\n```\n";
    const [problem] = markdownProblems(workflow);
    expect(problem?.line).toBeGreaterThan(1);
    expect(problem?.message).toContain("invalid YAML");
    expect(markdownProblems("```yml\nsteps:\n  - uses: a@v4\n    with:\n      name: b\n```\n")).toEqual([]);
  });

  it("reads every document of a YAML sample", () => {
    expect(markdownProblems("```yaml\na: 1\n---\nb: 2\n```\n")).toEqual([]);
    expect(markdownProblems("```yaml\na: 1\n---\nb: [\n```\n")).not.toEqual([]);
  });

  it("follows CommonMark on a fence's indentation", () => {
    expect(markdownProblems("```\n    ```\nstill code\n```\n")).toEqual([]);
    expect(linesOf("```\ncode\n    ```\n")).toEqual([1]);
    expect(markdownProblems("    ```\n\ntext\n")).toEqual([]);
    expect(linesOf("1. item\n\n   ```sh\n   ls\n")).toEqual([3]);
  });

  it("reads a file with Windows line ends", () => {
    expect(linesOf("```yaml\r\na: 1\r\n")).toEqual([1]);
    expect(markdownProblems("```sh\r\nls\r\n```\r\n")).toEqual([]);
  });

  it("fails on JSON that does not parse", () => {
    expect(markdownProblems('```json\n{ "a": 1 }\n```\n')).toEqual([]);
    expect(linesOf('text\n```json\n{ "a": }\n```\n')).toEqual([2]);
  });

  it("does not parse a block whose fence is the problem", () => {
    expect(markdownProblems("```yaml\na: [\n")).toHaveLength(1);
  });

  it("fails on a link to a heading that sits inside a block", () => {
    const text = "See [search](#search).\n\n````md\n## Search\n````\n";
    expect(markdownProblems(text)).toEqual([{ line: 1, message: expect.stringContaining("#search") }]);
    expect(markdownProblems("See [search](#search).\n\n## Search\n")).toEqual([]);
  });

  it("reports a link whose anchor is not valid percent-encoding, rather than stop", () => {
    expect(linesOf("[a](#100%)\n")).toEqual([1]);
  });

  it("numbers a repeated heading as GitHub does", () => {
    expect(markdownProblems("[a](#usage-1)\n\n## Usage\n\n## Usage\n")).toEqual([]);
    expect(linesOf("[a](#usage-2)\n\n## Usage\n\n## Usage\n")).toEqual([1]);
  });

  it("leaves a link written as inline code, and another page's anchor, alone", () => {
    expect(markdownProblems("`[a](#nothing)` and [b](./other.md#nothing)\n")).toEqual([]);
  });
});

describe("headingAnchor", () => {
  it("makes an anchor as GitHub does", () => {
    expect(headingAnchor("A preview for every pull request")).toBe("a-preview-for-every-pull-request");
    expect(headingAnchor("`forgebook guide`, on demand!")).toBe("forgebook-guide-on-demand");
    expect(headingAnchor("[Design](https://example.com) links")).toBe("design-links");
  });
});
