/**
 * Tests for checking what a change adds against the design system: what an agent's mistakes look like in a diff.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { addedLines, checkedCode, deletedTests, fileLines } from "../src/vite/checkCode.ts";
import type { DesignToken } from "../src/vite/designTokens.ts";

/** A token. */
const token = (name: string, type: string, value: string, deprecated?: string): DesignToken => ({
  name,
  type,
  value,
  modes: {},
  ...(deprecated === undefined ? {} : { deprecated })
});

const TOKENS = [
  token("color.ink", "color", "#1c1915"),
  token("color.old", "color", "#ff0000", "Gone."),
  token("space.small", "dimension", "8px"),
  token("space.large", "dimension", "1.5rem")
];

/** The problems of one added line in a file. */
const problems = (line: string, file = "src/Card.tsx"): readonly string[] =>
  checkedCode([{ file, line: 3, text: line }], TOKENS).map((each) => each.rule);

describe("addedLines", () => {
  it("reads the added lines of a diff, each with its file and its line in the new file", () => {
    const diff = [
      "diff --git a/src/a.tsx b/src/a.tsx",
      "--- a/src/a.tsx",
      "+++ b/src/a.tsx",
      "@@ -10,0 +11,2 @@ const x",
      "+  color: red;",
      "+  margin: 0;",
      "@@ -20 +22 @@",
      "-old",
      "+new"
    ].join("\n");
    expect(addedLines(diff)).toEqual([
      { file: "src/a.tsx", line: 11, text: "  color: red;" },
      { file: "src/a.tsx", line: 12, text: "  margin: 0;" },
      { file: "src/a.tsx", line: 22, text: "new" }
    ]);
  });
});

describe("raw values", () => {
  it("names a colour written by hand, with the nearest token", () => {
    const [problem] = checkedCode([{ file: "src/a.css", line: 1, text: "color: #1c1b1b;" }], TOKENS);
    expect(problem).toMatchObject({ rule: "raw-color", value: "#1c1b1b", fix: "color.ink" });
  });

  it("names a colour with no token close, with no fix to force", () => {
    const [problem] = checkedCode([{ file: "src/a.css", line: 1, text: "color: #00ff00;" }], TOKENS);
    expect(problem).toMatchObject({ rule: "raw-color" });
    expect(problem?.fix).toBeUndefined();
  });

  it("names a size that is a token's", () => {
    expect(checkedCode([{ file: "src/a.css", line: 1, text: "padding: 24px;" }], TOKENS)[0]).toMatchObject({
      rule: "raw-size",
      fix: "space.large"
    });
  });

  it("leaves a size that matches no token: most sizes are not the design system's", () => {
    expect(problems("width: 317px;", "src/a.css")).toEqual([]);
  });

  it("does not suggest a deprecated token", () => {
    expect(
      checkedCode([{ file: "src/a.css", line: 1, text: "color: #ff0000;" }], TOKENS)[0]?.fix
    ).toBeUndefined();
  });

  it("leaves the tokens files, stories and tests alone, where raw values belong", () => {
    expect(problems("color: #123456;", "tokens.json")).toEqual([]);
    expect(problems('args: { color: "#123456" }', "src/a.stories.tsx")).toEqual([]);
    expect(problems('expect(color).toBe("#123456");', "test/a.test.ts")).toEqual([]);
  });

  it("does not read a hash in a URL or a comment as a colour", () => {
    expect(problems('href="/page#abc123"')).toEqual([]);
    expect(problems("// see issue #123")).toEqual([]);
  });

  it("checks no value at all in a catalogue with no tokens", () => {
    expect(checkedCode([{ file: "src/a.css", line: 1, text: "color: #123456;" }], [])).toEqual([]);
  });
});

describe("what is not a raw value", () => {
  it.each([
    ["#feed .item {", "src/a.css"],
    ["#add-button:hover {", "src/a.css"],
    ['<a href="#add">', "src/a.tsx"],
    ["fill: url(#fade);", "src/a.css"],
    ["<p>Order #1042</p>", "src/a.tsx"],
    ["run(); // see #123", "src/a.tsx"],
    ["--brand: #123456;", "src/a.css"],
    ["$brand: #123456;", "src/a.scss"],
    ["@media (min-width: 24px) {", "src/a.css"]
  ])("leaves %s", (line, file) => {
    expect(checkedCode([{ file, line: 1, text: line }], TOKENS)).toEqual([]);
  });
});

describe("files", () => {
  it.each([
    "src/_tokens.scss",
    "src/tokens/color.ts",
    "src/design-tokens.css",
    "src/theme.css",
    "dist/a.css",
    "src/a.min.css",
    "src/__tests__/a.tsx",
    "e2e/a.tsx",
    "README.md"
  ])("reads no values in %s", (file) => {
    expect(checkedCode([{ file, line: 1, text: "color: #123456;" }], TOKENS)).toEqual([]);
  });

  it("reads Tailwind's brackets", () => {
    expect(
      checkedCode([{ file: "src/a.tsx", line: 1, text: 'className="bg-[#1c1b1b] p-[8px]"' }], TOKENS).map(
        (each) => each.rule
      )
    ).toEqual(["raw-color", "raw-size"]);
  });
});

describe("the fix", () => {
  it("is not offered when two tokens are the same size, since it cannot tell which is meant", () => {
    const both = [token("space.a", "dimension", "8px"), token("radius.a", "dimension", "8px")];
    const [problem] = checkedCode([{ file: "src/a.css", line: 1, text: "padding: 8px;" }], both);
    expect(problem?.fix).toBeUndefined();
    expect(problem?.message).toContain("space.a or radius.a");
  });

  it("is not a token whose base value differs: only a theme's matches", () => {
    const themed = [{ ...token("color.surface", "color", "#ffffff"), modes: { dark: "#1c1b1b" } }];
    expect(
      checkedCode([{ file: "src/a.css", line: 1, text: "color: #1c1b1b;" }], themed)[0]?.fix
    ).toBeUndefined();
  });
});

describe("suppressions", () => {
  it.each([
    "// @ts-ignore",
    "/* eslint-disable */",
    "// eslint-disable-next-line",
    "// biome-ignore lint/x:",
    "/* stylelint-disable */"
  ])("names %s", (line) => {
    expect(problems(line)).toEqual(["suppression"]);
  });

  it("leaves one that says why, which the repository's own rule allows", () => {
    expect(problems("// biome-ignore lint/x: the protocol names this field")).toEqual([]);
    expect(problems("// @ts-expect-error the library's types are wrong")).toEqual([]);
  });

  it("leaves a rule named in a sentence, in a string or in Markdown", () => {
    expect(problems('const hint = "Do not use @ts-ignore here";')).toEqual([]);
    expect(problems("// @ts-ignore", "README.md")).toEqual([]);
  });

  it("leaves tests and stories, where a type error is what is being tested", () => {
    expect(problems("// @ts-expect-error", "test/a.test.ts")).toEqual([]);
  });

  it("still reads the line's values", () => {
    expect(problems("color: #1c1915; /* biome-ignore x */", "src/a.css").toSorted()).toEqual([
      "raw-color",
      "suppression"
    ]);
  });
});

describe("deletedTests", () => {
  it("names a test file a change deletes, wherever it lives, and no other", () => {
    expect(
      deletedTests(["test/a.test.ts", "src/__tests__/b.ts", "src/c.ts"]).map((each) => each.file)
    ).toEqual(["test/a.test.ts", "src/__tests__/b.ts"]);
  });
});

describe("addedLines on what a diff can hold", () => {
  it("does not read an added line of `++ x` as a file", () => {
    const diff = ["+++ b/src/a.css", "@@ -0,0 +1,2 @@", "+++ y", "+color: red;"].join("\n");
    expect(addedLines(diff).map((each) => [each.file, each.line])).toEqual([
      ["src/a.css", 1],
      ["src/a.css", 2]
    ]);
  });

  it("counts no line for git's note about a missing newline", () => {
    const diff = ["+++ b/a.css", "@@ -1 +1 @@", "-old", "\\ No newline at end of file", "+new"].join("\n");
    expect(addedLines(diff)).toEqual([{ file: "a.css", line: 1, text: "new" }]);
  });

  it("takes off the tab git adds after a path with a space", () => {
    expect(addedLines(["+++ b/my file.css\t", "@@ -0,0 +1 @@", "+x"].join("\n"))[0]?.file).toBe(
      "my file.css"
    );
  });
});

describe("fileLines", () => {
  it("reads a new file as all added lines", () => {
    expect(fileLines("a.css", "one\ntwo")).toEqual([
      { file: "a.css", line: 1, text: "one" },
      { file: "a.css", line: 2, text: "two" }
    ]);
  });
});
