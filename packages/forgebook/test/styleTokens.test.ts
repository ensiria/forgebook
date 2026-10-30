/**
 * The shell's code palette reaches 4.5:1 on the code background (WCAG 2.1 AA for text), read from the shell's tokens.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const TOKENS = readFileSync(join(import.meta.dirname, "..", "src", "styles", "_tokens.scss"), "utf8");

/** A token's hex value. */
const tokenHex = (name: string): string => {
  const value = new RegExp(`^\\$${name}:\\s*(#[0-9a-f]{3,8});`, "m").exec(TOKENS)?.[1];
  if (value === undefined) throw new Error(`No hex value for $${name}`);
  return value;
};

/** A hex colour's channels, 0 to 1, with its alpha. */
const channels = (hex: string): [number, number, number, number] => {
  const digits = hex.slice(1);
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const [r = 0, g = 0, b = 0, a = 255] = (full.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
  return [r / 255, g / 255, b / 255, full.length === 8 ? a / 255 : 1];
};

/** A translucent colour laid on an opaque one. */
const over = (top: string, ground: string): [number, number, number] => {
  const [r, g, b, alpha] = channels(top);
  const [gr, gg, gb] = channels(ground);
  return [r * alpha + gr * (1 - alpha), g * alpha + gg * (1 - alpha), b * alpha + gb * (1 - alpha)];
};

/** The relative luminance of an opaque colour. */
const luminance = ([r, g, b]: readonly number[]): number => {
  const linear = (channel = 0): number =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** The contrast ratio of two opaque colours. */
const contrast = (first: readonly number[], second: readonly number[]): number => {
  const [light, dark] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

describe("the shell's code palette", () => {
  const background = over(tokenHex("fill-quiet"), tokenHex("surface"));

  it.each(["keyword", "type", "string", "number", "punctuation", "name"])(
    "$code-%s reaches 4.5:1",
    (name) => {
      expect(
        contrast(over(tokenHex(`code-${name}`), tokenHex("surface")), background)
      ).toBeGreaterThanOrEqual(4.5);
    }
  );
});
