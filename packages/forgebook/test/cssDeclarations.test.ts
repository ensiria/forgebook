/**
 * Tests for reading custom properties out of a sheet: where each stands decides whether it is a token at all.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { readCssText } from "../src/vite/cssDeclarations.ts";

/** Where a declaration in a sheet stands. */
const placeOf = (sheet: string, name = "--a"): unknown =>
  readCssText(sheet).declarations.find((each) => each.name === name)?.place;

describe("readCssText", () => {
  it("gives each declaration its name, value and line", () => {
    const { declarations } = readCssText(":root {\n  --a: 1px;\n\n  --b:  oklch(0 0 0)  !important;\n}\n");
    expect(declarations).toEqual([
      { name: "--a", value: "1px", line: 2, place: { kind: "root" } },
      { name: "--b", value: "oklch(0 0 0)", line: 4, place: { kind: "root" } }
    ]);
  });

  it.each([
    [":root { --a: 1 }", { kind: "root" }],
    ["html { --a: 1 }", { kind: "root" }],
    [":root, :host { --a: 1 }", { kind: "root" }],
    [":root, .light { --a: 1 }", { kind: "root" }],
    ["@layer base { :root { --a: 1 } }", { kind: "root" }],
    ["@theme { --a: 1 }", { kind: "theme" }],
    ["@theme inline { --a: 1 }", { kind: "theme" }],
    [".dark { --a: 1 }", { kind: "mode", mode: "dark" }],
    ["html.dark { --a: 1 }", { kind: "mode", mode: "dark" }],
    [".theme--dark { --a: 1 }", { kind: "mode", mode: "dark" }],
    [".tl-theme__light { --a: 1 }", { kind: "mode", mode: "light" }],
    ["[data-theme='dark'] { --a: 1 }", { kind: "mode", mode: "dark" }],
    ["[data-theme=ocean] { --a: 1 }", { kind: "mode", mode: "ocean" }],
    [":root:not(.dark) { --a: 1 }", { kind: "mode", mode: "light" }],
    [":root:not(.light) { --a: 1 }", { kind: "mode", mode: "dark" }],
    ["@media (prefers-color-scheme: dark) { :root:not(.light) { --a: 1 } }", { kind: "mode", mode: "dark" }],
    [":where(.dark) { --a: 1 }", { kind: "mode", mode: "dark" }],
    [".app.dark { --a: 1 }", { kind: "selector", selector: ".app", mode: "dark" }],
    [".app { &.theme--dark { --a: 1 } }", { kind: "selector", selector: ".app", mode: "dark" }],
    [".dark { .card { --a: 1 } }", { kind: "selector", selector: ".card", mode: "dark" }],
    [
      "@media (prefers-color-scheme: dark) { .card { --a: 1 } }",
      { kind: "selector", selector: ".card", mode: "dark" }
    ],
    ["@media (prefers-color-scheme: dark) { :root { --a: 1 } }", { kind: "mode", mode: "dark" }],
    ["@theme { @variant dark { --a: 1 } }", { kind: "mode", mode: "dark" }],
    [".card { --a: 1 }", { kind: "selector", selector: ".card" }],
    // a button's variant is not a theme, though its name ends like one
    [".btn-light { --a: 1 }", { kind: "selector", selector: ".btn-light" }],
    // a card's variables in a theme are still that card's
    [".dark .card { --a: 1 }", { kind: "selector", selector: ".dark .card" }],
    ["@media (min-width: 1px) { :root { --a: 1 } }", { kind: "conditional" }],
    ["@keyframes x { from { --a: 1 } }", { kind: "conditional" }]
  ])("reads %s", (sheet, place) => {
    expect(placeOf(sheet)).toEqual(place);
  });

  it("is not misled by what is not a declaration", () => {
    const sheet = [
      "/* :root { --a: 1 } */",
      "// :root { --b: 1 }",
      '.x { background: url("//cdn/a;b.png"); content: "--c: 1; }"; }',
      ":root { --d: url(https://x/y;z); --e: #{$sass}; --f: { a: b }; }"
    ].join("\n");
    expect(readCssText(sheet).declarations.map(({ name }) => name)).toEqual(["--d", "--e", "--f"]);
  });

  it("ends at a comment or a string left open, rather than hang", () => {
    expect(readCssText(":root { --a: 1; } /* never closed").declarations).toHaveLength(1);
    expect(readCssText(':root { --a: 1; } .x { content: "never').declarations).toHaveLength(1);
    expect(readCssText(":root { --a: 1").declarations).toHaveLength(1);
  });

  it("is not misled by a bracket in a comment inside a Sass map", () => {
    const sheet = "$m: (\n  // a ( b\n  a: 1\n);\n:root { --a: 1; }\n";
    expect(readCssText(sheet).declarations.map(({ name }) => name)).toEqual(["--a"]);
  });

  it("reads Less's options and Sass's other ways of importing", () => {
    expect(readCssText('@import (reference) "v.less";\n@use "vars";\n@forward "x" show a;').imports).toEqual([
      "v.less",
      "vars",
      "x"
    ]);
  });

  it("keeps a value's lines together and its first line's number", () => {
    const { declarations } = readCssText(":root {\n  --shadow:\n    0 1px #000,\n    0 2px #111;\n}\n");
    expect(declarations[0]).toMatchObject({ value: "0 1px #000, 0 2px #111", line: 2 });
  });

  it("finds the statements that lead elsewhere", () => {
    const sheet = [
      '@import "tailwindcss" theme(static);',
      '@import url("./a.css");',
      '@config "../tailwind.config.js";',
      '@plugin "@acme/plugin";'
    ].join("\n");
    expect(readCssText(sheet)).toMatchObject({
      imports: ["tailwindcss", "./a.css"],
      configs: ["../tailwind.config.js"],
      plugins: ["@acme/plugin"],
      importsTailwindTheme: true,
      usesTailwindDirectives: false
    });
    expect(readCssText("@tailwind base;")).toMatchObject({
      importsTailwindTheme: false,
      usesTailwindDirectives: true
    });
  });
});
