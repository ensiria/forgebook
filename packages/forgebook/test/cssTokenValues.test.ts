/**
 * Tests for what custom properties come to: a token compares with what code writes only once it is followed to a value.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { colorWrappers, resolvedTokens, type TokenDeclaration } from "../src/vite/cssTokenValues.ts";
import type { DesignToken, TokenOriginKind } from "../src/vite/designTokens.ts";

/** A declaration. */
const declared = (
  name: string,
  value: string,
  mode?: string,
  kind: TokenOriginKind = "css-variables"
): TokenDeclaration => ({ name, value, mode, origin: { kind, file: "a.css", line: 1 } });

/** One token out of declarations. */
const tokenOf = (
  name: string,
  declarations: readonly TokenDeclaration[],
  wrappers: ReadonlyMap<string, "hsl" | "rgb"> = new Map()
): DesignToken | undefined => resolvedTokens(declarations, wrappers).find((each) => each.name === name);

describe("resolvedTokens", () => {
  it("follows a reference to its value and says what it aliases", () => {
    const token = tokenOf("--a", [declared("--a", "var(--b)"), declared("--b", "#123456")]);
    expect(token).toMatchObject({ value: "#123456", alias: "--b", type: "color" });
  });

  it("gives an alias the value a theme gives what it follows, as the browser does", () => {
    const token = tokenOf("--color-primary", [
      declared("--color-primary", "var(--primary)", undefined, "tailwind-theme"),
      declared("--primary", "#000"),
      declared("--primary", "#fff", "dark")
    ]);
    expect(token).toMatchObject({ value: "#000", modes: { dark: "#fff" }, utility: "primary" });
  });

  it("works out a sum of sizes and a product, as sheets write a radius and a scale", () => {
    const radius = [declared("--radius", "0.5rem"), declared("--radius-sm", "calc(var(--radius) - 2px)")];
    expect(tokenOf("--radius-sm", radius)).toMatchObject({ value: "6px", type: "dimension" });
    const spacing = [declared("--spacing", "0.25rem"), declared("--spacing-4", "calc(var(--spacing) * 4)")];
    expect(tokenOf("--spacing-4", spacing)?.value).toBe("16px");
  });

  it("reads bare channels as the colour a configuration wraps them in", () => {
    expect(tokenOf("--a", [declared("--a", "222.2 47.4% 11.2%")])).toMatchObject({
      value: "hsl(222.2 47.4% 11.2%)",
      type: "color"
    });
    const wrappers = colorWrappers(["color: rgb(var(--a) / 0.5);"]);
    expect(tokenOf("--a", [declared("--a", "59 130 246")], wrappers)?.value).toBe("rgb(59 130 246)");
    // three numbers no one wraps in a colour are not one
    expect(tokenOf("--a", [declared("--a", "59 130 246")])?.type).toBe("other");
  });

  it("takes a wrapper off a whole colour, and Tailwind's placeholder off an opacity", () => {
    const declarations = [
      declared("--a", "hsl(var(--b) / <alpha-value>)"),
      declared("--b", "oklch(0.5 0.1 200)"),
      declared("--c", "hsl(var(--d))"),
      declared("--d", "10 20% 30%")
    ];
    expect(tokenOf("--a", declarations)?.value).toBe("oklch(0.5 0.1 200)");
    expect(tokenOf("--c", declarations)?.value).toBe("hsl(10 20% 30%)");
  });

  it("keeps an opacity through a wrapper, and leaves a sum with no units alone", () => {
    const declarations = [declared("--a", "hsl(var(--b) / 0.5)"), declared("--b", "10 20% 30%")];
    expect(tokenOf("--a", declarations)?.value).toBe("hsl(10 20% 30% / 0.5)");
    expect(tokenOf("--z", [declared("--z", "calc(10 * 100)")])?.value).toBe("calc(10 * 100)");
  });

  it("follows a fallback that holds a function or another reference", () => {
    expect(tokenOf("--a", [declared("--a", "var(--b, rgb(0 0 0))")])?.value).toBe("rgb(0 0 0)");
    expect(tokenOf("--a", [declared("--a", "var(--b, var(--c, #fff))")])?.value).toBe("#fff");
  });

  it("types a font's size as a size", () => {
    expect(tokenOf("--font-size-sm", [declared("--font-size-sm", "14px")])?.type).toBe("dimension");
  });

  it("keeps the text of what only a browser knows, rather than guess", () => {
    const declarations = [
      declared("--font-sans", "var(--font-inter), system-ui"),
      declared("--a", "var(--b)")
    ];
    expect(tokenOf("--font-sans", declarations)).toMatchObject({
      value: "var(--font-inter), system-ui",
      type: "fontFamily"
    });
    expect(tokenOf("--a", declarations)?.value).toBe("var(--b)");
  });

  it("uses a fallback when there is nothing else, and survives a cycle", () => {
    expect(tokenOf("--a", [declared("--a", "var(--b, #fff)")])?.value).toBe("#fff");
    const cycle = [declared("--a", "var(--b)"), declared("--b", "var(--a)")];
    expect(tokenOf("--a", cycle)?.value).toBe("var(--a)");
  });

  it("ends quickly on references that lead back, however many", () => {
    const ring = Array.from({ length: 30 }, (_, index) =>
      declared(`--a${index}`, `var(--a${(index + 1) % 30}) var(--a${(index + 2) % 30})`)
    );
    expect(resolvedTokens(ring, new Map()).length).toBeLessThanOrEqual(30);
  });

  it("types a token by Tailwind's namespace before the form of its value", () => {
    expect(tokenOf("--breakpoint-md", [declared("--breakpoint-md", "48rem")])?.type).toBe("breakpoint");
    expect(tokenOf("--container-md", [declared("--container-md", "28rem")])?.type).toBe("container");
    expect(tokenOf("--text-sm--line-height", [declared("--text-sm--line-height", "1.4")])?.type).toBe(
      "number"
    );
    expect(tokenOf("--font-weight-bold", [declared("--font-weight-bold", "700")])?.type).toBe("fontWeight");
  });

  it("marks a token only themes define, its value the first theme's", () => {
    const token = tokenOf("--a", [declared("--a", "#000", "light"), declared("--a", "#fff", "dark")]);
    expect(token).toMatchObject({ value: "#000", isThemeOnly: true, modes: { light: "#000", dark: "#fff" } });
  });

  it("gives a class's end only to what makes utilities", () => {
    expect(tokenOf("--radius-lg", [declared("--radius-lg", "1rem")])?.utility).toBeUndefined();
    expect(
      tokenOf("--radius-lg", [declared("--radius-lg", "1rem", undefined, "tailwind-theme")])?.utility
    ).toBe("lg");
  });
});
