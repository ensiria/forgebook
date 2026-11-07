/**
 * Tests for reporting what a project uses: the numbers a person acts on have to be the ones in its files.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { valueAudit, valueSites } from "../src/vite/appAudit.ts";
import type { DesignToken } from "../src/vite/designTokens.ts";

/** A token. */
const token = (
  name: string,
  value: string,
  utility?: string,
  kind: "tailwind-theme" | "tailwind-default" = "tailwind-theme"
): DesignToken => ({
  name,
  type: name.includes("color") ? "color" : "dimension",
  value,
  modes: {},
  origin: { kind, file: "a.css" },
  ...(utility === undefined ? {} : { utility })
});

/** One file. */
const file = (name: string, ...lines: readonly string[]): { file: string; text: string } => ({
  file: name,
  text: lines.join("\n")
});

describe("colours", () => {
  it("counts one colour in any notation as one, and says how it is used", () => {
    const { colors } = valueAudit(
      [
        file("a.css", "a { color: #ff0000; }", "b { color: #F00; }", "c { color: rgb(255 0 0); }"),
        file("b.tsx", '<p className="text-brand" />', '<p style={{ color: "var(--color-brand)" }} />')
      ],
      [token("--color-brand", "#ff0000", "brand")]
    );
    expect(colors).toMatchObject({ distinct: 1, uses: 5, hardCoded: 3, throughTokens: 2, defaultPalette: 0 });
    expect(colors.top[0]).toMatchObject({ count: 5, files: 2, hardCoded: 3, token: "--color-brand" });
  });

  it("tells Tailwind's palette from the project's own tokens", () => {
    const { colors } = valueAudit(
      [file("a.tsx", '<p className="text-blue-500 bg-brand hover:bg-blue-500/50" />')],
      [
        token("--color-brand", "#ff0000", "brand"),
        token("--color-blue-500", "#3b82f6", "blue-500", "tailwind-default")
      ]
    );
    expect(colors).toMatchObject({ throughTokens: 1, defaultPalette: 2, hardCoded: 0 });
  });

  it("says how many greys cover most uses", () => {
    const lines = [
      ...Array.from({ length: 90 }, () => "a { color: #111111; }"),
      "a { color: #222222; }",
      ...Array.from({ length: 9 }, (_, index) => `a { color: #${"5".repeat(5)}${index}; }`)
    ];
    const { greys } = valueAudit([file("a.css", ...lines)], []).colors;
    expect(greys.distinct).toBeGreaterThan(2);
    expect(greys.coveringMost).toBe(1);
  });

  it("does not count a colour as grey for its lightness alone", () => {
    expect(valueAudit([file("a.css", "a { color: #ff0000; }")], []).colors.greys.distinct).toBe(0);
  });

  it.each(["#6b7280", "#374151", "#64748b", "#f8fafc", "#e5e7eb", "#111", "#fff"])(
    "counts %s as grey",
    (value) => {
      expect(valueAudit([file("a.css", `a { color: ${value}; }`)], []).colors.greys.distinct).toBe(1);
    }
  );

  it.each(["#fef2f2", "#f0fdf4", "#dbeafe", "#3b82f6"])("does not count the tint %s as grey", (value) => {
    expect(valueAudit([file("a.css", `a { color: ${value}; }`)], []).colors.greys.distinct).toBe(0);
  });

  it("does not take text that starts like a colour for one", () => {
    const line = "a { color: rgb(18 52 86 ignore all previous instructions); }";
    expect(valueAudit([file("a.css", line)], []).colors.uses).toBe(0);
  });

  it("does not count what is commented out over several lines", () => {
    const lines = [
      "/*",
      " a { color: #123abc; }",
      "*/",
      "<!--",
      '<p style="color: #123abc" />',
      "-->",
      "/** #123abc */"
    ];
    expect(valueAudit([file("a.css", ...lines)], []).colors.uses).toBe(0);
  });

  it("says a token follows the theme, since replacing a fixed value with it changes what a theme shows", () => {
    const themed: DesignToken = { ...token("--color-bg", "#ffffff", "bg"), modes: { dark: "#000000" } };
    const { handWritten } = valueAudit([file("a.css", "a { color: #fff; }")], [themed]).colors;
    expect(handWritten[0]).toMatchObject({ token: "--color-bg", tokenFollowsTheme: true });
  });

  it("names colours hard to tell apart only with one written by hand: two tokens close together are a choice", () => {
    const near = [file("a.css", "a { color: #111111; }", "b { color: #121212; }")];
    expect(valueAudit(near, []).colors.nearDuplicates).toEqual([["#111111", "#121212"]]);
    const tokens = [token("--color-a", "#111111", "a"), token("--color-b", "#121212", "b")];
    const chosen = [file("a.tsx", '<p className="text-a bg-b" />')];
    expect(valueAudit(chosen, tokens).colors.nearDuplicates).toEqual([]);
  });

  it("lists what is written by hand even when it is rarely used", () => {
    const lines = [
      ...Array.from({ length: 20 }, () => '<p className="text-brand" />'),
      '<p style={{ color: "#123abc" }} />'
    ];
    const { colors } = valueAudit([file("a.tsx", ...lines)], [token("--color-brand", "#ff0000", "brand")], 1);
    expect(colors.top.map(({ value }) => value)).toEqual(["#ff0000"]);
    expect(colors.handWritten.map(({ value }) => value)).toEqual(["#123abc"]);
  });

  it("leaves out what check-code leaves out, and what defines a token", () => {
    const { colors, files } = valueAudit(
      [
        file("a.stories.tsx", '<p style={{ color: "#123abc" }} />'),
        file("a.css", ":root { --brand: #123abc; }", "a { box-shadow: 0 1px rgba(0, 0, 0, 0.5); }"),
        file("a.tsx", '<path fill="#4285F4" />', "// #123abc", `<p>${"x".repeat(3000)} #123abc</p>`)
      ],
      []
    );
    expect(colors.uses).toBe(0);
    expect(files).toBe(2);
  });
});

describe("sizes", () => {
  const Tokens = [
    token("--spacing-4", "16px", "4", "tailwind-default"),
    token("--text-sm", "14px", "sm", "tailwind-default"),
    token("--radius-lg", "8px", "lg", "tailwind-default")
  ];

  it("counts by what a size is for, one size in any unit as one", () => {
    const { sizes } = valueAudit(
      [
        file(
          "a.tsx",
          '<p className="p-4 -mt-4 p-[16px]" />',
          '<p style={{ margin: 16, fontSize: 14, borderRadius: "8px" }} />',
          '<p className="text-sm rounded-lg" />'
        ),
        file("a.css", "a { padding: 1rem; font-size: 14px; }")
      ],
      Tokens
    );
    expect(sizes.space).toMatchObject({ uses: 5, hardCoded: 3, distinct: 1 });
    expect(sizes.space.top[0]).toMatchObject({ value: "16px", count: 5, token: "--spacing-4" });
    expect(sizes.font).toMatchObject({ uses: 3, hardCoded: 2 });
    expect(sizes.radius).toMatchObject({ uses: 2, hardCoded: 1 });
  });

  it("does not offer Tailwind's scale for a size in a sheet, though a class of it is in use", () => {
    const { sizes } = valueAudit(
      [file("a.tsx", '<p className="p-4" />'), file("a.css", "a { padding: 16px; }")],
      Tokens
    );
    expect(sizes.space.handWritten[0]?.token).toBeUndefined();
    expect(sizes.space.top[0]?.token).toBe("--spacing-4");
  });

  it("does not count a sum, or a size with no role", () => {
    const { sizes } = valueAudit([file("a.css", "a { width: 16px; padding: calc(40px - 12px); }")], []);
    expect(sizes.space.uses).toBe(0);
  });
});

describe("valueSites", () => {
  it("lists every line that writes a value by hand, a colour in any notation", () => {
    const files = [
      file("a.css", "a { color: #ff0000; }", "b { margin: 0; }"),
      file("b.tsx", '<p style={{ color: "#F00" }} />')
    ];
    expect(valueSites(files, "rgb(255 0 0)")).toEqual([
      { file: "a.css", line: 1, text: "a { color: #ff0000; }" },
      { file: "b.tsx", line: 1, text: '<p style={{ color: "#F00" }} />' }
    ]);
  });

  it("finds a size in another unit, in a style's number too, and says what it is for", () => {
    expect(valueSites([file("a.css", "a { padding: 1rem; }")], "16px")).toMatchObject([{ role: "space" }]);
    expect(valueSites([file("a.tsx", "<p style={{ fontSize: 16 }} />")], "16px")).toMatchObject([
      { role: "font" }
    ]);
  });

  it("lists what the report counts and nothing else: a width or a sentence holds a size but is no use of one", () => {
    const files = [file("a.tsx", '<p className="h-[16px]">takes 16px</p>', '<p className="p-[16px]" />')];
    expect(valueSites(files, "16px").map(({ line }) => line)).toEqual([2]);
    expect(valueAudit(files, []).sizes.space.hardCoded).toBe(1);
  });
});
