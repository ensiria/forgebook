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
 * gets a token's name. Props, imports and deprecated components are not checked here.
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
export type CodeRule = "raw-color" | "raw-size" | "suppression" | "deleted-test";

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
const SIZE = /(?:^|[\s:'"`(,[-])(\d*\.?\d+(?:px|rem))\b/g;

/** A comment that turns a check off. */
const SUPPRESSION =
  /(?:\/\/|\/\*|<!--|\{\/\*)\s*(?:@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|biome-ignore|stylelint-disable)/;

/** What says why after a suppression: the repository's rule allows one with a reason. */
const HAS_REASON = /(?:biome-ignore [^:]+:\s*\S|eslint-disable[^*]*--\s*\S|@ts-expect-error\s+\S)/;

/** The files where a raw value is a mistake: styles and components. */
const CHECKED_FILE = /\.(?:css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/;

/** Where raw values belong: stories, tests, tokens and what a tool wrote. */
const LEFT_ALONE =
  /(?:\.stories\.|\.test\.|\.spec\.|\.e2e\.|\.min\.|(?:^|\/)_?(?:design-)?tokens?(?:\.|\/)|\.tokens?\.|(?:^|\/)theme\.|(?:^|\/)(?:__tests__|tests?|e2e|dist|build|generated|vendor)\/)/;

/** A test file. */
const TEST_FILE = /(?:\.test\.|\.spec\.|\.e2e\.|_test\.|(?:^|\/)(?:__tests__|tests?|e2e)\/)/;

/** A hunk's header: where its lines start in the new file. */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** A line that defines a value: a custom property or a Sass variable, where raw values belong. */
const DEFINES_VALUE = /^\s*(?:--[\w-]+|\$[\w-]+)\s*:/;

/** A media condition, where `var()` does not work, so a token cannot stand in. */
const MEDIA_CONDITION = /@(?:media|container)\b/;

/** A selector, whose `#` is an id. */
const SELECTOR_LINE = /[{,]\s*$/;

/** A line's code, without what follows a `//` or a comment's start. */
const withoutComment = (text: string): string => text.replace(/(?:^|\s)\/\/.*$/, "").replace(/\/\*.*$/, "");

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

/** The problem of a raw colour: a fix only from a token that holds in every theme. */
const colorProblem = (
  { file, line }: AddedLine,
  value: string,
  tokens: readonly DesignToken[]
): CodeProblem => {
  const match = nearestTokens(tokens, value, "color").matches.find(
    (each) => each.isClose && each.mode === undefined
  );
  return {
    rule: "raw-color",
    file,
    line,
    value,
    ...(match === undefined ? {} : { fix: match.name }),
    message:
      match === undefined
        ? "A colour written by hand, and no token is close: ask whether the design system has it."
        : `A colour written by hand: use the token ${match.name} (${match.value}).`
  };
};

/** The raw colours in a line of code. */
const colorProblems = (added: AddedLine, code: string, tokens: readonly DesignToken[]): CodeProblem[] => {
  if (SELECTOR_LINE.test(code) || /(?:href|url)\s*[=(]/.test(code)) return [];
  // digits alone are a number more often than a colour (`Order #1042`), unless they stand as a value
  const hexes = [...code.matchAll(HEX_COLOR)]
    .flatMap((match) => match[1] ?? [])
    .filter((value) => !/^#\d+$/.test(value) || new RegExp(`[:=]\\s*['"\`]?${value}`).test(code));
  const functions = [...code.matchAll(COLOR_FUNCTION)].map((match) => match[0]);
  return [...hexes, ...functions].map((value) => colorProblem(added, value, tokens));
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
    const exact = nearestTokens(tokens, value, "dimension").matches.filter(
      (each) => each.isExact && each.mode === undefined
    );
    const [only] = exact;
    if (only === undefined) return [];
    const fix = exact.length === 1 ? { fix: only.name } : {};
    const names = exact.map((each) => each.name).join(" or ");
    return [
      { rule: "raw-size", file, line, value, ...fix, message: `A size written by hand: use ${names}.` }
    ];
  });
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
 * What lines a change adds break. Only code is read: a rule named in a sentence is not that rule.
 *
 * @param lines - the added lines.
 * @param tokens - the catalogue's tokens; none skips the checks on values, which have nothing to compare with.
 */
export const checkedCode = (lines: readonly AddedLine[], tokens: readonly DesignToken[]): CodeProblem[] =>
  lines.flatMap((added): CodeProblem[] => {
    if (!CHECKED_FILE.test(added.file) && !/\.[cm]?[jt]s$/.test(added.file)) return [];
    if (LEFT_ALONE.test(added.file)) return [];
    const suppression = suppressionProblem(added);
    if (tokens.length === 0 || !CHECKED_FILE.test(added.file) || DEFINES_VALUE.test(added.text))
      return suppression;
    const code = withoutComment(added.text);
    return [...suppression, ...colorProblems(added, code, tokens), ...sizeProblems(added, code, tokens)];
  });
