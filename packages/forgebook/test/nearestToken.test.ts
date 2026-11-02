/**
 * Tests for the token nearest a value written by hand: the answer an agent acts on.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type DesignToken, readTokens } from "../src/vite/designTokens.ts";
import { nearestTokens, type TokenMatch } from "../src/vite/nearestToken.ts";

const { tokens } = readTokens([
  {
    label: "tokens.json",
    mode: undefined,
    file: JSON.parse(readFileSync(new URL("./fixtures/tokens.json", import.meta.url), "utf8"))
  }
]);

/** A token of a type, as the reader gives it. */
const made = (name: string, type: string, value: string, extra: Partial<DesignToken> = {}): DesignToken => ({
  name,
  type,
  value,
  modes: {},
  ...extra
});

/** The best match of a value. */
const first = (value: string, type?: string, list: readonly DesignToken[] = tokens): TokenMatch | undefined =>
  nearestTokens(list, value, type).matches[0];

describe("colours", () => {
  it("finds a colour's token, exact when equal, whatever its case", () => {
    expect(first("#E8501C")).toMatchObject({ distance: 0, isExact: true, isClose: true });
  });

  it("finds the nearest of a written colour, close and not exact", () => {
    expect(first("#1c1b1b")).toMatchObject({ name: "color.brand.ink", isExact: false, isClose: true });
  });

  it("says when the nearest is not close, or an agent would take it anyway", () => {
    expect(first("#00ff00")?.isClose).toBe(false);
  });

  it.each(["rgb(232, 80, 28)", "rgb(232 80 28)", "rgb(90.98% 31.37% 10.98%)", "RGB(232,80,28)"])(
    "reads %s",
    (value) => {
      expect(first(value, "color", [made("t", "color", "#e8501c")])?.distance).toBeLessThan(0.1);
    }
  );

  it("reads hsl, and Oklch and a wide colour on both sides", () => {
    expect(first("hsl(0 100% 50%)", undefined, [made("t", "color", "#ff0000")])?.isExact).toBe(true);
    expect(first("oklch(0.5 0.1 200)", undefined, [made("t", "color", "oklch(0.5 0.1 200)")])?.isExact).toBe(
      true
    );
    const wide = "color(display-p3 1 0.2 0.1)";
    expect(first(wide, undefined, [made("t", "color", wide)])?.isExact).toBe(true);
  });

  it("counts alpha: a solid colour is not a translucent one", () => {
    const scrim = made("scrim", "color", "#00000080");
    expect(first("#000000", undefined, [scrim])).toMatchObject({ isExact: false, isClose: false });
    expect(first("rgb(0 0 0 / 50%)", undefined, [scrim])?.distance).toBeLessThan(1);
  });

  it("counts a colour it cannot place, rather than hide it", () => {
    const answer = nearestTokens([made("t", "color", "lab(50% 20 30)")], "#000000", "color");
    expect(answer.matches).toEqual([]);
    expect(answer.uncompared).toBe(1);
  });

  it("leaves out deprecated tokens, which code must not move to", () => {
    const names = nearestTokens(tokens, "#ff0000", "color").matches.map((match) => match.name);
    expect(names).not.toContain("color.brand.old");
  });
});

describe("other types", () => {
  it("compares dimensions in pixels, a rem being 16", () => {
    expect(first("24px", "dimension")).toMatchObject({ name: "space.large", isExact: true });
    expect(first("10px", "dimension")).toMatchObject({ name: "space.small", distance: 2, isClose: false });
  });

  it("compares durations in milliseconds", () => {
    expect(first("0.12s", "duration")).toMatchObject({ name: "motion.quick", isExact: true });
  });

  it("reads a font weight's keywords on both sides", () => {
    expect(first("700", "fontWeight", [made("t", "fontWeight", "bold")])?.isExact).toBe(true);
  });

  it("calls equal only what is equal, not what rounds to it", () => {
    expect(first("16.004px", "dimension", [made("t", "dimension", "16px")])?.isExact).toBe(false);
  });

  it("takes valid CSS numbers, and no invalid hex", () => {
    expect(first("+16px", "dimension", [made("t", "dimension", "16px")])?.isExact).toBe(true);
    expect(nearestTokens(tokens, "#12345", "color").reason).toContain("Cannot read");
  });
});

describe("what to compare with", () => {
  it("reads the type from the value when none is named", () => {
    expect(nearestTokens(tokens, "#000", undefined).type).toBe("color");
    expect(nearestTokens(tokens, "16px", undefined).type).toBe("dimension");
    expect(nearestTokens(tokens, "200ms", undefined).type).toBe("duration");
  });

  it.each([
    ["background", "color"],
    ["padding", "dimension"],
    ["font-size", "dimension"],
    ["transition-duration", "duration"],
    ["Color", "color"]
  ])("takes the property %s as %s", (word, type) => {
    expect(nearestTokens(tokens, word === "transition-duration" ? "1s" : "#000", word).type).toBe(type);
  });

  it("says why it cannot answer, so an empty list means only that no token is there", () => {
    expect(nearestTokens(tokens, "#000", "nonsense").reason).toContain("Cannot compare");
    expect(nearestTokens(tokens, "not a colour", undefined).reason).toContain("Cannot tell");
    expect(nearestTokens(tokens, "not a colour", "color").reason).toContain("Cannot read");
  });
});

describe("the order of the answer", () => {
  it("puts a base value before a theme's that ties, since the base holds in every theme", () => {
    const list = [
      made("surface", "color", "#ffffff", { modes: { dark: "#000000" } }),
      made("ink", "color", "#000000")
    ];
    expect(nearestTokens(list, "#000000", "color").matches[0]?.name).toBe("ink");
  });

  it("looks in a theme's values, and says which", () => {
    const list = [made("c", "color", "#ffffff", { modes: { dark: "#000000" } })];
    expect(first("#000000", "color", list)).toMatchObject({ mode: "dark", isExact: true });
  });

  it("does not offer a theme-only token as if it held everywhere", () => {
    const list = [made("glow", "color", "#ff00ff", { isThemeOnly: true, modes: { dark: "#ff00ff" } })];
    expect(first("#ff00ff", "color", list)).toMatchObject({ mode: "dark" });
  });

  it("names what an alias points at", () => {
    expect(first("#e8501c", "color", [made("a", "color", "#e8501c", { alias: "b" })])?.alias).toBe("b");
  });
});
