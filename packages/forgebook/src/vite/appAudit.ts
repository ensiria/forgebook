/**
 * What a project actually uses: colours and sizes by how often, what is written by hand, and what the code asks of a token.
 *
 * @remarks
 * Pure: files and tokens in, a report out. Discovery and not a system imposed: on a project with no tokens it says which
 * values are the system in practice ("37 greys, 5 used 90% of the time"), and someone decides. It reads the same lines
 * `check-code` does and leaves out what that leaves out, so the two never disagree on what a raw value is. Equal colours in
 * different notations are one colour, since a palette is what the eye sees and not how a file spells it.
 *
 * @module
 */
import {
  DEFINES_VALUE,
  LEFT_ALONE,
  LONGEST_LINE,
  rawColorsOf,
  roleInLine,
  SIZE,
  type SizeRole,
  sizeTokens,
  withoutBlockComments,
  withoutComment
} from "./checkCode.ts";
import type { DesignToken, TokenSource } from "./designTokens.ts";
import { nearestTokens, type OklabColor, parsedColor } from "./nearestToken.ts";

/** A value, and how much it is used. */
export type AuditValue = {
  /** The value, as first written. */
  readonly value: string;
  /** How many times. */
  readonly count: number;
  /** In how many files. */
  readonly files: number;
  /** Of them, how many are written by hand. */
  readonly hardCoded: number;
  /** In how many files it is written by hand. */
  readonly hardCodedFiles: number;
  /** The token it is used through, or that it equals or is close to when written by hand. */
  readonly token?: string;
  /** That token's value changes with the theme, so replacing a fixed value with it changes what a theme shows. */
  readonly tokenFollowsTheme?: true;
};

/** What the colours in use come to. */
export type AuditColors = {
  /** How many uses, of any kind. */
  readonly uses: number;
  /** Through the project's own tokens. */
  readonly throughTokens: number;
  /** Through Tailwind's default palette. */
  readonly defaultPalette: number;
  /** Written by hand. */
  readonly hardCoded: number;
  /** How many different colours. */
  readonly distinct: number;
  /** The most used, of all colours. */
  readonly top: readonly AuditValue[];
  /** The most written by hand: what there is to act on, which a well-kept project's `top` does not show. */
  readonly handWritten: readonly AuditValue[];
  /** The greys. */
  readonly greys: {
    /** How many different. */
    readonly distinct: number;
    /** How many cover 90 % of their uses. */
    readonly coveringMost: number;
    /** The most used. */
    readonly top: readonly AuditValue[];
  };
  /** Colours a person would not tell apart, most used first. */
  readonly nearDuplicates: readonly (readonly string[])[];
};

/** What the sizes in use of one role come to. */
export type AuditSizes = {
  /** How many uses. */
  readonly uses: number;
  /** Written by hand: not through a token or a class of a scale. */
  readonly hardCoded: number;
  /** How many different. */
  readonly distinct: number;
  /** The most used. */
  readonly top: readonly AuditValue[];
  /** The most written by hand. */
  readonly handWritten: readonly AuditValue[];
};

/** Where a value is used. */
export type AuditSite = {
  /** The file, relative to the project. */
  readonly file: string;
  /** The line, from 1. */
  readonly line: number;
  /** The line's text, shortened. */
  readonly text: string;
  /** What the size is for; none for a colour. */
  readonly role?: SizeRole;
};

/** What the values in a project's files come to. */
export type ValueAudit = {
  /** How many files were read. */
  readonly files: number;
  /** How many lines. */
  readonly lines: number;
  /** The colours. */
  readonly colors: AuditColors;
  /** The sizes, by what they are for. */
  readonly sizes: Readonly<Record<SizeRole, AuditSizes>>;
};

/** A file to read. */
export type AuditFile = {
  /** Its path, relative to the project. */
  readonly file: string;
  /** Its text. */
  readonly text: string;
};

/** What the tokens say to the reader of a report. */
export type AuditSystem = {
  /** How many tokens are known. */
  readonly tokens: number;
  /** How many are the project's own and not Tailwind's defaults. */
  readonly own: number;
  /** What they were read from. */
  readonly sources: readonly TokenSource[];
  /** What could not be read. */
  readonly notes: readonly string[];
};

/** How many values a list gives unless asked otherwise. */
const TOP = 10;

/** Below this distance in Oklab two colours are the same to the eye. */
const NEAR = 0.02;

/** Under this chroma a colour reads as grey: a neutral with a cool cast (`#64748b`) is one, as a palette calls it. */
const GREY_CHROMA = 0.045;

/** Near white a little chroma is already a tint (`#fef2f2`), so the limit falls with this share of what lightness is left. */
const GREY_NEAR_WHITE = 0.3;

/** What the conversion leaves of chroma in a pure white. */
const ROUNDING = 0.001;

/** The share of a kind's uses the "most used" count covers. */
const MOST = 0.9;

/** How long a site's text is kept. */
const SITE_TEXT = 120;

/** A colour's class: what it paints, and the rest of the name. */
export const COLOR_CLASS =
  /(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|placeholder|shadow)-([a-z][\w-]*)(?:\/[\w.%[\]]+)?(?![\w-])/g;

/** A reference to a custom property. */
const VAR_USE = /var\(\s*(--[\w-]+)/g;

/** A spacing class on a scale. */
export const SPACE_CLASS =
  /(?<![\w-])-?(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy])-(\d+(?:\.\d+)?)(?![\w.-])/g;

/** A radius class. */
export const RADIUS_CLASS = /(?<![\w-])rounded(?:-[trblse]{1,2})?-(xs|sm|md|lg|xl|2xl|3xl|4xl)(?![\w-])/g;

/** A font's size class. */
export const FONT_CLASS = /(?<![\w-])text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g;

/** A size as a number in a style object, which has no unit to find it by. */
const STYLE_NUMBER =
  /\b(margin|padding|gap|rowGap|columnGap|fontSize|borderRadius)(?:Top|Right|Bottom|Left|Inline|Block|Start|End|X|Y)*\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/g;

/** What a style object's property is for. */
const STYLE_ROLES: Readonly<Record<string, SizeRole>> = {
  margin: "space",
  padding: "space",
  gap: "space",
  rowGap: "space",
  columnGap: "space",
  fontSize: "font",
  borderRadius: "radius"
};

/** The files read for values: what `check-code` reads. */
const IS_READ = /\.(?:css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/;

/** One colour's tally. */
type Tally = {
  value: string;
  count: number;
  hardCoded: number;
  files: Set<string>;
  hardFiles: Set<string>;
  /** The token a use went through, the first of them. */
  through?: string;
  /** The token a size written by hand equals. */
  suggested?: string;
};

/** Adds a use to a tally by a key. */
const tallied = (
  tallies: Map<string, Tally>,
  key: string,
  value: string,
  file: string,
  how: {
    readonly isHard: boolean;
    readonly token?: string | undefined;
    readonly suggested?: string | undefined;
  }
): void => {
  const known = tallies.get(key) ?? { value, count: 0, hardCoded: 0, files: new Set(), hardFiles: new Set() };
  tallies.set(key, known);
  known.count += 1;
  known.files.add(file);
  if (how.isHard) {
    known.hardCoded += 1;
    known.hardFiles.add(file);
  }
  if (how.token !== undefined) known.through ??= how.token;
  if (how.suggested !== undefined) known.suggested ??= how.suggested;
};

/** A colour's key: the same colour in any notation has one. */
const colorKey = (color: OklabColor): string =>
  [color.l, color.a, color.b, color.alpha].map((part) => part.toFixed(3)).join(" ");

/** The tallies as values, the most used first. */
const valuesOf = (tallies: readonly Tally[]): Tally[] => tallies.toSorted((a, b) => b.count - a.count);

/** A tally as a report gives it, with the token that fits when asked about colours. */
const reported = ({ value, count, hardCoded, files, hardFiles }: Tally, token?: string): AuditValue => ({
  value,
  count,
  files: files.size,
  hardCoded,
  hardCodedFiles: hardFiles.size,
  ...(token === undefined ? {} : { token })
});

/** The token a raw colour equals or is close to, that holds in every theme. */
const tokenFor = (tokens: readonly DesignToken[], value: string): DesignToken | undefined => {
  const name = nearestTokens(tokens, value, "color").matches.find(
    (match) => match.isClose && match.mode === undefined
  )?.name;
  return tokens.find((token) => token.name === name);
};

/** A value written by hand, with the token that fits it. */
const reportedColor = (each: Tally, tokens: readonly DesignToken[]): AuditValue => {
  const token = tokenFor(tokens, each.value);
  const follows = token !== undefined && Object.values(token.modes).some((value) => value !== token.value);
  return { ...reported(each, token?.name), ...(follows ? { tokenFollowsTheme: true as const } : {}) };
};

/**
 * Colours the eye would hardly tell apart, each group once, the most used first. Two tokens close together are a choice
 * (a page and a card a step apart), so a group counts only with a colour written by hand in it.
 */
const nearGroups = (tallies: readonly Tally[]): (readonly string[])[] => {
  const groups: { color: OklabColor; values: string[]; hasHandWritten: boolean }[] = [];
  for (const { value, hardCoded } of valuesOf(tallies)) {
    const color = parsedColor(value);
    if (color === undefined) continue;
    const near = groups.find(
      ({ color: other }) =>
        Math.hypot(color.l - other.l, color.a - other.a, color.b - other.b) < NEAR &&
        color.alpha === other.alpha
    );
    if (near === undefined) groups.push({ color, values: [value], hasHandWritten: hardCoded > 0 });
    else {
      near.values.push(value);
      near.hasHandWritten ||= hardCoded > 0;
    }
  }
  return groups
    .filter(({ values, hasHandWritten }) => values.length > 1 && hasHandWritten)
    .map(({ values }) => values);
};

/** How many of the most used values it takes to cover most uses. */
const coveringMost = (sorted: readonly Tally[]): number => {
  const total = sorted.reduce((sum, each) => sum + each.count, 0);
  let covered = 0;
  for (const [index, each] of sorted.entries()) {
    covered += each.count;
    if (covered >= total * MOST) return index + 1;
  }
  return sorted.length;
};

/** Where a project's colours and sizes are tallied. */
type Tallies = {
  readonly colors: Map<string, Tally>;
  readonly sizes: Readonly<Record<SizeRole, Map<string, Tally>>>;
  throughTokens: number;
  defaultPalette: number;
};

/** Tokens by what code writes for them. */
type TokenIndex = {
  /** By a colour class's end. */
  readonly colorUtilities: ReadonlyMap<string, DesignToken>;
  /** By name. */
  readonly byName: ReadonlyMap<string, DesignToken>;
};

/** A colour used through a token. */
const talliedToken = (found: Tallies, token: DesignToken, file: string): void => {
  const color = parsedColor(token.value);
  const key = color === undefined ? token.name : colorKey(color);
  tallied(found.colors, key, token.value, file, { isHard: false, token: token.name });
  if (token.origin?.kind === "tailwind-default") found.defaultPalette += 1;
  else found.throughTokens += 1;
};

/** The colours in a line. */
const readColors = (found: Tallies, index: TokenIndex, code: string, file: string): void => {
  for (const value of rawColorsOf(code)) {
    const color = parsedColor(value);
    tallied(found.colors, color === undefined ? value : colorKey(color), value, file, { isHard: true });
  }
  for (const match of code.matchAll(COLOR_CLASS)) {
    const token = index.colorUtilities.get(match[1] ?? "");
    if (token !== undefined) talliedToken(found, token, file);
  }
  for (const match of code.matchAll(VAR_USE)) {
    const token = index.byName.get(match[1] ?? "");
    if (token?.type === "color") talliedToken(found, token, file);
  }
};

/** A size in pixels as a key, a rem being 16: one size in any unit is one size. */
const sizeKey = (value: string): string => {
  const match = /^(-?\d*\.?\d+)(px|rem)?$/.exec(value);
  return match === null ? value : `${Math.abs(Number(match[1]) * (match[2] === "rem" ? 16 : 1))}px`;
};

/** A class's box and not a space between things: a width of 240px is not a spacing to name. */
const BOX_CLASS =
  /(?:^|[\s"'`:])-?(?:[wh]|size|(?:min|max)-[wh]|inset(?:-[xy])?|top|right|bottom|left)-\[[^\]]*$/;

/** A size this small is a hairline or nothing, and no scale's business. */
const SMALLEST_TOLD = 2;

/** A size written by hand in a line. */
type HandSize = {
  /** The size in pixels, as a key. */
  readonly key: string;
  /** What it is for. */
  readonly role: SizeRole;
  /** The line up to it; none for a number in a style object. */
  readonly before?: string;
  /** As written. */
  readonly value: string;
};

/** The sizes written by hand in a line: what a report counts and what `--value` lists are this one reading. */
const handSizesOf = (code: string): HandSize[] => [
  ...[...code.matchAll(SIZE)].flatMap((match): HandSize[] => {
    const value = match[1] ?? "";
    const before = code.slice(0, match.index + match[0].indexOf(value));
    const where = roleInLine(before);
    const key = sizeKey(value);
    return where === undefined || BOX_CLASS.test(before) || Number.parseFloat(key) < SMALLEST_TOLD
      ? []
      : [{ key, role: where.role, before, value }];
  }),
  ...[...code.matchAll(STYLE_NUMBER)].flatMap((match): HandSize[] => {
    const role = STYLE_ROLES[match[1] ?? ""];
    const key = sizeKey(match[2] ?? "");
    return role === undefined || Number.parseFloat(key) < SMALLEST_TOLD
      ? []
      : [{ key, role, value: `${match[2] ?? ""}px` }];
  })
];

/** The sizes written by hand in a line, each with the token of its role that equals it. */
const readHandSizes = (found: Tallies, tokens: readonly DesignToken[], code: string, file: string): void => {
  for (const { key, role, before, value } of handSizesOf(code)) {
    const candidates = before === undefined ? [] : sizeTokens(tokens, before);
    const suggested = nearestTokens(candidates, value, "dimension").matches.find(
      (each) => each.isExact && each.mode === undefined
    )?.name;
    tallied(found.sizes[role], key, key, file, { isHard: true, suggested });
  }
};

/** The sizes in a line through a class of a scale. */
const readClassSizes = (found: Tallies, index: TokenIndex, code: string, file: string): void => {
  const classes: readonly (readonly [RegExp, SizeRole, string])[] = [
    [SPACE_CLASS, "space", "--spacing-"],
    [RADIUS_CLASS, "radius", "--radius-"],
    [FONT_CLASS, "font", "--text-"]
  ];
  for (const [pattern, role, prefix] of classes) {
    for (const match of code.matchAll(pattern)) {
      const token = index.byName.get(`${prefix}${match[1]}`);
      if (token !== undefined) {
        const key = sizeKey(token.value);
        tallied(found.sizes[role], key, key, file, { isHard: false, token: token.name });
      }
    }
  }
};

/** A role's sizes as a report gives them. */
const sizesOf = (tallies: ReadonlyMap<string, Tally>, top: number): AuditSizes => {
  const sorted = valuesOf([...tallies.values()]);
  return {
    uses: sorted.reduce((sum, each) => sum + each.count, 0),
    hardCoded: sorted.reduce((sum, each) => sum + each.hardCoded, 0),
    distinct: sorted.length,
    top: sorted.slice(0, top).map((each) => reported(each, each.through ?? each.suggested)),
    handWritten: sorted
      .filter((each) => each.hardCoded > 0)
      .toSorted((first, second) => second.hardCoded - first.hardCoded)
      .slice(0, top)
      .map((each) => reported(each, each.suggested))
  };
};

/** The colours as a report gives them. */
const colorsOf = (found: Tallies, tokens: readonly DesignToken[], top: number): AuditColors => {
  const sorted = valuesOf([...found.colors.values()]);
  const greys = sorted.filter(({ value }) => {
    const color = parsedColor(value);
    if (color === undefined || color.alpha !== 1) return false;
    return Math.hypot(color.a, color.b) <= Math.min(GREY_CHROMA, (1 - color.l) * GREY_NEAR_WHITE) + ROUNDING;
  });
  const withToken = (each: Tally): AuditValue =>
    each.through === undefined ? reportedColor(each, tokens) : reported(each, each.through);
  return {
    uses: sorted.reduce((sum, each) => sum + each.count, 0),
    throughTokens: found.throughTokens,
    defaultPalette: found.defaultPalette,
    hardCoded: sorted.reduce((sum, each) => sum + each.hardCoded, 0),
    distinct: sorted.length,
    top: sorted.slice(0, top).map(withToken),
    handWritten: sorted
      .filter((each) => each.hardCoded > 0)
      .toSorted((first, second) => second.hardCoded - first.hardCoded)
      .slice(0, top)
      .map((each) => reportedColor(each, tokens)),
    greys: {
      distinct: greys.length,
      coveringMost: coveringMost(greys),
      top: greys.slice(0, top).map(withToken)
    },
    nearDuplicates: nearGroups(sorted).slice(0, top)
  };
};

/** The lines of a file worth reading for values. */
const codeLines = ({ file, text }: AuditFile): readonly { line: number; code: string; text: string }[] => {
  if (!IS_READ.test(file) || LEFT_ALONE.test(file)) return [];
  return withoutBlockComments(text)
    .split("\n")
    .flatMap((plain, index) =>
      plain.length > LONGEST_LINE || DEFINES_VALUE.test(plain)
        ? []
        : [
            {
              line: index + 1,
              code: withoutComment(plain).replace(/(?<![\w-])--[\w-]+\s*:[^;}]*;?/g, ""),
              text: withoutComment(plain)
            }
          ]
    );
};

/**
 * What a project's files use.
 *
 * @param files - its files.
 * @param tokens - the tokens known; none is a report on values alone.
 * @param top - how many values a list gives; 10 by default.
 */
export const valueAudit = (
  files: readonly AuditFile[],
  tokens: readonly DesignToken[],
  top: number = TOP
): ValueAudit => {
  const index: TokenIndex = {
    colorUtilities: new Map(
      tokens.flatMap((token) =>
        token.type === "color" && token.utility !== undefined ? [[token.utility, token]] : []
      )
    ),
    byName: new Map(tokens.map((token) => [token.name, token]))
  };
  const found: Tallies = {
    colors: new Map(),
    sizes: { space: new Map(), radius: new Map(), font: new Map() },
    throughTokens: 0,
    defaultPalette: 0
  };
  let lines = 0;
  let read = 0;
  for (const each of files) {
    const code = codeLines(each);
    if (code.length > 0) read += 1;
    lines += code.length;
    for (const { code: written } of code) {
      readColors(found, index, written, each.file);
      readHandSizes(found, tokens, written, each.file);
      readClassSizes(found, index, written, each.file);
    }
  }
  return {
    files: read,
    lines,
    colors: colorsOf(found, tokens, top),
    sizes: {
      space: sizesOf(found.sizes.space, top),
      radius: sizesOf(found.sizes.radius, top),
      font: sizesOf(found.sizes.font, top)
    }
  };
};

/**
 * Where a value written by hand stands: what an agent replacing it edits.
 *
 * @param files - the project's files.
 * @param value - the value, as code writes it; a colour matches in any notation.
 */
export const valueSites = (files: readonly AuditFile[], value: string): AuditSite[] => {
  const wanted = parsedColor(value);
  const site = (file: string, line: number, text: string, role?: SizeRole): AuditSite => ({
    file,
    line,
    text: text.trim().slice(0, SITE_TEXT),
    ...(role === undefined ? {} : { role })
  });
  return files.flatMap((each) =>
    codeLines(each).flatMap(({ line, code, text }) => {
      if (wanted === undefined) {
        const roles = handSizesOf(code).filter(({ key }) => key === sizeKey(value));
        return roles.map(({ role }) => site(each.file, line, text, role));
      }
      const isIt = rawColorsOf(code).some((written) => {
        const color = parsedColor(written);
        return color !== undefined && colorKey(color) === colorKey(wanted);
      });
      return isIt ? [site(each.file, line, text)] : [];
    })
  );
};
