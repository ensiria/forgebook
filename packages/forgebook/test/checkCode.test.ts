/**
 * Tests for checking what a change adds against the design system: what an agent's mistakes look like in a diff.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { addedLines, checkedCode, deletedTests, excusedValues, fileLines } from "../src/vite/checkCode.ts";
import type { DesignToken, TokenOriginKind } from "../src/vite/designTokens.ts";

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

describe("tokens read from an application", () => {
  /** A token as the application declares it. */
  const declared = (name: string, type: string, value: string, kind: TokenOriginKind): DesignToken => ({
    name,
    type,
    value,
    modes: {},
    origin: { kind, file: "a.css" }
  });
  const App = [
    declared("--color-card", "color", "#ffffff", "tailwind-theme"),
    declared("--color-popover", "color", "#ffffff", "tailwind-theme"),
    declared("--color-ink", "color", "#111111", "tailwind-theme"),
    { ...declared("--color-brand", "color", "#ff0033", "tailwind-theme"), utility: "brand" },
    declared("--space-2", "dimension", "8px", "css-variables"),
    declared("--radius-lg", "dimension", "12px", "css-variables"),
    declared("--text-sm", "dimension", "14px", "css-variables"),
    declared("--sidebar-padding", "dimension", "16px", "css-variables"),
    { ...declared("--spacing-4", "dimension", "16px", "tailwind-default"), utility: "4" },
    { ...declared("--spacing-2", "dimension", "8px", "tailwind-default"), utility: "2" }
  ];
  /** The values found in one line. */
  const found = (text: string, file = "src/Card.tsx"): readonly (string | undefined)[] =>
    checkedCode([{ file, line: 3, text }], App).map((each) => each.fix ?? each.value);

  it("names a raw colour, and how a class writes the token", () => {
    const [problem] = checkedCode([{ file: "src/a.css", line: 1, text: "color: #ff0033;" }], App);
    expect(problem).toMatchObject({ rule: "raw-color", fix: "--color-brand" });
    expect(problem?.message).toContain("-brand in a class");
  });

  it("gives no fix when two tokens hold the value, since which one depends on its use", () => {
    const [problem] = checkedCode([{ file: "src/a.css", line: 1, text: "color: #fff;" }], App);
    expect(problem?.fix).toBeUndefined();
    expect(problem?.message).toContain("--color-card or --color-popover");
  });

  it.each([
    ["a size of its role", "padding: 8px;", ["--space-2"]],
    ["a radius", "border-radius: 12px;", ["--radius-lg"]],
    ["a font's size", "font-size: 14px;", ["--text-sm"]],
    ["a class's brackets", '<p className="p-[16px]" />', ["--spacing-4"]],
    ["a negative offset", '<p className="top-[-16px]" />', ["--spacing-4"]]
  ])("names %s", (_, line, expected) => {
    expect(found(line)).toEqual(expected);
  });

  it.each([
    ["a size of another role", "width: 8px;"],
    ["a token that is one place's value", "margin: 16px;"],
    ["Tailwind's scale outside a class", "padding: 16px;"],
    ["a sum in a class", '<p className="h-[calc(100%-16px)]" />'],
    ["a sum in a sheet", "padding: calc(40px - 8px);"]
  ])("leaves alone %s", (_, line) => {
    expect(found(line)).toEqual([]);
  });

  it.each([
    ["a logo's shape", '<path fill="#4285F4" d="M0 0" />'],
    ["a shape's attribute on its own line", '  fill="#4285F4"'],
    ["a gradient's stop", '<stop stopColor="#CDCDCD" />'],
    ["a mask", 'className="mask-[linear-gradient(0deg,#123456,#654321)]"'],
    ["a canvas", "ctx.fillStyle = '#123456'"],
    ["the browser's theme colour", 'const LIGHT_THEME_COLOR = "#123456";'],
    ["the page's head", '<meta name="x" content="#123456" />'],
    ["a fallback, the token being used", "color: var(--danger, #123456);"],
    ["a gradient's transparent end", "background: linear-gradient(rgba(1, 2, 3, 0), red);"],
    ["black in a shadow", "box-shadow: 0 1px rgba(0, 0, 0, 0.5);"],
    ["a Vue slot's name", "<template #add>"],
    ["a custom property's fallback in a script", `up: root.getPropertyValue("--bs-primary") || "#5cdd8b",`],
    ["a table of a palette's steps", '  "500": "oklch(0.7 0.1 200)",'],
    ["a contrast picked for a user's colour", 'color: isDark(c) ? "#fff" : "#000",'],
    ["a style object's mask", "WebkitMask: 'radial-gradient(rgba(1, 2, 3, 1) 0%)',"]
  ])("leaves alone %s", (_, line) => {
    expect(found(line)).toEqual([]);
  });

  it("still names a shape outside a drawing, and a colour in a shadow", () => {
    expect(found('<Bar fill="#123456" />')).toEqual(["#123456"]);
    expect(found("box-shadow: 0 1px #12345a;")).toEqual(["#12345a"]);
  });

  it("gives no fix when two tokens hold the value in any notation, and names a colour only a theme has", () => {
    const oklch = [
      declared("--card", "color", "oklch(1 0 0)", "css-variables"),
      declared("--popover", "color", "oklch(1 0 0)", "css-variables")
    ];
    const [problem] = checkedCode([{ file: "a.css", line: 1, text: "color: #ffffff;" }], oklch);
    expect(problem?.fix).toBeUndefined();
    const themed: DesignToken = {
      ...declared("--ink", "color", "#111111", "css-variables"),
      isThemeOnly: true,
      modes: { dark: "#123456" }
    };
    const [only] = checkedCode([{ file: "a.css", line: 1, text: "color: #123456;" }], [themed]);
    expect(only?.message).toContain("--ink is #123456 in the dark theme");
    expect(only?.fix).toBeUndefined();
  });

  it("does not take a class's double dash or a bracketed variable for a declaration", () => {
    expect(found(".btn--primary:hover { color: #ff0000 }", "src/a.css")).toHaveLength(1);
    expect(found('className="[--w:16px] bg-[#ff0000]"')).toHaveLength(1);
    expect(found('className="mask-image bg-[#ff0000]"')).toHaveLength(1);
  });

  it("reads the rest of a line with a contrast pick, and takes a theme's pair for what it is", () => {
    expect(found('a: c ? "#fff" : "#000", b: "#12345a",')).toEqual(["#12345a"]);
    expect(found('color: theme === "dark" ? "#fff" : "#000",').length).toBeGreaterThan(0);
  });

  it("leaves alone a line inside a block comment, and a selector with quotes", () => {
    expect(found(" * color: #12345a;")).toEqual([]);
    expect(found('a[data-x="y"] #bad {', "src/a.css")).toEqual([]);
    expect(found("maskImage: 'linear-gradient(#12345a, #abcdef)',")).toEqual([]);
  });

  it("reads a colour on an object's line, which ends in a comma as a selector does", () => {
    expect(found('    color: "#12345a",')).toEqual(["#12345a"]);
    expect(found(".a #bcd,", "src/a.css")).toEqual([]);
  });

  it("leaves alone a sheet's one-line declarations", () => {
    expect(found(":root { --a: #12345a; --b: 8px; }", "src/a.css")).toEqual([]);
  });

  it("leaves alone a value's next line in a sheet, usually a token's", () => {
    expect(found("    0 1px 2px #123456,", "src/a.css")).toEqual([]);
  });

  it.each(["src/emails/Welcome.tsx", "src/app/og/route.tsx", "src/share.opengraph.tsx"])(
    "leaves alone %s, where a page's variables do not reach",
    (file) => {
      expect(found('<p style={{ color: "#123456" }} />', file)).toEqual([]);
    }
  );

  it("takes a value that is meant, on its line or the one above, with its reason", () => {
    expect(found('color: "#123456"; // forgebook-ignore raw-color: a tag\'s default')).toEqual([]);
    expect(
      checkedCode(
        [
          { file: "a.css", line: 1, text: "/* forgebook-ignore raw-color: the brand's own */" },
          { file: "a.css", line: 2, text: "color: #123456;" }
        ],
        App
      )
    ).toEqual([]);
  });

  it("lists every excuse with its reason, and takes it only from a comment", () => {
    expect(found('<p data-x="/ forgebook-ignore raw-color: why" style={{ color: "#12345a" }} />')).toEqual([
      "#12345a"
    ]);
    expect(
      excusedValues([
        { file: "a.css", line: 2, text: "color: #123456; /* forgebook-ignore raw-color: the brand */" }
      ])
    ).toEqual([{ file: "a.css", line: 2, rule: "raw-color", reason: "the brand" }]);
  });

  it("stays quick on a long line of what its patterns read", () => {
    const line = `${"a-".repeat(900)}: ${"padding ".repeat(20)} 8px`;
    const started = performance.now();
    for (let count = 0; count < 200; count += 1) found(line);
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("does not take it with no reason, or for another rule, or from a line further up", () => {
    expect(found('color: "#123456"; // forgebook-ignore raw-color')).toEqual(["#123456"]);
    expect(found('color: "#123456"; // forgebook-ignore raw-size: why')).toEqual(["#123456"]);
    expect(
      checkedCode(
        [
          { file: "a.css", line: 1, text: "/* forgebook-ignore raw-color: why */" },
          { file: "a.css", line: 5, text: "color: #123456;" }
        ],
        App
      )
    ).toHaveLength(1);
  });

  it("does not compare colours with no colour tokens", () => {
    expect(checkedCode([{ file: "a.css", line: 1, text: "color: #123456;" }], [])).toEqual([]);
    const sizes = App.filter((each) => each.type !== "color");
    expect(checkedCode([{ file: "a.css", line: 1, text: "color: #123456;" }], sizes)).toEqual([]);
  });
});
