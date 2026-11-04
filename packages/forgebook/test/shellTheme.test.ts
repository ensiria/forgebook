/**
 * Tests for a catalogue's theme of the shell: the custom properties it writes, and the contrast it is held to. The
 * default palettes are held equal to the style sheets', so the two cannot drift.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DARK_PALETTE,
  frameThemeCss,
  LIGHT_PALETTE,
  mergedThemes,
  shellThemeCss,
  shellThemeProblems,
  themeValueProblem
} from "../src/shellTheme.ts";
import type { ShellTheme } from "../src/shellTheme.types.ts";

const TOKENS = readFileSync(join(import.meta.dirname, "..", "src", "styles", "_tokens.scss"), "utf8");

/** A palette of the style sheet, as written there. */
const sassPalette = (name: "light" | "dark"): Record<string, string> => {
  const block = new RegExp(`^\\$${name}: \\(([^)]*)\\);`, "m").exec(TOKENS)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^\s*([a-z-]+): (#[0-9a-f]+),?$/gm)].map((match) => [match[1], match[2]])
  );
};

describe("the default palettes", () => {
  it("are the style sheets', every role with the same value", () => {
    expect(LIGHT_PALETTE).toEqual(sassPalette("light"));
    expect(DARK_PALETTE).toEqual(sassPalette("dark"));
  });
});

describe("shellThemeCss", () => {
  it("writes nothing for no theme, so a catalogue with none pays nothing", () => {
    expect(shellThemeCss({})).toBe("");
  });

  it("scopes the light palette to its appearance, or a light colour would reach the dark one", () => {
    const css = shellThemeCss({ light: { accent: "#7036c4" } });
    expect(css).toContain(':root[data-forgebook-appearance="light"]{--forgebook-accent:#7036c4}');
    expect(css).toContain(
      "@media not (prefers-color-scheme:dark){:root:not([data-forgebook-appearance]){--forgebook-accent:#7036c4}}"
    );
    expect(css).not.toContain(":root{");
  });

  it("writes the dark palette for the appearance and for a dark system not yet told", () => {
    const css = shellThemeCss({ dark: { accent: "#c9a8ff" } });
    expect(css).toContain(':root[data-forgebook-appearance="dark"]{--forgebook-accent:#c9a8ff}');
    expect(css).toContain(
      "@media (prefers-color-scheme:dark){:root:not([data-forgebook-appearance]){--forgebook-accent:#c9a8ff}}"
    );
  });

  it("writes fonts and corners on the root, which hold in both appearances", () => {
    expect(
      shellThemeCss({
        fonts: { sans: "Inter, sans-serif", mono: "Menlo" },
        radius: { control: "2px", card: "4px" }
      })
    ).toBe(
      ":root{--forgebook-font-sans:Inter, sans-serif;--forgebook-font-mono:Menlo;" +
        "--forgebook-radius-control-small:2px;--forgebook-radius-control:2px;--forgebook-radius-card:4px}"
    );
  });
});

describe("frameThemeCss", () => {
  it("gives a frame only the failure box's fonts and colours, scoped to it", () => {
    const css = frameThemeCss({
      light: { "danger-text": "#a00", accent: "#123456" },
      dark: { "danger-text": "#faa" },
      fonts: { sans: "Inter" },
      radius: { card: "4px" }
    });
    expect(css).toBe(".forgebook-frame-error{--forgebook-font-sans:Inter;--forgebook-danger-text:#a00}");
  });

  it("is nothing for a theme that sets nothing the box reads", () => {
    expect(frameThemeCss({ light: { accent: "#123456" } })).toBe("");
  });
});

describe("mergedThemes", () => {
  it("merges role by role, the last winning", () => {
    const merged = mergedThemes([
      { light: { accent: "#111111", text: "#222222" }, radius: { card: "1px" } },
      { light: { accent: "#333333" } }
    ]);
    expect(merged.light).toEqual({ accent: "#333333", text: "#222222" });
    expect(merged.radius).toEqual({ card: "1px" });
  });
});

describe("themeValueProblem", () => {
  it("accepts what a theme writes", () => {
    expect(
      themeValueProblem({ light: { accent: "oklch(0.5 0.2 240)" }, fonts: { sans: '"Inter", serif' } })
    ).toBeUndefined();
  });

  it("checks each palette, so a clean dark value does not hide a broken light one", () => {
    const theme = { light: { accent: "red}</style><script>" }, dark: { accent: "#000000" } };
    expect(themeValueProblem(theme)).toContain("light.accent");
  });

  it.each(["rgb(0 0 0", '"oops', "red /*", "red\\\\", "red)", "red;color:blue"])("refuses %s", (value) => {
    expect(themeValueProblem({ dark: { text: value } })).toContain("dark.text");
  });
});

describe("shellThemeProblems", () => {
  it("has nothing against the shell's own palettes", () => {
    expect(
      shellThemeProblems({
        light: { window: LIGHT_PALETTE["window"] ?? "" },
        dark: { window: DARK_PALETTE["window"] ?? "" }
      })
    ).toEqual([]);
  });

  it("names a text colour that falls under 4.5:1 on a ground, with the pair and the ratio", () => {
    expect(shellThemeProblems({ light: { text: "#999999" } })[0]).toMatch(
      /^light: text on window is 2\.\d+:1, under 4\.5:1$/
    );
  });

  it("checks the theme's grounds against the default texts too", () => {
    const problems = shellThemeProblems({ dark: { window: "#ffffff" } });
    expect(problems.some((problem) => problem.startsWith("dark: text on window"))).toBe(true);
  });

  it("checks code on its own background, as the shell's tests do", () => {
    expect(shellThemeProblems({ light: { "code-keyword": "#ffff00" } })[0]).toContain(
      "code-keyword on fill-quiet"
    );
  });

  it("checks the accent at 3:1, since it draws the keyboard's focus", () => {
    expect(shellThemeProblems({ light: { accent: "#eeeeee" } }).join()).toContain("accent on window");
  });

  it("stacks a translucent surface on the window, or it would warn of what is fine", () => {
    const problems = shellThemeProblems({ dark: { surface: "#ffffff14", window: "#161618" } });
    expect(problems.filter((problem) => problem.includes(" on surface "))).toEqual([]);
  });

  it("names a role that does not exist, since nothing would read it", () => {
    const theme: ShellTheme = JSON.parse('{ "light": { "acent": "#000000" } }');
    expect(shellThemeProblems(theme)).toContain('light: "acent" is not a role of the shell\'s theme');
  });

  it("leaves out a colour it cannot read, rather than judge it", () => {
    expect(shellThemeProblems({ light: { text: "oklch(0.5 0.2 240)" } })).toEqual([]);
  });
});
