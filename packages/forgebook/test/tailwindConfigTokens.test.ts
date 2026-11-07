/**
 * Tests for reading a Tailwind configuration from its text: what is plain is read, what is not is said, none of it run.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { readTailwindConfig, readTailwindPalette } from "../src/vite/tailwindConfigTokens.ts";

describe("readTailwindConfig", () => {
  it("names theme keys as Tailwind 4 does, through DEFAULT and nesting", () => {
    const { tokens, unread } = readTailwindConfig(
      "tailwind.config.ts",
      `import type { Config } from "tailwindcss";
       const config: Config = {
         theme: {
           extend: {
             colors: {
               border: "hsl(var(--border))",
               primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" }
             },
             borderRadius: { lg: "var(--radius)" },
             fontSize: { xs: ["0.75rem", { lineHeight: "1rem" }] },
             fontFamily: { sans: ["Inter", "system-ui"] },
             screens: { md: "48rem" },
             zIndex: { 9: "9" }
           }
         }
       };
       export default config;`
    );
    expect(tokens).toEqual([
      { name: "--color-border", value: "hsl(var(--border))", type: "color" },
      { name: "--color-primary", value: "hsl(var(--primary))", type: "color" },
      { name: "--color-primary-foreground", value: "hsl(var(--primary-foreground))", type: "color" },
      { name: "--radius-lg", value: "var(--radius)", type: "dimension" },
      { name: "--text-xs", value: "0.75rem", type: "dimension" },
      { name: "--font-sans", value: "Inter, system-ui", type: "fontFamily" },
      { name: "--breakpoint-md", value: "48rem", type: "breakpoint" }
    ]);
    expect(unread).toEqual([]);
  });

  it.each([
    ["module.exports", 'module.exports = { theme: { colors: { a: "#000" } } };'],
    ["a helper's call", 'export default defineConfig({ theme: { colors: { a: "#000" } } });'],
    ["satisfies", 'export default { theme: { colors: { a: "#000" } } } satisfies Config;'],
    ["a constant of the file", 'const c = { a: "#000" };\nexport default { theme: { colors: c } };']
  ])("reads %s", (_, text) => {
    expect(readTailwindConfig("tailwind.config.ts", text).tokens).toEqual([
      { name: "--color-a", value: "#000", type: "color" }
    ]);
  });

  it("says what needs running, and keeps the rest", () => {
    const { tokens, unread } = readTailwindConfig(
      "tailwind.config.js",
      `const shared = require("./shared");
       module.exports = { theme: { extend: { colors: { ...shared, a: "#000", b: make() }, spacing: fn } } };`
    );
    expect(tokens).toEqual([{ name: "--color-a", value: "#000", type: "color" }]);
    expect(unread).toEqual([
      "theme.extend.colors: a part is built by code",
      "theme.extend.colors.b: built by code",
      "theme.extend.spacing: built by code"
    ]);
  });

  it("says a file it cannot read, rather than give nothing in silence", () => {
    expect(readTailwindConfig("a.js", "export default ;").unread[0]).toContain("cannot be parsed");
    expect(readTailwindConfig("a.js", "export default make();").unread).toEqual([
      "what it exports is built by code"
    ]);
  });

  it("names presets to follow, by require and by import", () => {
    expect(
      readTailwindConfig("a.js", 'module.exports = { presets: [require("@acme/preset")] };').presets
    ).toEqual(["@acme/preset"]);
    expect(
      readTailwindConfig("a.ts", 'import p from "./preset";\nexport default { presets: [p] };').presets
    ).toEqual(["./preset"]);
  });

  it("tells a key the theme replaces from one it extends", () => {
    const { replaced } = readTailwindConfig(
      "a.js",
      'export default { theme: { colors: { a: "#000" }, extend: { spacing: { b: "1px" } } } };'
    );
    expect(replaced).toEqual(["colors"]);
  });

  it("does not take a colour of the default palette for one it can read, and names it", () => {
    const { tokens, paletteAliases } = readTailwindConfig(
      "a.js",
      'const colors = require("tailwindcss/colors");\nmodule.exports = { theme: { extend: { colors: { brand: colors.blue } } } };'
    );
    expect(tokens).toEqual([]);
    expect(paletteAliases).toEqual([{ name: "--color-brand", palette: "blue" }]);
  });
});

describe("readTailwindPalette", () => {
  it("reads the published palette's object of strings", () => {
    const text = `var _default = { inherit: "inherit", white: "#fff", blue: { 500: "#3b82f6" } };\nexports.default = _default;`;
    expect(readTailwindPalette("colors.js", text)).toEqual([
      { name: "--color-white", value: "#fff", type: "color" },
      { name: "--color-blue-500", value: "#3b82f6", type: "color" }
    ]);
  });
});
