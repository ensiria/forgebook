/**
 * What a change adds, checked against the design system: the mistakes agents make, in the lines they wrote.
 *
 * @remarks
 * Pure, and it reads the change and not the project: code that was already there is not this change's to fix, and a
 * check that lists a project's history is ignored. A check people turn off is worth nothing, so it reads only the files
 * where a raw value is a mistake (styles and components), never where it belongs (stories, tests, tokens, generated
 * output), and it does not read a `#` as a colour unless it stands as a value. A raw colour is named whether or not a
 * token is close; a size only when it equals a token, since most sizes are not the design system's. A fix is the token's
 * name, not code to paste, and it is offered only when one token clearly fits: forcing the nearest is how a wrong colour
 * gets a token's name. Props are the type checker's; what a change reuses is `reuseCheck.ts`'s.
 *
 * React reads a bare number in a style object as pixels, so `padding: 16` there is a size like `16px`. The same keys are
 * options of other code (`fitView({ padding: 16 })`), and an added line seldom shows where its object starts: such a
 * number fails only on a line that says the object is a style, and is advice elsewhere.
 *
 * A token read from an application says less than one in a tokens file, which someone wrote for this use: a project's
 * `--sidebar-width: 16px` does not make every `16px` a mistake. So a size is compared with those of the same role only:
 * spacing with spacing, a radius with a radius, a font's size with a font's size. A size with no such role is left alone.
 *
 * @module
 */
import type { DesignToken } from "./designTokens.ts";
import { nearestTokens } from "./nearestToken.ts";

/** A line a change adds. */
export type AddedLine = {
  /** Its file, as the diff names it. */
  readonly file: string;
  /** Its line in the new file. */
  readonly line: number;
  /** Its text. */
  readonly text: string;
};

/** The rules. */
export type CodeRule =
  | "raw-color"
  | "raw-size"
  | "suppression"
  | "deleted-test"
  | "deprecated-component"
  | "duplicate-component"
  | "composition";

/** A value a comment says is meant. */
export type ExcusedValue = {
  /** The file, relative to the repository. */
  readonly file: string;
  /** The comment's line. */
  readonly line: number;
  /** The rule it excuses. */
  readonly rule: "raw-color" | "raw-size" | "duplicate-component" | "composition";
  /** Why, as the comment says. */
  readonly reason: string;
};

/** What a check found. */
export type CodeProblem = {
  /** The rule. */
  readonly rule: CodeRule;
  /** The file, relative to the repository. */
  readonly file: string;
  /** The line in it; none for a file that is gone. */
  readonly line?: number;
  /** What was written. */
  readonly value: string;
  /** The name of the token to use instead, when one clearly fits; a name, not code to paste. */
  readonly fix?: string;
  /** What to do, in a sentence. */
  readonly message: string;
};

/** A hex colour standing as a value: not an id, an anchor or a word that happens to start like one. */
const HEX_COLOR = /(?:^|[\s:'"`(,[=])(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))(?![0-9a-z_-])/gi;

/** A colour function, not a function of that name being declared or a template being written. */
const COLOR_FUNCTION = /(?<![\w.])(?:rgba?|hsla?|oklch|oklab)\((?![^)]*\$\{)[\d\s.,%/-]+\)/gi;

/** A size, signed or in Tailwind's brackets. */
export const SIZE = /(?:^|[\s:'"`(,[-])(\d*\.?\d+(?:px|rem))\b/g;

/** A comment that turns a check off. */
const SUPPRESSION =
  /(?:\/\/|\/\*|<!--|\{\/\*)\s*(?:@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|biome-ignore|stylelint-disable)/;

/**
 * What the check is told a value is meant, on its line or the one above: its rule and why. A value this cannot judge (a
 * default a user may change, a brand's colour) has to have a way out that says so in the code, or the whole check goes.
 */
const IGNORE_COMMENT = /(?:\/\/|\/\*|<!--)\s*forgebook-ignore\s+(raw-color|raw-size)\s*:\s*([^*\n]{3,120})/g;

/** What says why after a suppression: the repository's rule allows one with a reason. */
const HAS_REASON = /(?:biome-ignore [^:]+:\s*\S|eslint-disable[^*]*--\s*\S|@ts-expect-error\s+\S)/;

/** The files where a raw value is a mistake: styles and components. */
export const CHECKED_FILE = /\.(?:css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/;

/**
 * Where raw values belong: stories, tests, tokens and what a tool wrote; and what is drawn where a page's custom
 * properties do not reach, as an email or a generated social image.
 */
export const LEFT_ALONE =
  /(?:\.stories\.|\.test\.|\.spec\.|\.e2e\.|\.min\.|opengraph|twitter-image|(?:^|\/)_?(?:design-)?tokens?(?:\.|\/)|\.tokens?\.|(?:^|\/)theme\.|(?:^|\/)(?:__tests__|tests?|e2e|dist|build|generated|vendor|og|emails?)\/)/;

/** A style sheet. */
const SHEET_FILE = /\.(?:css|scss|sass|less)$/;

/** A test file. */
const TEST_FILE = /(?:\.test\.|\.spec\.|\.e2e\.|_test\.|(?:^|\/)(?:__tests__|tests?|e2e)\/)/;

/** A hunk's header: where its lines start in the new file. */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** A line that defines a value: a custom property or a Sass variable, where raw values belong. */
export const DEFINES_VALUE = /^\s*(?:--[\w-]+|\$[\w-]+)\s*:/;

/** How far before a size its property or class is looked for, in characters. */
const LOOK_BACK = 200;

/** Past this a line is data or a minified bundle, written by no one, and these patterns would take long to read it. */
export const LONGEST_LINE = 2000;

/** A line inside a block comment, whose start this cannot see when only added lines are read. */
const COMMENT_LINE = /^\s*\*(?:\s|\/|$)/;

/** A custom property declared in the middle of a line, as a sheet's one-line `:root { … }` does. */
const CUSTOM_PROPERTY = /(?<![\w-])--[\w-]+\s*:[^;}]*;?/g;

/** A media condition, where `var()` does not work, so a token cannot stand in. */
const MEDIA_CONDITION = /@(?:media|container)\b/;

/** A custom property read from a script, with what shows if it is missing: the token being used, as in `var()`. */
const SCRIPT_FALLBACK = /getPropertyValue\([^()]*\)[^"'`]{0,20}(?:\|\||\?\?)\s*["'`][^"'`]*["'`]/g;

/** A Vue slot's shorthand, whose name may read as a colour (`<template #add>`). */
const SLOT_SHORTHAND = /<template\s+#[\w-]+/;

/** A Tailwind class holding a mask, whose colours only give it alpha. */
const MASK_CLASS = /\bmask-\[[^\]]*\]/g;

/** A `var()` with a fallback, one level of parentheses inside it. */
const VAR_FALLBACK = /var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g;

/**
 * Where a colour is not the system's to give: the shapes of a drawing (a logo keeps its own colours), a mask (only its
 * alpha counts), a canvas, and what the browser reads from the page's head (`theme-color`), which a custom property
 * cannot reach.
 */
const NOT_A_COLOUR_OF_THE_SYSTEM =
  /^\s*(?:fill|stroke|stop-?color)=|<(?:path|circle|rect|g|stop|ellipse|polygon|polyline|line|linearGradient|radialGradient)\b|\bstop-?color\s*[=:]|(?:\b-?webkit-?|\b)mask(?:-?image)?\s*:|theme[-_]?color|<meta\b|\bmeta\d*\.|\b(?:fillStyle|strokeStyle|shadowColor)\b/i;

/**
 * A line of a table of colours, keyed by a step (`500: "#3b82f6"`): a palette shown or converted, written as data, and a
 * single table would otherwise be hundreds of findings.
 */
const PALETTE_ROW = /^\s*["']?\d+["']?\s*:\s*["'`][^"'`]*["'`],?\s*$/;

/** Black or white picked by what is underneath: the contrast of a colour a user chose, which no token can know. */
const CONTRAST_PICK = /\?\s*["'`]#(?:fff|ffffff|000|000000)["'`]\s*:\s*["'`]#(?:fff|ffffff|000|000000)["'`]/i;

/** A selector, whose `#` is an id; an object's line ends in a comma too, but holds its value in quotes. */
const SELECTOR_LINE = /\{\s*$|^[^"'`]*,\s*$/;

/** A name's last part that makes it a step of a scale. */
const SCALE_STEP = /-(?:\d+(?:\.\d+)?|\d*x[sl]|sm|md|lg|small|medium|large|tiny|huge)$/i;

/** What a size is for. */
export type SizeRole = "space" | "radius" | "font";

/** Tailwind's utilities whose arbitrary sizes have an equal on a scale. */
const UTILITY_ROLES: readonly (readonly [RegExp, SizeRole])[] = [
  [/^rounded/, "radius"],
  [/^text$/, "font"],
  [
    /^(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy]|[wh]|size|(?:min|max)-[wh]|inset(?:-[xy])?|top|right|bottom|left)$/,
    "space"
  ]
];

/** The properties whose sizes have an equal on a scale. */
const PROPERTY_ROLES: readonly (readonly [RegExp, SizeRole])[] = [
  [/radius/i, "radius"],
  [/^font-?size$/i, "font"],
  [/^(?:margin|padding|gap|row-?gap|column-?gap)/i, "space"]
];

/**
 * A line's code, without what follows a `//` or a comment's start.
 *
 * @param text - the line.
 */
export const withoutComment = (text: string): string =>
  text.replace(/(?:^|\s)\/\/.*$/, "").replace(/\/\*.*$/, "");

/**
 * The lines a unified diff adds. A header is read only outside a hunk, since an added line of `++ x` looks like one.
 *
 * @param diff - the diff, with no context lines.
 */
export const addedLines = (diff: string): AddedLine[] => {
  const lines: AddedLine[] = [];
  let file = "";
  let next = 0;
  let remaining = 0;
  for (const line of diff.split("\n")) {
    const hunk = HUNK.exec(line);
    if (hunk !== null) {
      next = Number(hunk[1]);
      remaining = Number(/\+\d+,(\d+)/.exec(line)?.[1] ?? 1);
    } else if (remaining > 0 && line.startsWith("+")) {
      lines.push({ file, line: next, text: line.slice(1) });
      next += 1;
      remaining -= 1;
    } else if (remaining === 0 && line.startsWith("+++ ")) {
      file = line.slice(4).replace(/^b\//, "").replace(/\t$/, "");
    }
  }
  return lines;
};

/**
 * Every line of a new file, as added lines: a new file is what an agent writes most, and a diff does not show it.
 *
 * @param file - the file, relative to the repository.
 * @param text - its text.
 */
export const fileLines = (file: string, text: string): AddedLine[] =>
  text.split("\n").map((line, index) => ({ file, line: index + 1, text: line }));

/**
 * The test files a change deletes: the plainest way to make a failing check pass.
 *
 * @param deleted - the files it deletes.
 */
export const deletedTests = (deleted: readonly string[]): CodeProblem[] =>
  deleted
    .filter((file) => TEST_FILE.test(file))
    .map((file) => ({
      rule: "deleted-test",
      file,
      value: file,
      message: "A test was deleted: fix what it found, or say why it no longer applies."
    }));

/** How a token is written, for a message: with the Tailwind class's end when it has one. */
const writtenAs = (name: string, tokens: readonly DesignToken[]): string => {
  const utility = tokens.find((token) => token.name === name)?.utility;
  return utility === undefined ? name : `${name} (…-${utility} in a class)`;
};

/**
 * The problem of a raw colour: a fix only from one token that holds in every theme. Two tokens with one value say what it
 * is for, which this cannot tell (white is `--card` and `--primary-foreground`), so they are named and neither is the fix.
 */
const colorProblem = (
  { file, line }: AddedLine,
  value: string,
  tokens: readonly DesignToken[]
): CodeProblem => {
  const matches = nearestTokens(tokens, value, "color").matches.filter((each) => each.isClose);
  const close = matches.filter((each) => each.mode === undefined);
  const [match] = close;
  const base = { rule: "raw-color", file, line, value } as const;
  if (match === undefined) {
    const themed = matches[0];
    return {
      ...base,
      message:
        themed === undefined
          ? "A colour written by hand, and no token is close: ask whether the design system has it."
          : `A colour written by hand: ${writtenAs(themed.name, tokens)} is ${themed.value} in the ${themed.mode ?? ""} theme, so use it if it is meant to follow the theme.`
    };
  }
  // read back from text, an equal colour may differ past what the answer rounds: zero there is the same colour
  const same = close.filter((each) => each.distance === 0);
  if (new Set(same.map((each) => each.alias ?? each.name)).size > 1) {
    const names = same.map((each) => each.name).join(" or ");
    return { ...base, message: `A colour written by hand: use ${names}, whichever it is for.` };
  }
  return {
    ...base,
    fix: match.name,
    message: `A colour written by hand: use the token ${writtenAs(match.name, tokens)} (${match.value}).`
  };
};

/** Whether a value has no alpha at all: a gradient's end, which shows nothing of its colour. */
const isFullyTransparent = (value: string): boolean => /[,/]\s*0*\.?0*%?\s*\)$/.test(value);

/** Whether a value is black or white made translucent: a shadow's or a scrim's darkening, which no palette holds. */
const isNeutralShade = (value: string): boolean =>
  /^rgba?\(\s*(?:0[\s,]+0[\s,]+0|255[\s,]+255[\s,]+255)\b/i.test(value) ||
  /^oklch\(\s*[01](?:\.0+)?%?\s+0\s+0\s*\//i.test(value) ||
  /^hsla?\(\s*0[\s,]+0%[\s,]+(?:0|100)%[\s,/]/i.test(value) ||
  /^#(?:0{6}|f{6})[0-9a-f]{2}$/i.test(value) ||
  /^#(?:0{3}|f{3})[0-9a-f]$/i.test(value);

/**
 * The colours written by hand in a line of code, leaving out what is not the system's to give.
 *
 * @param written - the line, its comment taken off.
 */
export const rawColorsOf = (written: string): readonly string[] => {
  // a fallback in `var()` is the token being used; the value is what shows only if it is missing
  const plain = written.replace(VAR_FALLBACK, "var()").replace(SCRIPT_FALLBACK, "").replace(MASK_CLASS, "");
  // a theme's pair of values is what a token is for; a pick on anything else is a contrast
  const code = /theme|mode|dark\s*[=?]/i.test(plain) ? plain : plain.replace(CONTRAST_PICK, "");
  if (SELECTOR_LINE.test(code) || /(?:href|url)\s*[=(]/.test(code)) return [];
  if (NOT_A_COLOUR_OF_THE_SYSTEM.test(code) || PALETTE_ROW.test(code)) return [];
  if (SLOT_SHORTHAND.test(code)) return [];
  // digits alone are a number more often than a colour (`Order #1042`), unless they stand as a value
  const hexes = [...code.matchAll(HEX_COLOR)]
    .flatMap((match) => match[1] ?? [])
    .filter((value) => !/^#\d+$/.test(value) || new RegExp(`[:=]\\s*['"\`]?${value}`).test(code));
  const functions = [...code.matchAll(COLOR_FUNCTION)].map((match) => match[0]);
  const isShadow = /shadow/i.test(code);
  return [...hexes, ...functions].filter(
    (value) => !isFullyTransparent(value) && !(isShadow && isNeutralShade(value))
  );
};

/** The raw colours in a line of code, as problems. */
const colorProblems = (added: AddedLine, written: string, tokens: readonly DesignToken[]): CodeProblem[] =>
  rawColorsOf(written).map((value) => colorProblem(added, value, tokens));

/**
 * What a token read from an application is for, from its name, when it is a step of a scale (`--radius-lg`, `--space-2`):
 * `--sidebar-padding` and `--custom-block-font-size` are one place's values, and do not make every equal size a mistake.
 */
const tokenRole = (name: string): SizeRole | undefined => {
  if (!SCALE_STEP.test(name)) return undefined;
  if (/radius|rounded/i.test(name)) return "radius";
  if (/^--text-|font-?size|^--fs-/i.test(name)) return "font";
  return /spac|gap|gutter|margin|padding|^--size-/i.test(name) ? "space" : undefined;
};

/**
 * What a size in a line is for, and whether a class holds it; none when it stands in a sum no token can replace.
 *
 * @param before - the line up to the size.
 */
export const roleInLine = (
  before: string
): { readonly role: SizeRole; readonly isClass: boolean } | undefined => {
  // what decides is close by: a limit keeps these patterns linear on a long line
  const near = before.slice(-LOOK_BACK);
  if (/-\[[^\]]*$/.test(near)) {
    // only where the brackets hold the value: `calc()` inside them has no class to replace it
    const utility = /(?:^|[\s"'`:])-?([a-z]+(?:-[a-z]+)*)-\[[^\](]*$/.exec(near)?.[1];
    const role = UTILITY_ROLES.find(([pattern]) => utility !== undefined && pattern.test(utility))?.[1];
    return role === undefined ? undefined : { role, isClass: true };
  }
  const [, property = "", value = ""] = /([a-zA-Z-]+)["']?\s*:([^:;{}]*)$/.exec(near) ?? [];
  if (value.split("(").length > value.split(")").length) return undefined;
  const role = PROPERTY_ROLES.find(([pattern]) => pattern.test(property))?.[1];
  return role === undefined ? undefined : { role, isClass: false };
};

/**
 * The tokens a size can be compared with where it stands: a tokens file's all, an application's of its role. Tailwind's
 * own scale counts only in a class's brackets, where a class of that scale says the same (`p-[16px]`, `p-4`): in a sheet
 * or a style, a size equal to a step of a scale nobody there chose means nothing.
 *
 * @param tokens - the tokens.
 * @param before - the line up to the size.
 */
export const sizeTokens = (tokens: readonly DesignToken[], before: string): readonly DesignToken[] => {
  const where = roleInLine(before);
  return tokens.filter((token) => {
    if (token.origin === undefined) return true;
    if (where === undefined || tokenRole(token.name) !== where.role) return false;
    return token.origin.kind !== "tailwind-default" || where.isClass;
  });
};

/** The sizes in a line that equal one token: two that do say what the size is for, which this cannot tell. */
const sizeProblems = (
  { file, line }: AddedLine,
  code: string,
  tokens: readonly DesignToken[]
): CodeProblem[] => {
  if (MEDIA_CONDITION.test(code)) return [];
  return [...code.matchAll(SIZE)].flatMap((found): CodeProblem[] => {
    const value = found[1] ?? "";
    const candidates = sizeTokens(tokens, code.slice(0, found.index + found[0].indexOf(value)));
    const exact = nearestTokens(candidates, value, "dimension").matches.filter(
      (each) => each.isExact && each.mode === undefined
    );
    const [only] = exact;
    if (only === undefined) return [];
    const fix = exact.length === 1 ? { fix: only.name } : {};
    const names = exact.map((each) => writtenAs(each.name, tokens)).join(" or ");
    return [
      { rule: "raw-size", file, line, value, ...fix, message: `A size written by hand: use ${names}.` }
    ];
  });
};

/**
 * A size a style object writes as a bare number, which React reads as pixels: `marginTop: 6`, `style={{ padding: 12 }}`,
 * a styled component's object. Only the properties whose sizes have an equal on a scale, spelled as a style object spells
 * them, and only a number that ends the value: `padding: 8 * scale` is a sum no token replaces.
 */
const OBJECT_SIZE =
  /(?:^|[\s{,(])["']?((?:margin|padding)(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd|Horizontal|Vertical)?|gap|rowGap|columnGap|fontSize|border(?:TopLeft|TopRight|BottomLeft|BottomRight|StartStart|StartEnd|EndStart|EndEnd)?Radius)["']?\s*:\s*-?(\d*\.?\d+)(?=\s*(?:[,})]|$))/g;

/** The files where a bare number in a style object is pixels: React's, which adds the unit; Vue, Svelte and Solid do not. */
const PIXELS_FOR_NUMBERS = /\.[jt]sx$/;

/**
 * What says on the line itself that an object is a style. The same keys are options elsewhere (`fitView({ padding: 0.3 })`,
 * `measureText(text, { fontSize: 12 })`, an export's `padding: 16`), and an added line seldom shows the object's start.
 */
const STYLE_OBJECT =
  /\b(?:style|sx)\s*=\s*\{\{|\bstyle\s*:\s*\{|:\s*(?:React\.)?CSSProperties\b|\bstyled(?:\.\w+|\([^)]*\))\s*\(|\bcss\(\s*\{|\bStyleSheet\.create\(/;

/** Something to weigh, which fails nothing. */
export type CodeAdvice = {
  /** The file, relative to the repository. */
  readonly file: string;
  /** The line in it. */
  readonly line: number;
  /** What to weigh, in a sentence. */
  readonly message: string;
};

/** What the checks found: what fails, and what to weigh. */
export type CodeFindings = {
  /** What fails. */
  readonly problems: readonly CodeProblem[];
  /** What to weigh. */
  readonly advice: readonly CodeAdvice[];
};

/** The role of a style object's property: the same scales as the sheet's property, which every key it reads has. */
const objectRole = (property: string): SizeRole =>
  PROPERTY_ROLES.find(([pattern]) => pattern.test(property))?.[1] ?? "space";

/**
 * The bare numbers of an object in a line that equal one token, as sizes in pixels: a problem where the line says the
 * object is a style, advice where it does not, since an option of the same name is no style.
 */
const objectSizeFindings = (
  { file, line }: AddedLine,
  code: string,
  tokens: readonly DesignToken[]
): CodeFindings => {
  if (!PIXELS_FOR_NUMBERS.test(file)) return { problems: [], advice: [] };
  const isStyle = STYLE_OBJECT.test(code);
  const found = [...code.matchAll(OBJECT_SIZE)].flatMap((match) => {
    const [, property = "", number = ""] = match;
    if (Number(number) === 0) return [];
    const role = objectRole(property);
    const candidates = tokens.filter(
      (token) =>
        token.origin === undefined ||
        (token.origin.kind !== "tailwind-default" && tokenRole(token.name) === role)
    );
    const exact = nearestTokens(candidates, `${number}px`, "dimension").matches.filter(
      (each) => each.isExact && each.mode === undefined
    );
    const [only] = exact;
    if (only === undefined) return [];
    const names = exact.map((each) => writtenAs(each.name, tokens)).join(" or ");
    return [{ value: `${property}: ${number}`, fix: exact.length === 1 ? only.name : undefined, names }];
  });
  if (!isStyle) {
    const advice = found.map(({ value, names }) => ({
      file,
      line,
      message: `\`${value}\` is a size written by hand if this object is a style: use ${names}.`
    }));
    return { problems: [], advice };
  }
  const problems = found.map(
    ({ value, fix, names }): CodeProblem => ({
      rule: "raw-size",
      file,
      line,
      value,
      ...(fix === undefined ? {} : { fix }),
      message: `A size written by hand, pixels in a style: use ${names}.`
    })
  );
  return { problems, advice: [] };
};

/** The suppression a line adds, unless it says why. */
const suppressionProblem = ({ file, line, text }: AddedLine): CodeProblem[] =>
  SUPPRESSION.test(text) && !HAS_REASON.test(text)
    ? [
        {
          rule: "suppression",
          file,
          line,
          value: text.trim(),
          message: "A check was turned off with no reason: fix what it found, or say why it is wrong here."
        }
      ]
    : [];

/**
 * Whether raw colours have something to be compared with: a tokens file is the system whatever it holds, and what an
 * application declares has to hold colours for a colour to read as a mistake.
 */
const comparesColors = (tokens: readonly DesignToken[]): boolean =>
  tokens.some((token) => token.type === "color" || token.origin === undefined);

/**
 * A file with its block comments blanked and its lines kept, so what is commented out does not count as used. A `/*` right
 * after a word or a star or a quote is a path's pattern (`src/**` then `/*.ts`), not a comment.
 *
 * @param text - the file.
 */
export const withoutBlockComments = (text: string): string => {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.slice(index).search(/(?<![*"'`\w])\/\*|<!--/);
    if (open === -1) return out + text.slice(index);
    const start = index + open;
    const close = text.startsWith("/*", start) ? "*/" : "-->";
    const end = text.indexOf(close, start + 2);
    const stop = end === -1 ? text.length : end + close.length;
    out += text.slice(index, start) + text.slice(start, stop).replace(/[^\n]/g, " ");
    index = stop;
  }
  return out;
};

/** The rules a line's comment excuses. */
const ignoredRules = (text: string): string[] =>
  [...text.matchAll(IGNORE_COMMENT)].flatMap((match) => match[1] ?? []);

/** The raw values in a line of a checked file, but for those a comment excuses. */
const valueFindings = (
  added: AddedLine,
  above: AddedLine | undefined,
  tokens: readonly DesignToken[]
): CodeFindings => {
  const none = { problems: [], advice: [] };
  if (added.text.length > LONGEST_LINE) return none;
  const written = withoutComment(added.text);
  const isSheet = SHEET_FILE.test(added.file);
  const code = isSheet ? written.replace(CUSTOM_PROPERTY, "") : written;
  // in a sheet, a line with no property continues a value started above, usually a token's
  if ((isSheet && !code.includes(":")) || COMMENT_LINE.test(code)) return none;
  const ignored = [...ignoredRules(added.text), ...(above === undefined ? [] : ignoredRules(above.text))];
  const colors = comparesColors(tokens) ? colorProblems(added, code, tokens) : [];
  const objects = objectSizeFindings(added, code, tokens);
  const problems = [...colors, ...sizeProblems(added, code, tokens), ...objects.problems];
  return {
    problems: problems.filter(({ rule }) => !ignored.includes(rule)),
    advice: ignored.includes("raw-size") ? [] : objects.advice
  };
};

/**
 * The values a change excuses with a comment: said in the answer, so a reader sees every one, and an agent gains nothing
 * by hiding a value this way.
 *
 * @param lines - the added lines.
 */
export const excusedValues = (lines: readonly AddedLine[]): ExcusedValue[] =>
  lines.flatMap(({ file, line, text }) =>
    [...text.matchAll(IGNORE_COMMENT)].map((match) => ({
      file,
      line,
      rule: match[1] === "raw-size" ? ("raw-size" as const) : ("raw-color" as const),
      reason: (match[2] ?? "").trim()
    }))
  );

/**
 * What lines a change adds break, and what they hold to weigh. Only code is read: a rule named in a sentence is not that
 * rule.
 *
 * @param lines - the added lines.
 * @param tokens - the catalogue's tokens; none skips the checks on values, which have nothing to compare with.
 */
export const codeFindings = (lines: readonly AddedLine[], tokens: readonly DesignToken[]): CodeFindings => {
  const found = lines.map((added, index): CodeFindings => {
    if (!CHECKED_FILE.test(added.file) && !/\.[cm]?[jt]s$/.test(added.file))
      return { problems: [], advice: [] };
    if (LEFT_ALONE.test(added.file)) return { problems: [], advice: [] };
    const suppression = suppressionProblem(added);
    if (tokens.length === 0 || !CHECKED_FILE.test(added.file) || DEFINES_VALUE.test(added.text))
      return { problems: suppression, advice: [] };
    const above = lines[index - 1];
    const lineAbove = above?.file === added.file && above.line === added.line - 1 ? above : undefined;
    const values = valueFindings(added, lineAbove, tokens);
    return { problems: [...suppression, ...values.problems], advice: values.advice };
  });
  return { problems: found.flatMap((each) => each.problems), advice: found.flatMap((each) => each.advice) };
};

/**
 * What lines a change adds break.
 *
 * @param lines - the added lines.
 * @param tokens - the catalogue's tokens; none skips the checks on values, which have nothing to compare with.
 */
export const checkedCode = (lines: readonly AddedLine[], tokens: readonly DesignToken[]): CodeProblem[] => [
  ...codeFindings(lines, tokens).problems
];
