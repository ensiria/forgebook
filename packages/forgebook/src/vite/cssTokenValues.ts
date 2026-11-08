/**
 * What custom properties come to: the tokens a set of declarations makes, each with its value in every theme.
 *
 * @remarks
 * Pure. A value in a real project is rarely a value: it is `var(--primary)`, `calc(var(--radius) - 2px)`, bare channels
 * that a Tailwind configuration wraps in `hsl()`. These are followed here so that a token compares with what code writes
 * by hand. References are followed within a theme, as the browser does, so a base alias changes with what a theme
 * overrides. What cannot be worked out without a browser (a font a framework injects, `color-mix()`) keeps its text, and
 * `nearestToken.ts` counts it as not compared rather than guessing.
 *
 * @module
 */
import type { DesignToken, TokenOrigin } from "./designTokens.ts";

/** A declaration, from a sheet or a configuration, ready to resolve. */
export type TokenDeclaration = {
  /** Its name, with its dashes. */
  readonly name: string;
  /** Its value, as written. */
  readonly value: string;
  /** The theme it belongs to; none for the base. */
  readonly mode: string | undefined;
  /** Where it was read. */
  readonly origin: TokenOrigin;
  /** What it means, when the place that declares it says (a Tailwind configuration's `colors`). */
  readonly type?: string;
  /** It stands on a selector and not the document: what the document declares of that name stands over it. */
  readonly isScoped?: boolean;
};

/** The kinds of Tailwind's namespaces, which name a token's use whatever its value looks like. */
const NAMESPACE_TYPES: readonly (readonly [RegExp, string])[] = [
  [/^--breakpoint-/, "breakpoint"],
  [/^--container-/, "container"],
  [/--line-height$|^--leading-/, "number"],
  [/--letter-spacing$|^--tracking-/, "tracking"],
  [/--font-weight$|^--font-weight-/, "fontWeight"],
  [/--font-feature-settings$|--font-variation-settings$/, "fontFeature"],
  [/^--font-size/, "dimension"],
  [/^--font-/, "fontFamily"],
  [/^--color-/, "color"],
  [/^--(?:inset-)?(?:drop-|text-)?shadow-/, "shadow"],
  [/^--ease-/, "cubicBezier"],
  [/^--animate-/, "animation"],
  [/^--blur-|^--perspective-|^--aspect-/, "other"]
];

/** A value that is a colour by its form. */
const COLOR_VALUE =
  /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(.*\)|transparent|white|black)$/i;

/** A value that is a size by its form, `calc()` included. */
const SIZE_VALUE = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|vh|vw|ch)|calc\(.*\))$/i;

/** A value that is a time by its form. */
const TIME_VALUE = /^(?:\d+\.?\d*|\.\d+)m?s$/i;

/** A value that is a plain number. */
const NUMBER_VALUE = /^-?(?:\d+\.?\d*|\.\d+)$/;

/** Hue, saturation and lightness with no function, which Tailwind's older configurations wrap in one. */
const BARE_HSL = /^-?\d*\.?\d+(?:deg)?[\s,]+\d*\.?\d+%[\s,]+\d*\.?\d+%$/;

/** Three numbers with no function, which a sheet or a configuration wraps in `rgb()`. */
const BARE_RGB = /^\d+\.?\d*[\s,]+\d+\.?\d*[\s,]+\d+\.?\d*$/;

/** A `var()`, with its fallback. */
const VAR_CALL = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/s;

/** The first `var()` in a longer value, its fallback holding one level of parentheses. */
const VAR_INSIDE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/;

/** A colour function around a reference: what tells bare channels from any three numbers. */
const COLOR_WRAPPER = /\b(hsla?|rgba?)\(\s*var\(\s*(--[\w-]+)/g;

/** The placeholder Tailwind's older configurations write for an opacity. */
const ALPHA_PLACEHOLDER = /\s*(?:\/|,)\s*<alpha-value>/;

/** A function around a colour function, as `hsl(oklch(…))`, when a wrapper meets a whole colour. */
const WRAPPED_COLOR =
  /^(?:hsla?|rgba?)\(\s*((?:rgba?|hsla?|oklab|oklch|lab|lch|hwb|color)\([^()]*\)|#[0-9a-f]{3,8})\s*(?:\/\s*([^()/]+))?\)$/i;

/**
 * Which references are wrapped in a colour function, from any text that uses them: how bare channels are told from three
 * plain numbers.
 *
 * @param texts - sheets and configurations.
 */
export const colorWrappers = (texts: readonly string[]): ReadonlyMap<string, "hsl" | "rgb"> => {
  const wrappers = new Map<string, "hsl" | "rgb">();
  for (const text of texts) {
    for (const match of text.matchAll(COLOR_WRAPPER)) {
      const [, wrapper = "", name = ""] = match;
      wrappers.set(name, wrapper.toLowerCase().startsWith("hsl") ? "hsl" : "rgb");
    }
  }
  return wrappers;
};

/** How many names one value may lead through; past it the stack is at risk, and no system chains this far. */
const MOST_REFERENCES = 512;

/** Past this a value is references gone wrong and not a token, in characters. */
const LONGEST_VALUE = 2000;

/** Stands for `var` in a reference that cannot be followed, until the following is over. */
const UNFOLLOWED = "\u0000";

/** A number with no noise from the arithmetic. */
const tidy = (value: number): string => String(Math.round(value * 10000) / 10000);

/** The value of a size in pixels, a rem being 16; none when it has no such unit. */
const sizeInPixels = (text: string): number | undefined => {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem)$/.exec(text.trim());
  if (match === null) return undefined;
  return Number(match[1]) * (match[2] === "rem" ? 16 : 1);
};

/** A plain number; none when it has a unit. */
const plainNumber = (text: string): number | undefined =>
  NUMBER_VALUE.test(text.trim()) ? Number(text) : undefined;

/**
 * `calc()` of known sizes, as sheets write it over a base radius or spacing; none for anything more.
 *
 * @param inner - what is inside the parentheses, its references already followed.
 */
const calculated = (inner: string): string | undefined => {
  const product = /^(\S+)\s*\*\s*(\S+)$/.exec(inner.trim());
  if (product !== null) {
    const [first = "", second = ""] = [product[1], product[2]];
    const size = sizeInPixels(first) ?? sizeInPixels(second);
    const factor = plainNumber(first) ?? plainNumber(second);
    return size === undefined || factor === undefined ? undefined : `${tidy(size * factor)}px`;
  }
  const sum = /^(\S+)\s*([+-])\s*(\S+)$/.exec(inner.trim());
  if (sum === null) return undefined;
  const [first, second] = [sizeInPixels(sum[1] ?? ""), sizeInPixels(sum[3] ?? "")];
  if (first === undefined || second === undefined) return undefined;
  return `${tidy(sum[2] === "+" ? first + second : first - second)}px`;
};

/** A value made plain: its own form, once its references are in. */
const plainValue = (value: string, wrapper: "hsl" | "rgb" | undefined): string => {
  const text = value.replace(ALPHA_PLACEHOLDER, "").trim();
  const [, wrapped, alpha] = WRAPPED_COLOR.exec(text) ?? [];
  if (wrapped !== undefined) {
    // a hex has no room for an opacity written apart, and the colour is what a token compares by
    return alpha === undefined || !wrapped.endsWith(")")
      ? wrapped
      : `${wrapped.slice(0, -1)} / ${alpha.trim()})`;
  }
  if (BARE_HSL.test(text)) return `hsl(${text})`;
  if (wrapper === "rgb" && BARE_RGB.test(text)) return `rgb(${text})`;
  const inner = /^calc\((.*)\)$/s.exec(text)?.[1];
  const sum = inner === undefined ? undefined : calculated(inner);
  return sum ?? text;
};

/**
 * The declarations in force in a theme: its own over the base.
 *
 * @param declarations - every declaration, the lowest priority first.
 * @param mode - the theme; none for the base.
 */
export const layerOf = (
  declarations: readonly TokenDeclaration[],
  mode: string | undefined
): ReadonlyMap<string, TokenDeclaration> => {
  const layer = new Map<string, TokenDeclaration>();
  for (const each of declarations) if (each.mode === undefined) layer.set(each.name, each);
  if (mode !== undefined) for (const each of declarations) if (each.mode === mode) layer.set(each.name, each);
  return layer;
};

/**
 * A declaration's value with every reference it can follow followed; one it cannot keeps its mark all the way out, or the
 * caller would meet it as a new reference. Each name is worked out once: references that lead back in a web of tokens
 * would otherwise take exponentially long, and a browser treats those as invalid anyway.
 */
const followedText = (
  name: string,
  layer: ReadonlyMap<string, TokenDeclaration>,
  wrappers: ReadonlyMap<string, "hsl" | "rgb">,
  known: Map<string, string | undefined>
): string | undefined => {
  if (known.has(name) || known.size > MOST_REFERENCES) return known.get(name);
  const declaration = layer.get(name);
  // while it is being worked out, a reference to it leads back
  known.set(name, undefined);
  if (declaration === undefined) return undefined;
  let text = declaration.value;
  for (let match = VAR_INSIDE.exec(text); match !== null; match = VAR_INSIDE.exec(text)) {
    const [whole, target = "", fallback] = match;
    const value = followedText(target, layer, wrappers, known) ?? fallback?.trim();
    // left as written, marked so this loop passes over it: what a browser fills in later is not known here
    text = text.replace(whole, () => value ?? `${UNFOLLOWED}(${target})`);
    if (text.length > LONGEST_VALUE) break;
  }
  // references that each hold two more double at every step: such a value is nothing anyone can compare
  const followed = text.length > LONGEST_VALUE ? undefined : plainValue(text, wrappers.get(name));
  known.set(name, followed);
  return followed;
};

/** What a declaration comes to, what could not be followed written as the sheet wrote it. */
const resolvedText = (
  name: string,
  layer: ReadonlyMap<string, TokenDeclaration>,
  wrappers: ReadonlyMap<string, "hsl" | "rgb">
): string | undefined => followedText(name, layer, wrappers, new Map())?.replaceAll(UNFOLLOWED, "var");

/** What a token is, by its namespace, by what declared it, then by the form of its value. */
const typeOf = (declaration: TokenDeclaration, value: string): string => {
  if (declaration.type !== undefined) return declaration.type;
  const named = NAMESPACE_TYPES.find(([pattern]) => pattern.test(declaration.name))?.[1];
  if (named !== undefined) return named;
  // Tailwind's `--text-*` are font sizes, and `--text-*` elsewhere may be a text's colour
  if (COLOR_VALUE.test(value)) return "color";
  if (SIZE_VALUE.test(value)) return "dimension";
  if (TIME_VALUE.test(value)) return "duration";
  if (NUMBER_VALUE.test(value)) return /weight/i.test(declaration.name) ? "fontWeight" : "number";
  if (/font|family|typeface/i.test(declaration.name)) return "fontFamily";
  if (/shadow/i.test(declaration.name)) return "shadow";
  if (/^cubic-bezier\(/.test(value)) return "cubicBezier";
  return "other";
};

/** The token a value aliases, when it is nothing else. */
const aliasOf = (value: string): string | undefined => VAR_CALL.exec(value.trim())?.[1];

/** How code writes a token through Tailwind: the end of a class, for what makes utilities. */
const utilityOf = (name: string, origin: TokenOrigin): string | undefined => {
  if (origin.kind === "css-variables") return undefined;
  const match = /^--(?:color|spacing|radius|text|shadow)-(.+)$/.exec(name);
  return match === null || name.includes("--", 2) ? undefined : match[1];
};

/**
 * The tokens declarations make, in the order given. Where one name is declared twice in one theme the later stands, as
 * in a browser's cascade.
 *
 * @param declarations - every declaration, the lowest priority first.
 * @param wrappers - which references are wrapped in a colour function.
 */
export const resolvedTokens = (
  declarations: readonly TokenDeclaration[],
  wrappers: ReadonlyMap<string, "hsl" | "rgb">
): DesignToken[] => {
  const base = layerOf(declarations, undefined);
  const modes = [...new Set(declarations.flatMap((each) => (each.mode === undefined ? [] : [each.mode])))];
  const layers = new Map(modes.map((mode) => [mode, layerOf(declarations, mode)]));
  const names = new Set(declarations.map((each) => each.name));
  return [...names].flatMap((name): DesignToken[] => {
    const inBase = base.get(name);
    const themed = modes.flatMap((mode): { mode: string; text: string; declared: boolean }[] => {
      const layer = layers.get(mode);
      const text = layer === undefined ? undefined : resolvedText(name, layer, wrappers);
      if (text === undefined) return [];
      return [{ mode, text, declared: declarations.some((d) => d.mode === mode && d.name === name) }];
    });
    const baseText = resolvedText(name, base, wrappers);
    const value = baseText ?? themed[0]?.text;
    const declaration = inBase ?? declarations.find((each) => each.name === name);
    if (value === undefined || declaration === undefined) return [];
    const utility = utilityOf(name, declaration.origin);
    const alias = aliasOf(declaration.value);
    return [
      {
        name,
        type: typeOf(declaration, value),
        value,
        ...(alias === undefined ? {} : { alias }),
        modes: Object.fromEntries(
          themed
            .filter((each) => each.declared || each.text !== baseText)
            .map((each) => [each.mode, each.text])
        ),
        ...(inBase === undefined ? { isThemeOnly: true as const } : {}),
        origin: declaration.origin,
        ...(utility === undefined ? {} : { utility })
      }
    ];
  });
};
