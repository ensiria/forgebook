/**
 * Tests for reading design tokens (DTCG 2025.10): references, themes, and every value as CSS writes it. The files are
 * JSON, since the format's field names are not this repository's to rename.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type DesignToken, filteredTokens, type ParsedTokens, readTokens } from "../src/vite/designTokens.ts";

/** A file of the fixtures', parsed. */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

/** The format's fields, written for a test. */
const token = (fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [`$${key}`, value]));

/** A value in a colour space. */
const colored = (colorSpace: string, components: readonly unknown[], alpha?: number): unknown => ({
  colorSpace,
  components,
  ...(alpha === undefined ? {} : { alpha })
});

/** One file, as a base. */
const read = (file: unknown): ParsedTokens => readTokens([{ label: "tokens.json", mode: undefined, file }]);

/** A base and a dark theme. */
const themed = (base: unknown, dark: unknown): ParsedTokens =>
  readTokens([
    { label: "tokens.json", mode: undefined, file: base },
    { label: "dark.json", mode: "dark", file: dark }
  ]);

/** The value of one colour, read from a file holding only it. */
const colorValue = (value: unknown): string | undefined =>
  read({ c: token({ type: "color", value }) }).tokens[0]?.value;

const { tokens, problems: fixtureProblems } = read(fixture("tokens.json"));
const find = (name: string): DesignToken | undefined => tokens.find((each) => each.name === name);

describe("groups", () => {
  it("flattens them into dotted names, a group's $type reaching its tokens", () => {
    expect(fixtureProblems).toEqual([]);
    expect(find("color.brand.primary")).toEqual({
      name: "color.brand.primary",
      type: "color",
      value: "#e8501c",
      description: "The accent.",
      modes: {}
    });
    expect(find("motion.quick")?.type).toBe("duration");
  });

  it("reads $root as the token a group holds under its own name, and aliases reach it", () => {
    const { tokens: read$ } = read({
      accent: {
        ...Object.fromEntries([["$root", token({ type: "color", value: "#ff0000" })]]),
        light: token({ type: "color", value: "#ffaaaa" })
      },
      use: token({ value: "{accent.$root}" })
    });
    expect(read$.map((each) => [each.name, each.value])).toEqual([
      ["accent.$root", "#ff0000"],
      ["accent.light", "#ffaaaa"],
      ["use", "#ff0000"]
    ]);
  });

  it("carries a group's $deprecated down, and a token's false clears it", () => {
    const parsed = read({
      old: {
        ...token({ deprecated: "Gone." }),
        a: token({ type: "color", value: "#111111" }),
        b: token({ type: "color", value: "#222222", deprecated: false })
      }
    });
    expect(parsed.tokens[0]?.deprecated).toBe("Gone.");
    expect(parsed.tokens[1]?.deprecated).toBeUndefined();
  });

  it("applies $extends: a local token replaces the inherited one, and the rest stays", () => {
    const parsed = read({
      button: {
        ...token({ type: "color" }),
        bg: token({ value: "#000000" }),
        fg: token({ value: "#ffffff" })
      },
      primary: { ...token({ extends: "{button}" }), bg: token({ value: "#ff0000" }) }
    });
    const value = (name: string): string | undefined =>
      parsed.tokens.find((each) => each.name === name)?.value;
    expect(parsed.problems).toEqual([]);
    expect(value("primary.bg")).toBe("#ff0000");
    expect(value("primary.fg")).toBe("#ffffff");
  });

  it("names a broken $extends: into a token, in a circle, or nowhere", () => {
    expect(
      read({ a: token({ type: "color", value: "#000000" }), b: token({ extends: "{a}" }) }).problems[0]
    ).toContain("names a token");
    expect(read({ a: token({ extends: "{a}" }) }).problems[0]).toContain("leads back to itself");
    expect(read({ a: token({ extends: "{nope}" }) }).problems[0]).toContain("leads nowhere");
  });

  it("names a token that is also a group, and a name the format reserves", () => {
    const both = read({
      g: { ...token({ type: "color", value: "#000000" }), kid: token({ value: "#fff" }) }
    });
    expect(both.problems[0]).toContain("cannot also be a group");
    expect(read({ "a.b": token({ type: "color", value: "#000000" }) }).problems[0]).toContain("cannot hold");
  });
});

describe("references", () => {
  it("resolves an alias to the value, and keeps what it points at", () => {
    expect(find("color.action")).toMatchObject({ value: "#e8501c", alias: "color.brand.primary" });
  });

  it("resolves aliases inside a composite value", () => {
    expect(find("shadow.raised")?.value).toContain("#1c1915");
  });

  it("takes an alias's type from its target before its group's", () => {
    const parsed = read({
      c: token({ type: "color", value: "#000000" }),
      s: { ...token({ type: "dimension" }), y: token({ value: "{c}" }) }
    });
    expect(parsed.tokens[1]).toMatchObject({ name: "s.y", type: "color" });
  });

  it("names an alias whose own type disagrees with its target", () => {
    const parsed = read({
      c: token({ type: "color", value: "#000000" }),
      d: token({ type: "dimension", value: "{c}" })
    });
    expect(parsed.problems[0]).toContain("it says dimension, its alias is color");
  });

  it("follows $ref: a whole token, and a part of a value, with its escapes", () => {
    const parsed = read({
      "a/b": token({ type: "dimension", value: { value: 8, unit: "px" } }),
      viaToken: { ...Object.fromEntries([["$ref", "#/a~1b"]]) },
      viaPart: token({
        type: "dimension",
        value: { value: Object.fromEntries([["$ref", "#/a~1b/$value/value"]]), unit: "rem" }
      })
    });
    const value = (name: string): string | undefined =>
      parsed.tokens.find((each) => each.name === name)?.value;
    expect(parsed.problems).toEqual([]);
    expect(value("viaToken")).toBe("8px");
    expect(value("viaPart")).toBe("8rem");
  });

  it("names a $ref that leads nowhere or back to itself", () => {
    expect(read({ a: Object.fromEntries([["$ref", "#/nope"]]) }).problems[0]).toContain("leads nowhere");
    expect(read({ a: Object.fromEntries([["$ref", "#/a"]]) }).problems[0]).toContain("leads back to itself");
  });

  it("names an alias that leads nowhere, and aliases in a circle, and keeps the rest", () => {
    const parsed = read({
      a: token({ type: "color", value: "{missing.token}" }),
      b: token({ type: "color", value: "{c}" }),
      c: token({ type: "color", value: "{b}" }),
      fine: token({ type: "color", value: "#000000" })
    });
    expect(parsed.tokens.map((each) => each.name)).toEqual(["fine"]);
    expect(parsed.problems).toHaveLength(3);
    expect(parsed.problems[0]).toBe("tokens.json: a: the alias {missing.token} leads nowhere");
  });

  it("names a token with no type, since the format has no default", () => {
    expect(read({ a: token({ value: "#000" }) }).problems[0]).toContain("no $type");
  });
});

describe("values as CSS writes them", () => {
  it("writes a colour's hex, a dimension with its unit, a family with its quotes", () => {
    expect(find("color.brand.ink")?.value).toBe("#1c1915");
    expect(find("space.large")?.value).toBe("1.5rem");
    expect(find("motion.quick")?.value).toBe("120ms");
    expect(find("font.body")?.value).toBe("Inter, sans-serif");
    expect(
      read({ f: token({ type: "fontFamily", value: ["Font Awesome 6 Free", "serif"] }) }).tokens[0]?.value
    ).toBe('"Font Awesome 6 Free", serif');
  });

  it("keeps alpha, or a scrim would read as a solid colour", () => {
    expect(colorValue(colored("srgb", [0, 0, 0], 0.5))).toBe("#00000080");
    expect(colorValue(colored("display-p3", [1, 0, 0], 0.5))).toBe("color(display-p3 1 0 0 / 0.5)");
  });

  it("uses a space's own function, since color() does not take them", () => {
    expect(colorValue(colored("oklch", [0.5, 0.1, 200]))).toBe("oklch(0.5 0.1 200)");
    expect(colorValue(colored("hsl", [120, 50, 50]))).toBe("hsl(120 50% 50%)");
    expect(colorValue(colored("lab", [50, 20, 30]))).toBe("lab(50% 20 30)");
  });

  it("keeps a wide colour, not its fallback hex", () => {
    expect(colorValue({ ...(colored("display-p3", [1, 0.2, 0.1]) as object), hex: "#ff3311" })).toBe(
      "color(display-p3 1 0.2 0.1)"
    );
  });

  it("writes `none` in a colour's function, not as a number", () => {
    expect(colorValue(colored("srgb", [1, "none", 0.2]))).toBe("color(srgb 1 none 0.2)");
  });

  it("writes a curve as a function, and a composite's parts as CSS", () => {
    expect(read({ e: token({ type: "cubicBezier", value: [0.2, 0, 0, 1] }) }).tokens[0]?.value).toBe(
      "cubic-bezier(0.2, 0, 0, 1)"
    );
    expect(find("shadow.raised")?.value).toContain('"blur":"4px"');
  });
});

describe("themes", () => {
  const base = {
    ink: token({ type: "color", value: "#111111" }),
    surface: token({ type: "color", value: "#ffffff" })
  };

  it("adds a theme's values to the base tokens", () => {
    expect(themed(base, { surface: token({ value: "#222222" }) }).tokens[1]).toMatchObject({
      value: "#ffffff",
      modes: { dark: "#222222" }
    });
  });

  it("lets a theme alias the base, and take its type from it", () => {
    const parsed = themed(base, { surface: token({ value: "{ink}" }) });
    expect(parsed.problems).toEqual([]);
    expect(parsed.tokens[1]?.modes).toEqual({ dark: "#111111" });
  });

  it("makes a base alias follow what a theme overrides, or semantic tokens would not change with the theme", () => {
    const palette = {
      primary: token({ type: "color", value: "#ff0000" }),
      action: token({ value: "{primary}" })
    };
    const parsed = themed(palette, { primary: token({ value: "#00ff00" }) });
    expect(parsed.tokens.find((each) => each.name === "action")).toMatchObject({
      value: "#ff0000",
      modes: { dark: "#00ff00" }
    });
  });

  it("marks a token only a theme has, so it does not read as holding everywhere", () => {
    const parsed = themed(base, { glow: token({ type: "color", value: "#ff00ff" }) });
    expect(parsed.tokens.at(-1)).toMatchObject({
      name: "glow",
      isThemeOnly: true,
      modes: { dark: "#ff00ff" }
    });
  });

  it("lets two base files reference each other", () => {
    const parsed = readTokens([
      { label: "palette.json", mode: undefined, file: { red: token({ type: "color", value: "#ff0000" }) } },
      { label: "semantic.json", mode: undefined, file: { danger: token({ value: "{red}" }) } }
    ]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.tokens[1]).toMatchObject({ value: "#ff0000" });
  });

  it("names the file a problem is in", () => {
    expect(themed(base, { x: token({ value: "{nope}", type: "color" }) }).problems[0]).toBe(
      "dark.json: x: the alias {nope} leads nowhere"
    );
  });
});

describe("filteredTokens", () => {
  it("takes a type or a first group", () => {
    expect(filteredTokens(tokens, "dimension").map((each) => each.name)).toEqual([
      "space.small",
      "space.large"
    ]);
    expect(filteredTokens(tokens, "space").map((each) => each.name)).toEqual(["space.small", "space.large"]);
  });

  it("gives everything with no category", () => {
    expect(filteredTokens(tokens, undefined)).toHaveLength(tokens.length);
  });
});
