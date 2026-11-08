/**
 * Tests for sizes a style object writes as bare numbers, which React reads as pixels: a failure where the line says the
 * object is a style, advice where the same key may be an option.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { codeFindings } from "../src/vite/checkCode.ts";
import type { DesignToken, TokenOriginKind } from "../src/vite/designTokens.ts";

/** A token of a tokens file. */
const named = (name: string, value: string): DesignToken => ({ name, type: "dimension", value, modes: {} });

/** A token as an application declares it. */
const declared = (name: string, value: string, kind: TokenOriginKind = "css-variables"): DesignToken => ({
  name,
  type: "dimension",
  value,
  modes: {},
  origin: { kind, file: "a.css" }
});

const TOKENS = [named("space.small", "8px"), named("space.large", "1.5rem")];

/** What one added line holds: the failures' values and fixes, and the advice's messages. */
const findings = (
  text: string,
  tokens: readonly DesignToken[] = TOKENS,
  file = "src/Card.tsx"
): { readonly problems: readonly string[]; readonly advice: readonly string[] } => {
  const found = codeFindings([{ file, line: 3, text }], tokens);
  return {
    problems: found.problems.map((each) => `${each.rule} ${each.value} ${each.fix ?? "-"}`),
    advice: found.advice.map((each) => each.message)
  };
};

describe("sizes in a style object", () => {
  it("fails a bare number in an inline style that equals a token, with the token as the fix", () => {
    expect(findings('<div style={{ display: "flex", padding: 24 }} />').problems).toEqual([
      "raw-size padding: 24 space.large"
    ]);
  });

  it("fails one in a typed style, a styled component's object and a style sheet", () => {
    expect(findings("const card: CSSProperties = { marginTop: 8 };").problems).toHaveLength(1);
    expect(findings("const Box = styled.div({ gap: 8 });").problems).toHaveLength(1);
    expect(findings("const Box = styled(Card)({ paddingInline: 8 });").problems).toHaveLength(1);
    expect(findings("const s = StyleSheet.create({ box: { padding: 8 } });").problems).toHaveLength(1);
    expect(findings("{ style: { margin: 8 } }").problems).toHaveLength(1);
  });

  it("only advises where the line does not say the object is a style, since an option has the same keys", () => {
    expect(findings("  marginTop: 8,")).toEqual({
      problems: [],
      advice: ["`marginTop: 8` is a size written by hand if this object is a style: use space.small."]
    });
    expect(findings("fitFrameToContent(editor, id, { padding: 8 })").problems).toEqual([]);
  });

  it("leaves a number that is no token's, zero, a sum, and a size with its unit to the sheet's rule", () => {
    expect(findings("<div style={{ padding: 10 }} />")).toEqual({ problems: [], advice: [] });
    expect(findings("<div style={{ padding: 0 }} />")).toEqual({ problems: [], advice: [] });
    expect(findings("<div style={{ padding: 8 * scale }} />")).toEqual({ problems: [], advice: [] });
    expect(findings("await fitView({ padding: 0.3 })")).toEqual({ problems: [], advice: [] });
    expect(findings('<div style={{ padding: "8px" }} />').problems).toEqual(["raw-size 8px space.small"]);
  });

  it("leaves keys that are not sizes of a scale, and keys a style object does not spell", () => {
    expect(findings("<div style={{ width: 8, top: 8, lineHeight: 8 }} />")).toEqual({
      problems: [],
      advice: []
    });
    expect(findings("<div style={{ 'padding-top': 8 }} />")).toEqual({ problems: [], advice: [] });
  });

  it("reads only React's files, where a number is pixels", () => {
    for (const file of ["src/Card.vue", "src/Card.svelte", "src/card.ts", "src/Card.stories.tsx"]) {
      expect(findings("<div style={{ padding: 8 }} />", TOKENS, file)).toEqual({ problems: [], advice: [] });
    }
    expect(findings("<div style={{ padding: 8 }} />", TOKENS, "src/Card.jsx").problems).toHaveLength(1);
  });

  it("compares an application's tokens of the same role only, and never Tailwind's own scale", () => {
    const app = [
      declared("--space-2", "8px"),
      declared("--radius-lg", "12px"),
      declared("--text-sm", "14px"),
      declared("--sidebar-padding", "16px"),
      declared("--spacing-4", "16px", "tailwind-default")
    ];
    expect(findings("<p style={{ padding: 8, borderRadius: 12, fontSize: 14 }} />", app).problems).toEqual([
      "raw-size padding: 8 --space-2",
      "raw-size borderRadius: 12 --radius-lg",
      "raw-size fontSize: 14 --text-sm"
    ]);
    expect(findings("<p style={{ fontSize: 8, padding: 12, margin: 16 }} />", app)).toEqual({
      problems: [],
      advice: []
    });
  });

  it("names both tokens and fixes neither when two hold the value", () => {
    const [problem] = codeFindings(
      [{ file: "src/Card.tsx", line: 1, text: "<p style={{ padding: 8 }} />" }],
      [...TOKENS, named("space.gutter", "0.5rem")]
    ).problems;
    expect(problem?.fix).toBeUndefined();
    expect(problem?.message).toContain("space.small or space.gutter");
  });

  it("takes a comment that says the value is meant, for the failure and the advice", () => {
    const excused = (lines: readonly string[]): ReturnType<typeof codeFindings> =>
      codeFindings(
        lines.map((text, index) => ({ file: "src/Card.tsx", line: index + 1, text })),
        TOKENS
      );
    expect(
      excused(["// forgebook-ignore raw-size: a third-party widget's own spacing", "  padding: 8,"])
    ).toEqual({ problems: [], advice: [] });
    expect(
      excused(["<p style={{ padding: 8 }} /> {/* forgebook-ignore raw-size: matches the embed's frame */}"])
    ).toEqual({ problems: [], advice: [] });
  });
});
