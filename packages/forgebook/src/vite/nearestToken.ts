/**
 * The tokens nearest a value an agent wrote by hand: what to write instead of a raw colour or size.
 *
 * @remarks
 * Pure. An agent takes the first answer, so the answer has to say whether it is really near (`isClose`) and why there is
 * none (`reason`): an empty list read as "no such token" is how a raw value ends up in the code. Colours compare in
 * Oklab, where a distance follows what the eye sees, which RGB does not; alpha counts, or a solid black would pass for a
 * translucent scrim. Tokens are read back from the CSS they are written as, so tokens and written values take one path.
 *
 * @module
 */
import type { DesignToken } from "./designTokens.ts";

/** A token near a value. */
export type TokenMatch = {
  /** The token. */
  readonly name: string;
  /** Its value there. */
  readonly value: string;
  /** The theme that value belongs to; none for the base. */
  readonly mode?: string;
  /** The token it is an alias of: the base token is often the one to write. */
  readonly alias?: string;
  /** How far, in the answer's `unit`. */
  readonly distance: number;
  /** Whether it is the same value. */
  readonly isExact: boolean;
  /** Whether it is near enough to use in its place. */
  readonly isClose: boolean;
};

/** The answer. */
export type NearestTokens = {
  /** The token type compared with; none when it could not be told. */
  readonly type: string | undefined;
  /** What `distance` counts. */
  readonly unit: string | undefined;
  /** Up to three tokens, nearest first. */
  readonly matches: readonly TokenMatch[];
  /** How many tokens of the type could not be compared (a colour space this cannot place). */
  readonly uncompared: number;
  /** Why the question could not be answered: the value or the type could not be read. */
  readonly reason?: string;
};

/** A colour in Oklab, with its alpha. */
export type OklabColor = {
  /** Its lightness, from 0 to 1. */
  readonly l: number;
  /** How far from green to red. */
  readonly a: number;
  /** How far from blue to yellow. */
  readonly b: number;
  /** Its opacity, from 0 to 1. */
  readonly alpha: number;
};

/** How a type's values compare. */
type Comparison = {
  /** What a distance counts. */
  readonly unit: string;
  /** How far apart two values are; none when one cannot be read. */
  readonly distance: (first: string, second: string) => number | undefined;
  /** The most that is still near, at a value's size. */
  readonly closeAt: (value: string) => number;
};

/** How many tokens a search gives: an agent needs the best and what is close to it. */
const NEAREST_LIMIT = 3;

/** The pixels of a rem, the browsers' default. */
const REM_PIXELS = 16;

/** Below this the two values are equal, whatever the arithmetic left behind. */
const EXACT = 1e-6;

/** Oklab's distance that a person barely tells apart, times 100. */
const CLOSE_COLOR = 2;

/** The share of a size or a time that still reads as the same. */
const CLOSE_SHARE = 0.05;

/** A number as CSS writes it, with what follows. */
const MEASURE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

/** The font weights the format names, as numbers. */
const FONT_WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  hairline: 100,
  "extra-light": 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  "semi-bold": 600,
  "demi-bold": 600,
  bold: 700,
  "extra-bold": 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900,
  "extra-black": 950,
  "ultra-black": 950
};

/** What a CSS property or a loose word compares with, for an agent that names what it is writing. */
const TYPE_WORDS: Readonly<Record<string, string>> = {
  color: "color",
  colour: "color",
  background: "color",
  "background-color": "color",
  "border-color": "color",
  fill: "color",
  stroke: "color",
  dimension: "dimension",
  size: "dimension",
  spacing: "dimension",
  space: "dimension",
  padding: "dimension",
  margin: "dimension",
  gap: "dimension",
  width: "dimension",
  height: "dimension",
  radius: "dimension",
  "border-radius": "dimension",
  "font-size": "dimension",
  duration: "duration",
  "transition-duration": "duration",
  "animation-duration": "duration",
  number: "number",
  "line-height": "number",
  opacity: "number",
  fontweight: "fontWeight",
  "font-weight": "fontWeight"
};

/** A channel without sRGB's curve. */
const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Linear sRGB in Oklab, the published conversion. */
const fromLinear = (r: number, g: number, b: number, alpha: number): OklabColor => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha
  };
};

/** sRGB channels of 0 to 1 in Oklab. */
const fromSrgb = (r: number, g: number, b: number, alpha: number): OklabColor =>
  fromLinear(linear(r), linear(g), linear(b), alpha);

/** Linear Display P3 in Oklab, through linear sRGB, the standard matrix. */
const fromDisplayP3 = (r: number, g: number, b: number, alpha: number): OklabColor => {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  return fromLinear(
    1.2249401 * lr - 0.2249404 * lg,
    -0.0420569 * lr + 1.0420571 * lg,
    -0.0196376 * lr - 0.0786361 * lg + 1.0982735 * lb,
    alpha
  );
};

/** A hex colour; none unless it has 3, 4, 6 or 8 digits. */
const hexColor = (text: string): OklabColor | undefined => {
  const digits = /^#((?:[0-9a-f]{3,4}){1,2})$/.exec(text)?.[1];
  if (digits === undefined) return undefined;
  const long = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const byte = (start: number): number => Number.parseInt(long.slice(start, start + 2), 16) / 255;
  return fromSrgb(byte(0), byte(2), byte(4), long.length === 8 ? byte(6) : 1);
};

/** A function's arguments: its channels and its alpha, commas or spaces, `none` as zero. */
const functionArguments = (
  text: string
): { name: string; parts: readonly string[]; alpha: number } | undefined => {
  const match = /^([a-z-]+)\((.*)\)$/.exec(text);
  if (match === null) return undefined;
  const [channels = "", alpha] = (match[2] ?? "").split("/");
  const parts = channels.trim().split(/[\s,]+/);
  const commaAlpha = alpha === undefined && parts.length === 4 ? parts.pop() : undefined;
  const written = (alpha ?? commaAlpha)?.trim();
  const opacity = written === undefined ? 1 : percentOf(written, 1);
  return { name: match[1] ?? "", parts, alpha: opacity };
};

/** A channel that may be a percentage of a full scale; `none` is zero. */
const percentOf = (text: string, full: number): number => {
  if (text === "none") return 0;
  return text.endsWith("%") ? (Number(text.slice(0, -1)) / 100) * full : Number(text);
};

/** Hue, saturation and lightness as sRGB. */
const hslChannels = (
  hue: number,
  saturation: number,
  lightness: number
): readonly [number, number, number] => {
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number): number => {
    const k = (offset + hue / 30) % 12;
    return lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

/** Polar Oklab as Oklab. */
const fromOklch = (l: number, chroma: number, hue: number, alpha: number): OklabColor => ({
  l,
  a: chroma * Math.cos((hue * Math.PI) / 180),
  b: chroma * Math.sin((hue * Math.PI) / 180),
  alpha
});

/** A CSS colour function; none for one this cannot place in Oklab. */
const functionColor = (text: string): OklabColor | undefined => {
  const call = functionArguments(text);
  if (call === undefined) return undefined;
  const { name, parts, alpha } = call;
  // more channels than a colour has is text that happens to start like one
  if (parts.length > (name === "color" ? 4 : 3)) return undefined;
  const [first = "", second = "", third = "", fourth = ""] = parts;
  const fromRgb = (): OklabColor =>
    fromSrgb(percentOf(first, 255) / 255, percentOf(second, 255) / 255, percentOf(third, 255) / 255, alpha);
  const fromHsl = (): OklabColor => {
    const [r, g, b] = hslChannels(percentOf(first, 360), percentOf(second, 1), percentOf(third, 1));
    return fromSrgb(r, g, b, alpha);
  };
  const convert: Readonly<Record<string, () => OklabColor | undefined>> = {
    rgb: fromRgb,
    rgba: fromRgb,
    hsl: fromHsl,
    hsla: fromHsl,
    oklab: () => ({ l: percentOf(first, 1), a: percentOf(second, 0.4), b: percentOf(third, 0.4), alpha }),
    oklch: () => fromOklch(percentOf(first, 1), percentOf(second, 0.4), percentOf(third, 360), alpha),
    color: () => {
      const [r, g, b] = [percentOf(second, 1), percentOf(third, 1), percentOf(fourth, 1)];
      if (first === "srgb") return fromSrgb(r, g, b, alpha);
      if (first === "srgb-linear") return fromLinear(r, g, b, alpha);
      return first === "display-p3" ? fromDisplayP3(r, g, b, alpha) : undefined;
    }
  };
  return convert[name]?.();
};

/**
 * A colour as CSS writes it, in Oklab; none for what cannot be read. Keywords beyond these three carry no design.
 *
 * @param written - the colour, as code writes it.
 */
export const parsedColor = (written: string): OklabColor | undefined => {
  const text = written.trim().toLowerCase();
  if (text === "transparent") return fromSrgb(0, 0, 0, 0);
  if (text === "black") return fromSrgb(0, 0, 0, 1);
  if (text === "white") return fromSrgb(1, 1, 1, 1);
  const color = text.startsWith("#") ? hexColor(text) : functionColor(text);
  const isReadable = color !== undefined && [color.l, color.a, color.b, color.alpha].every(Number.isFinite);
  return isReadable ? color : undefined;
};

/** A number with a unit, in the unit a type compares in; none when it is something else. */
const measure = (text: string, units: Readonly<Record<string, number>>): number | undefined => {
  const match = MEASURE.exec(text.trim());
  const scale = units[(match?.[2] ?? "").toLowerCase()];
  return match === null || scale === undefined ? undefined : Number(match[1]) * scale;
};

/** Two measures' distance. */
const measured =
  (units: Readonly<Record<string, number>>) =>
  (first: string, second: string): number | undefined => {
    const [a, b] = [measure(first, units), measure(second, units)];
    return a === undefined || b === undefined ? undefined : Math.abs(a - b);
  };

/** What counts as near a measure: a share of it, or a floor for small values. */
const nearMeasure =
  (units: Readonly<Record<string, number>>, floor: number) =>
  (value: string): number =>
    Math.max(floor, Math.abs(measure(value, units) ?? 0) * CLOSE_SHARE);

/** A font weight as a number. */
const fontWeight = (text: string): number | undefined => {
  const named = FONT_WEIGHTS[text.trim().toLowerCase()];
  return named ?? measure(text, { "": 1 });
};

/** The units of dimensions, in pixels. */
const PIXELS: Readonly<Record<string, number>> = { px: 1, rem: REM_PIXELS, "": 1 };

/** The units of durations, in milliseconds. */
const MILLISECONDS: Readonly<Record<string, number>> = { ms: 1, s: 1000 };

/** How each type compares; a type not here has no meaningful distance. */
const COMPARISONS: Readonly<Record<string, Comparison>> = {
  color: {
    unit: "Oklab distance × 100: under 2 reads as the same colour; alpha counts",
    distance: (first: string, second: string): number | undefined => {
      const [a, b] = [parsedColor(first), parsedColor(second)];
      if (a === undefined || b === undefined) return undefined;
      return (Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b) + Math.abs(a.alpha - b.alpha)) * 100;
    },
    closeAt: (): number => CLOSE_COLOR
  },
  dimension: {
    unit: "px, a rem being 16",
    distance: measured(PIXELS),
    closeAt: nearMeasure(PIXELS, 1)
  },
  duration: { unit: "ms", distance: measured(MILLISECONDS), closeAt: nearMeasure(MILLISECONDS, 10) },
  number: { unit: "the number", distance: measured({ "": 1 }), closeAt: nearMeasure({ "": 1 }, 0) },
  fontWeight: {
    unit: "weight",
    distance: (first: string, second: string): number | undefined => {
      const [a, b] = [fontWeight(first), fontWeight(second)];
      return a === undefined || b === undefined ? undefined : Math.abs(a - b);
    },
    closeAt: (): number => 0
  }
};

/** The type a value's form tells, for a question that names none. */
const inferredType = (value: string): string | undefined => {
  const text = value.trim().toLowerCase();
  if (parsedColor(text) !== undefined) return "color";
  if (measure(text, MILLISECONDS) !== undefined) return "duration";
  if (measure(text, { px: 1, rem: 1 }) !== undefined) return "dimension";
  if (FONT_WEIGHTS[text] !== undefined) return "fontWeight";
  return measure(text, { "": 1 }) === undefined ? undefined : "number";
};

/** A token's best match for a value, over its base value and each theme's; a tie goes to the base. */
const bestMatch = (token: DesignToken, value: string, comparison: Comparison): TokenMatch | undefined => {
  const options = [
    ...(token.isThemeOnly === true ? [] : [{ mode: undefined, value: token.value }]),
    ...Object.entries(token.modes).map(([mode, text]) => ({ mode, value: text }))
  ];
  const matches = options.flatMap((option): TokenMatch[] => {
    const distance = comparison.distance(value, option.value);
    if (distance === undefined || !Number.isFinite(distance)) return [];
    return [
      {
        name: token.name,
        value: option.value,
        ...(option.mode === undefined ? {} : { mode: option.mode }),
        ...(token.alias === undefined ? {} : { alias: token.alias }),
        distance: Math.round(distance * 100) / 100,
        isExact: distance < EXACT,
        isClose: distance <= comparison.closeAt(value)
      }
    ];
  });
  return matches.toSorted((first, second) => first.distance - second.distance)[0];
};

/** The order of matches: nearest first, the base before a theme when they tie, since the base holds in every theme. */
const byDistance = (first: TokenMatch, second: TokenMatch): number =>
  first.distance - second.distance || Number(first.mode !== undefined) - Number(second.mode !== undefined);

/** The type a word names: a token type, or a CSS property. */
const typeOfWord = (word: string): string | undefined => TYPE_WORDS[word.trim().toLowerCase()];

/**
 * The tokens nearest a value, nearest first. Deprecated tokens are left out: code must not move onto one.
 *
 * @param tokens - the tokens.
 * @param value - the value, as code writes it (`#1c1b1b`, `rgb(1 2 3 / 50%)`, `hsl(0 100% 50%)`, `16px`, `200ms`).
 * @param asked - a token type, or a CSS property (`background`, `font-size`); none reads it from the value.
 */
export const nearestTokens = (
  tokens: readonly DesignToken[],
  value: string,
  asked: string | undefined
): NearestTokens => {
  const type = asked === undefined ? inferredType(value) : typeOfWord(asked);
  const comparison = type === undefined ? undefined : COMPARISONS[type];
  if (type === undefined || comparison === undefined) {
    const reason =
      asked === undefined
        ? `Cannot tell what kind of value ${value} is: name its type.`
        : `Cannot compare "${asked}": name color, dimension, duration, number or fontWeight, or a CSS property.`;
    return { type: undefined, unit: undefined, matches: [], uncompared: 0, reason };
  }
  if (comparison.distance(value, value) === undefined) {
    return {
      type,
      unit: undefined,
      matches: [],
      uncompared: 0,
      reason: `Cannot read ${value} as a ${type}.`
    };
  }
  const candidates = tokens.filter((token) => token.type === type && token.deprecated === undefined);
  const found = candidates.flatMap((token) => bestMatch(token, value, comparison) ?? []);
  return {
    type,
    unit: comparison.unit,
    matches: found.toSorted(byDistance).slice(0, NEAREST_LIMIT),
    uncompared: candidates.length - found.length
  };
};
