/**
 * Design tokens read from DTCG files (the Design Tokens Format, 2025.10): a flat list with references followed and
 * themes applied, every value as CSS writes it.
 *
 * @remarks
 * Pure: parsed JSON in, tokens out. The format has no themes of its own, so a theme is a file of its own read over the
 * base (`tokens: ["tokens.json", { file: "dark.json", mode: "dark" }]`). References are followed over base and theme
 * together: a theme can alias the base, and a base alias follows what a theme overrides, which is why semantic tokens
 * over a palette change with the theme at all. That is why files are collected first and resolved only once all are
 * known. A token that cannot be used is named in `problems` with its file, and the others stay usable: nothing vanishes
 * in silence, since a token an agent cannot find is a colour it writes by hand.
 *
 * Files of a catalogue's sources are read before its own, so its aliases reach a library's palette and a later file
 * replaces an earlier one's token. Within one author's files that is plain layering; between authors it is a clash,
 * reported and never refused: the catalogue is what puts the libraries together, so its value is the one in use.
 *
 * @module
 */

import { type TokenClash, tokenClashes } from "./tokenClashes.ts";

/** A token, ready to read. */
export type DesignToken = {
  /** Its name, the groups joined by dots (`color.brand.primary`). */
  readonly name: string;
  /** Its type (`color`, `dimension`…). */
  readonly type: string;
  /** Its value, as CSS writes it; the first theme's when only themes define it. */
  readonly value: string;
  /** The token it is an alias of. */
  readonly alias?: string;
  /** What it is for. */
  readonly description?: string;
  /** Why not to use it, when it is deprecated. */
  readonly deprecated?: string;
  /** Its value in each theme where it differs, by theme. */
  readonly modes: Readonly<Record<string, string>>;
  /** Whether only themes define it, so `value` does not hold everywhere. */
  readonly isThemeOnly?: true;
  /** The source that gives it, by its id or, when it writes none, by its module; none for the catalogue's own. */
  readonly source?: string;
};

/** What the files gave. */
export type ParsedTokens = {
  /** The tokens that can be used, in the files' order. */
  readonly tokens: readonly DesignToken[];
  /** What could not be used, one line each, naming its file. */
  readonly problems: readonly string[];
  /** The names two authors give different values, with whose stands. */
  readonly clashes: readonly TokenClash[];
};

/** A tokens file, parsed. */
export type TokensInput = {
  /** What a problem calls it: its name in the configuration. */
  readonly label: string;
  /** The theme; none for the base. */
  readonly mode: string | undefined;
  /** The file's content. */
  readonly file: unknown;
  /** The source it comes from; none for the catalogue's own. */
  readonly source?: string;
};

/** A token as a file writes it, before references are followed. */
type RawToken = {
  readonly name: string;
  /** Its own `$type`, which outranks all. */
  readonly ownType: string | undefined;
  /** Its groups', which an alias's target outranks. */
  readonly groupType: string | undefined;
  readonly value: unknown;
  readonly description: string | undefined;
  readonly deprecated: string | undefined;
  /** What a problem calls its file. */
  readonly label: string;
  /** The id of the source it comes from. */
  readonly source: string | undefined;
  /** The token of an earlier file it replaces, whose type stands when it gives none. */
  readonly replaces?: RawToken;
};

/** What walking a group passes down. */
type Inherited = Pick<RawToken, "label" | "source"> & {
  readonly type: string | undefined;
  readonly deprecated: string | undefined;
};

/** A reference to a token in a value: nothing but its name in braces. */
const ALIAS = /^\{([^{}]+)\}$/;

/** What a token or group name may not hold: the format reserves them for references. */
const RESERVED_IN_NAME = /[.{}]/;

/** The key of the token a group holds under its own name. */
const ROOT_KEY = "$root";

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field as text, when it is text. */
const textField = (node: Readonly<Record<string, unknown>>, field: string): string | undefined => {
  const value = node[field];
  return typeof value === "string" ? value : undefined;
};

/** What a node says of deprecation: the key's presence decides, since `false` clears what a group set. */
const deprecationOf = (
  node: Readonly<Record<string, unknown>>,
  inherited: string | undefined
): string | undefined => {
  if (!("$deprecated" in node)) return inherited;
  const value = node["$deprecated"];
  if (value === true) return "Deprecated.";
  return typeof value === "string" ? value : undefined;
};

/** A JSON pointer's target in a document; none when it leads nowhere. */
const pointed = (root: unknown, pointer: string): unknown => {
  let current: unknown = root;
  for (const part of pointer.replace(/^#\/?/, "").split("/")) {
    if (part === "") continue;
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current)) current = current[key];
    else return undefined;
  }
  return current;
};

/** Everything under a node with its `$ref`s replaced by what they point at, a node's own fields winning. */
const withoutRefs = (
  node: unknown,
  root: unknown,
  through: ReadonlySet<string>,
  problems: string[]
): unknown => {
  if (Array.isArray(node)) return node.map((each) => withoutRefs(each, root, through, problems));
  if (!isRecord(node)) return node;
  const pointer = textField(node, "$ref");
  const own = Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== "$ref")
      .map(([key, value]) => [key, withoutRefs(value, root, through, problems)])
  );
  if (pointer === undefined) return own;
  if (through.has(pointer)) {
    problems.push(`$ref ${pointer} leads back to itself`);
    return own;
  }
  const target = pointed(root, pointer);
  if (target === undefined) {
    problems.push(`$ref ${pointer} leads nowhere`);
    return own;
  }
  const expanded = withoutRefs(target, root, new Set([...through, pointer]), problems);
  return isRecord(expanded) ? { ...expanded, ...own } : expanded;
};

/** A group's fields over the one it extends: a local token replaces the inherited one whole, a group merges. */
const mergedGroup = (
  base: Readonly<Record<string, unknown>>,
  local: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(local)) {
    const known = merged[key];
    const areGroups = isRecord(value) && isRecord(known) && !("$value" in value) && !("$value" in known);
    merged[key] = areGroups ? mergedGroup(known, value) : value;
  }
  return merged;
};

/** A group with what it extends applied, the groups under it included. */
const withExtends = (
  group: Readonly<Record<string, unknown>>,
  root: Readonly<Record<string, unknown>>,
  through: ReadonlySet<string>,
  problems: string[]
): Readonly<Record<string, unknown>> => {
  const reference = textField(group, "$extends");
  const name = reference === undefined ? undefined : ALIAS.exec(reference)?.[1];
  let base: Readonly<Record<string, unknown>> = {};
  if (name !== undefined) {
    const target = pointed(root, name.split(".").join("/"));
    if (through.has(name)) problems.push(`$extends {${name}} leads back to itself`);
    else if (!isRecord(target)) problems.push(`$extends {${name}} leads nowhere`);
    else if ("$value" in target) problems.push(`$extends {${name}} names a token, not a group`);
    else base = withExtends(target, root, new Set([...through, name]), problems);
  }
  const own = Object.fromEntries(
    Object.entries(group)
      .filter(([key]) => key !== "$extends")
      .map(([key, value]) => [
        key,
        isRecord(value) && !("$value" in value) && !key.startsWith("$")
          ? withExtends(value, root, through, problems)
          : value
      ])
  );
  return mergedGroup(base, own);
};

/** One token's raw form. */
const rawToken = (node: Readonly<Record<string, unknown>>, name: string, inherited: Inherited): RawToken => ({
  name,
  ownType: textField(node, "$type"),
  groupType: inherited.type,
  value: node["$value"],
  description: textField(node, "$description"),
  deprecated: deprecationOf(node, inherited.deprecated),
  label: inherited.label,
  source: inherited.source
});

/** Every token under a group, what the group says of type and deprecation reaching its tokens. */
const collected = (
  group: Readonly<Record<string, unknown>>,
  path: readonly string[],
  inherited: Inherited,
  problems: string[]
): RawToken[] => {
  const passed: Inherited = {
    ...inherited,
    type: textField(group, "$type") ?? inherited.type,
    deprecated: deprecationOf(group, inherited.deprecated)
  };
  return Object.entries(group).flatMap(([key, node]): RawToken[] => {
    if (!isRecord(node) || (key.startsWith("$") && key !== ROOT_KEY)) return [];
    const nodePath = [...path, key];
    const name = nodePath.join(".");
    if (RESERVED_IN_NAME.test(key)) {
      problems.push(`${name}: a name cannot hold ".", "{" or "}"`);
      return [];
    }
    if (!("$value" in node)) return collected(node, nodePath, passed, problems);
    const children = Object.keys(node).filter((child) => !child.startsWith("$"));
    if (children.length > 0)
      problems.push(`${name}: a token cannot also be a group (${children.join(", ")})`);
    return [rawToken(node, name, passed)];
  });
};

/** A file's raw tokens. */
const fileTokens = (input: TokensInput, problems: string[]): RawToken[] => {
  const local: string[] = [];
  const inherited = { type: undefined, deprecated: undefined, label: input.label, source: input.source };
  let raw: RawToken[] = [];
  if (!isRecord(input.file)) local.push("the file is not a group of tokens");
  else {
    try {
      const root = withoutRefs(input.file, input.file, new Set(), local);
      raw = collected(withExtends(asRecord(root), input.file, new Set(), local), [], inherited, local);
    } catch (error) {
      // a file nested past the stack costs that file, not every other author's tokens
      local.push(error instanceof Error ? error.message : String(error));
    }
  }
  problems.push(...local.map((problem) => `${input.label}: ${problem}`));
  return raw;
};

/** A value known to be a record, for the document's root. */
const asRecord = (value: unknown): Readonly<Record<string, unknown>> => (isRecord(value) ? value : {});

/** A font name, quoted unless it is a plain identifier or a generic family. */
const fontName = (name: string): string => (/^-?[a-zA-Z_][\w-]*$/.test(name) ? name : JSON.stringify(name));

/** A number of 0 to 1 as two hexadecimal digits. */
const hexByte = (part: number): string =>
  Math.round(Math.min(1, Math.max(0, part)) * 255)
    .toString(16)
    .padStart(2, "0");

/** What `color()` cannot write: these spaces are CSS functions of their own. */
const FUNCTION_SPACES: Readonly<Record<string, (parts: readonly string[]) => string>> = {
  hsl: ([h, s, l]: readonly string[]): string => `hsl(${h} ${s}% ${l}%)`,
  hwb: ([h, w, b]: readonly string[]): string => `hwb(${h} ${w}% ${b}%)`,
  lab: ([l, a, b]: readonly string[]): string => `lab(${l}% ${a} ${b})`,
  lch: ([l, c, h]: readonly string[]): string => `lch(${l}% ${c} ${h})`,
  oklab: ([l, a, b]: readonly string[]): string => `oklab(${l} ${a} ${b})`,
  oklch: ([l, c, h]: readonly string[]): string => `oklch(${l} ${c} ${h})`
};

/** A colour with its alpha added to a function's text. */
const withAlpha = (text: string, alpha: number): string =>
  alpha >= 1 ? text : `${text.slice(0, -1)} / ${alpha})`;

/**
 * A colour object as CSS writes it. Its `hex` is only a fallback, so it is taken in sRGB alone: elsewhere it would hide
 * the colour itself, and with an alpha it would drop it.
 */
const colorText = (color: Readonly<Record<string, unknown>>): string | undefined => {
  const space = textField(color, "colorSpace");
  const parts = color["components"];
  if (space === undefined || !Array.isArray(parts)) return undefined;
  const alpha = typeof color["alpha"] === "number" ? color["alpha"] : 1;
  const isNumeric = parts.every((part) => typeof part === "number");
  if (space === "srgb" && isNumeric) {
    const hex = `#${parts.map((part) => hexByte(Number(part))).join("")}`;
    return alpha >= 1 ? (textField(color, "hex") ?? hex) : `${hex}${hexByte(alpha)}`;
  }
  const written = parts.map(String);
  const own = FUNCTION_SPACES[space];
  return withAlpha(own === undefined ? `color(${space} ${written.join(" ")})` : own(written), alpha);
};

/** Parts of a value written as CSS, where the parts have a CSS form; a composite keeps its fields. */
const cssParts = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cssParts);
  if (!isRecord(value)) return value;
  const color = colorText(value);
  if (color !== undefined) return color;
  if ("value" in value && "unit" in value) return `${String(value["value"])}${String(value["unit"])}`;
  return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, cssParts(part)]));
};

/** A value as CSS writes it; a composite as JSON of its parts. */
const valueText = (value: unknown, type: string): string => {
  if (type === "fontFamily") {
    return (Array.isArray(value) ? value : [value]).map((name) => fontName(String(name))).join(", ");
  }
  if (type === "cubicBezier" && Array.isArray(value)) return `cubic-bezier(${value.join(", ")})`;
  if (typeof value === "string" || typeof value === "number") return String(value);
  const parts = cssParts(value);
  return typeof parts === "string" ? parts : JSON.stringify(parts);
};

/** The name a value references, when it is nothing else. */
const aliasOf = (value: unknown): string | undefined =>
  typeof value === "string" ? ALIAS.exec(value)?.[1] : undefined;

/** A value with every reference followed. Throws the problem's text, caught for its token. */
const followed = (
  value: unknown,
  byName: ReadonlyMap<string, RawToken>,
  through: ReadonlySet<string>
): unknown => {
  const name = aliasOf(value);
  if (name !== undefined) {
    if (through.has(name)) throw new Error(`the alias {${name}} leads back to itself`);
    const target = byName.get(name);
    if (target === undefined) throw new Error(`the alias {${name}} leads nowhere`);
    return followed(target.value, byName, new Set([...through, name]));
  }
  if (Array.isArray(value)) return value.map((part) => followed(part, byName, through));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, part]) => [key, followed(part, byName, through)])
    );
  }
  return value;
};

/** A token's type: its own, then what its alias resolves to, then its group's, as the format orders them. */
const typeOf = (
  raw: RawToken,
  byName: ReadonlyMap<string, RawToken>,
  seen: ReadonlySet<string>
): string | undefined => {
  if (raw.ownType !== undefined) return raw.ownType;
  const name = aliasOf(raw.value);
  const target = name === undefined || seen.has(name) ? undefined : byName.get(name);
  const aliased = target === undefined ? undefined : typeOf(target, byName, new Set([...seen, target.name]));
  const replaced = raw.replaces === undefined ? undefined : typeOf(raw.replaces, byName, seen);
  return aliased ?? raw.groupType ?? replaced;
};

/** What a token comes to under a set of tokens, or why it cannot be used. */
const resolvedValue = (
  raw: RawToken,
  byName: ReadonlyMap<string, RawToken>
): { text: string; type: string } | string => {
  const type = typeOf(raw, byName, new Set([raw.name]));
  if (type === undefined) return `${raw.name}: no $type, on it or on its groups`;
  const name = aliasOf(raw.value);
  const target = name === undefined ? undefined : byName.get(name);
  const targetType = target === undefined ? undefined : typeOf(target, byName, new Set([target.name]));
  if (raw.ownType !== undefined && targetType !== undefined && raw.ownType !== targetType) {
    return `${raw.name}: it says ${raw.ownType}, its alias is ${targetType}`;
  }
  try {
    return { text: valueText(followed(raw.value, byName, new Set([raw.name])), type), type };
  } catch (error) {
    return `${raw.name}: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/** The token a raw one makes, its values in each theme filled in afterwards. */
const tokenOf = (raw: RawToken, value: string, type: string): DesignToken => {
  const alias = aliasOf(raw.value);
  return {
    name: raw.name,
    type,
    value,
    ...(alias === undefined ? {} : { alias }),
    ...(raw.description === undefined ? {} : { description: raw.description }),
    ...(raw.deprecated === undefined ? {} : { deprecated: raw.deprecated }),
    ...(raw.source === undefined ? {} : { source: raw.source }),
    modes: {}
  };
};

/**
 * The tokens of files by name, the later file replacing. A file over another writes the value and little else, so what
 * it leaves out is the replaced token's: it retunes the token, it does not make a new one.
 */
const byNameOf = (lists: readonly (readonly RawToken[])[]): Map<string, RawToken> => {
  const merged = new Map<string, RawToken>();
  for (const token of lists.flat()) {
    const known = merged.get(token.name);
    merged.set(
      token.name,
      known === undefined
        ? token
        : {
            ...token,
            replaces: known,
            description: token.description ?? known.description,
            deprecated: token.deprecated ?? known.deprecated
          }
    );
  }
  return merged;
};

/** A token's value in a theme. */
type ThemeValue = { readonly text: string; readonly type: string; readonly raw: RawToken };

/** Each token's value in a theme, with a problem for what the theme itself broke. */
const themeValues = (
  own: readonly RawToken[],
  base: ReadonlyMap<string, RawToken>,
  problems: string[]
): Map<string, ThemeValue> => {
  const merged = byNameOf([[...base.values()], own]);
  const names = new Set(own.map((token) => token.name));
  const values = new Map<string, ThemeValue>();
  for (const raw of merged.values()) {
    const result = resolvedValue(raw, merged);
    if (typeof result !== "string") values.set(raw.name, { ...result, raw });
    else if (names.has(raw.name)) problems.push(`${raw.label}: ${result}`);
  }
  return values;
};

/** A theme's values on the tokens: a token it names, one a reference changed, and one only it has. */
const applyTheme = (
  tokens: Map<string, DesignToken>,
  mode: string,
  own: readonly RawToken[],
  values: ReadonlyMap<string, ThemeValue>
): void => {
  for (const [name, value] of values) {
    const known = tokens.get(name);
    if (known === undefined) {
      tokens.set(name, {
        ...tokenOf(value.raw, value.text, value.type),
        isThemeOnly: true,
        modes: { [mode]: value.text }
      });
    } else if (value.text !== known.value || own.some((token) => token.name === name)) {
      tokens.set(name, { ...known, modes: { ...known.modes, [mode]: value.text } });
    }
  }
};

/**
 * Reads the files of a catalogue: the base first, then each theme over it. A theme gives a token a value when it names
 * the token, or when a reference brings it a different one. The files of one theme are one layer, the later replacing,
 * so a catalogue's dark file reaches what a library's dark file sets.
 *
 * @param inputs - the files: each source's in the catalogue's order, then the catalogue's own.
 */
export const readTokens = (inputs: readonly TokensInput[]): ParsedTokens => {
  const problems: string[] = [];
  const files = inputs.map(({ mode, ...input }) => ({ mode, raw: fileTokens({ mode, ...input }, problems) }));
  const layer = (mode: string | undefined): Map<string, RawToken> =>
    byNameOf(files.filter((file) => file.mode === mode).map((file) => file.raw));
  const base = layer(undefined);
  const tokens = new Map<string, DesignToken>();
  for (const raw of base.values()) {
    const result = resolvedValue(raw, base);
    if (typeof result !== "string") tokens.set(raw.name, tokenOf(raw, result.text, result.type));
    else problems.push(`${raw.label}: ${result}`);
  }
  for (const mode of new Set(files.flatMap((file) => (file.mode === undefined ? [] : [file.mode])))) {
    const own = [...layer(mode).values()];
    applyTheme(tokens, mode, own, themeValues(own, base, problems));
  }
  return { tokens: [...tokens.values()], problems, clashes: tokenClashes(files) };
};

/**
 * The tokens of a category: a type (`color`), or a first group (`space`).
 *
 * @param tokens - the tokens.
 * @param category - the category; none for all of them.
 */
export const filteredTokens = (tokens: readonly DesignToken[], category: string | undefined): DesignToken[] =>
  tokens.filter(
    (token) =>
      category === undefined ||
      token.type === category ||
      token.name === category ||
      token.name.startsWith(`${category}.`)
  );
