/**
 * A code fence's whole line read, and its code drawn by it: a title, marked lines, inserted and deleted lines, a diff
 * coloured in its own language, and long lines wrapped.
 *
 * @remarks
 * The line after the backticks is written as Expressive Code and VitePress write it, so an author knows it: the
 * language, then `title="Button.tsx"`, the marked lines in braces (`1,4-6`), `ins=` and `del=` with lines in braces,
 * and `wrap`; a `diff` fence takes `lang="tsx"`, so its `+` and `-` lines keep the colours of their language. Everything is done here, at build time: the page gets HTML
 * whose lines are elements (`<mark>`, `<ins>`, `<del>`), so a screen reader hears what changed and the shell needs no
 * script for it. The copied text is the code as it reads after the change: its diff signs taken off and its deleted
 * lines left out, so what is pasted runs. Pure.
 *
 * @module
 */
import type { PageNote, SourcePosition } from "./docDirectives.ts";
import { highlightCode } from "./highlightCode.ts";

/** What a code fence's line says. */
export type FenceInfo = {
  /** The language the code is coloured in; none leaves it plain. */
  readonly language: string | undefined;
  /** Its title, a file's name most often; none when it has none. */
  readonly title: string | undefined;
  /** The lines marked, from 1. */
  readonly marked: ReadonlySet<number>;
  /** The lines inserted, from 1. */
  readonly inserted: ReadonlySet<number>;
  /** The lines deleted, from 1. */
  readonly deleted: ReadonlySet<number>;
  /** Whether it is a diff, whose lines start with `+`, `-` or a space. */
  readonly isDiff: boolean;
  /** Whether long lines wrap instead of scrolling. */
  readonly isWrapped: boolean;
};

/** A code block as the page draws it. */
export type FencedCode = {
  /** The code as the copy button copies it. */
  readonly text: string;
  /** The code as HTML, coloured, its lines elements when some are marked. */
  readonly html: string;
  /** Its language, when it has one. */
  readonly language: string | undefined;
  /** Its title, when it has one. */
  readonly title: string | undefined;
  /** Whether long lines wrap. */
  readonly isWrapped: boolean;
};

/** The class of every line of a block whose lines are elements. */
const LINE_CLASS = "forgebook-code-line";

/** One word of a fence's line, and where it starts in it. */
type FenceWord = { readonly text: string; readonly offset: number };

/** A fence's line split into words: a quoted value or braces stay whole. */
const fenceWords = (info: string): FenceWord[] => {
  const words: FenceWord[] = [];
  const pattern =
    /(?:[^\s"'{=]+(?:=(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\{[^}]*\}|[^\s]*))?|\{[^}]*\}|"[^"]*"|\S+)/g;
  for (const match of info.matchAll(pattern)) words.push({ text: match[0], offset: match.index });
  return words;
};

/** The highest line a fence may name. */
const MAX_LINE = 100_000;

/**
 * The lines a range list names: `1,4-6` is 1, 4, 5 and 6.
 *
 * @param text - the list, without its braces.
 * @returns the lines, or none when the list cannot be read.
 */
const rangeLines = (text: string): Set<number> | undefined => {
  const lines = new Set<number>();
  for (const part of text.split(",")) {
    const range = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (range?.[1] === undefined) return undefined;
    const from = Number(range[1]);
    const to = range[2] === undefined ? from : Number(range[2]);
    // a range no code can hold is a mistake, and would fill the set with millions of lines
    if (from < 1 || to < from || to > MAX_LINE) return undefined;
    for (let line: number = from; line <= to; line += 1) lines.add(line);
  }
  return lines;
};

/** A value without its quotes or braces, its escapes read. */
const bareValue = (value: string): string => {
  const first = value.charAt(0);
  if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1)
    return value.slice(1, -1).replace(/\\(.)/g, "$1");
  return value;
};

/** A fence's line as it is read: what `FenceInfo` holds, its sets filled word by word. */
type FenceReading = {
  language: string | undefined;
  title: string | undefined;
  isWrapped: boolean;
  readonly marked: Set<number>;
  readonly inserted: Set<number>;
  readonly deleted: Set<number>;
};

/** The words that name lines, and the set each fills. */
const RANGE_KEYS: Readonly<Record<string, "marked" | "inserted" | "deleted">> = {
  mark: "marked",
  ins: "inserted",
  del: "deleted"
};

/**
 * Adds the lines a `{1,4-6}` list names to a set, or notes that it is no list.
 *
 * @param target - the set.
 * @param value - the list, with its braces.
 * @param position - where it starts, for the note.
 * @param notes - receives what cannot be read.
 */
const addRanges = (target: Set<number>, value: string, position: SourcePosition, notes: PageNote[]): void => {
  const lines = value.startsWith("{") && value.endsWith("}") ? rangeLines(value.slice(1, -1)) : undefined;
  if (lines === undefined) {
    notes.push({ position, message: `"${value}" is not a list of lines: write {1,4-6}` });
    return;
  }
  for (const line of lines) target.add(line);
};

/**
 * Reads one word of a fence's line into what it says.
 *
 * @param word - the word.
 * @param isDiff - whether the fence is a diff, the one that takes `lang`.
 * @param reading - what the line says so far.
 * @param at - the position of a place of the line.
 * @param notes - receives what cannot be read.
 */
const readFenceWord = (
  { text, offset }: FenceWord,
  isDiff: boolean,
  reading: FenceReading,
  at: (offset: number) => SourcePosition,
  notes: PageNote[]
): void => {
  if (text.startsWith("{")) {
    addRanges(reading.marked, text, at(offset), notes);
    return;
  }
  if (text === "wrap") {
    reading.isWrapped = true;
    return;
  }
  const equals = text.indexOf("=");
  const key = equals === -1 ? text : text.slice(0, equals);
  const value = equals === -1 ? "" : text.slice(equals + 1);
  const range = RANGE_KEYS[key];
  if (range !== undefined) {
    addRanges(reading[range], value, at(offset + equals + 1), notes);
    return;
  }
  if (key === "title" && value !== "") {
    reading.title = bareValue(value);
    return;
  }
  if (key === "lang" && isDiff && value !== "") {
    reading.language = bareValue(value);
    return;
  }
  const hint =
    key === "lang"
      ? '`lang` goes with a diff (```diff lang="tsx")'
      : 'it reads title="…", {1,4-6}, ins={…}, del={…} and wrap';
  notes.push({ position: at(offset), message: `the code fence's "${text}" is not read: ${hint}` });
};

/**
 * What a code fence's line says, every word it does not read reported where it is.
 *
 * @param info - the line after the backticks.
 * @param start - where the line starts in the file, for the notes.
 * @param notes - receives what cannot be read.
 */
export const fenceInfo = (info: string, start: SourcePosition, notes: PageNote[]): FenceInfo => {
  const at = (offset: number): SourcePosition => ({ line: start.line, column: start.column + offset });
  const words = fenceWords(info);
  const first = words[0];
  const named =
    first !== undefined && first.text !== "wrap" && !first.text.includes("=") && !/^[{"]/.test(first.text)
      ? first.text
      : undefined;
  const isDiff = named === "diff";
  const reading: FenceReading = {
    language: isDiff ? undefined : named,
    title: undefined,
    isWrapped: false,
    marked: new Set(),
    inserted: new Set(),
    deleted: new Set()
  };
  for (const word of named === undefined ? words : words.slice(1))
    readFenceWord(word, isDiff, reading, at, notes);
  return { ...reading, isDiff };
};

/**
 * Coloured HTML split at its lines, every span closed at a line's end and opened again on the next, so each line can
 * be an element of its own.
 *
 * @param html - the coloured code.
 */
export const htmlLines = (html: string): string[] => {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";
  for (const part of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (part === "\n") {
      lines.push(current + "</span>".repeat(open.length));
      current = open.join("");
    } else if (part.startsWith("<span")) {
      open.push(part);
      current += part;
    } else if (part === "</span>") {
      open.pop();
      current += part;
    } else current += part;
  }
  lines.push(current);
  return lines;
};

/** What a line of a block is: marked, inserted, deleted or plain. */
type LineKind = "mark" | "ins" | "del" | "plain";

/** The kind of line each sign of a diff starts. */
const DIFF_SIGNS: Readonly<Record<string, LineKind>> = { "+": "ins", "-": "del" };

/** A patch's file headers (`--- a/x`, `+++ b/x`): plain lines, never a deletion or an insertion. */
const PATCH_HEADER = /^(---|\+\+\+)( |$)/;

/**
 * A diff's lines and the kind of each. A diff in a language (`lang="tsx"`) is code whose signs come off, so it is
 * coloured and copied as code; one without is a patch, kept as written, so what is copied still applies.
 *
 * @param code - the diff.
 * @param isCode - whether its signs come off.
 */
const diffLines = (code: string, isCode: boolean): { readonly code: string; readonly kinds: LineKind[] } => {
  const kinds: LineKind[] = [];
  const lines = code.split("\n").map((line) => {
    const sign = line.charAt(0);
    kinds.push(PATCH_HEADER.test(line) ? "plain" : (DIFF_SIGNS[sign] ?? "plain"));
    return isCode && (sign === "+" || sign === "-" || sign === " ") ? line.slice(1) : line;
  });
  return { code: lines.join("\n"), kinds };
};

/** Whether a fence is a diff of code in a language, whose signs come off: a diff without one is a patch. */
const isCodeDiff = (info: FenceInfo): boolean => info.isDiff && info.language !== undefined;

/** A line as an element of its kind. */
const lineElement = (html: string, kind: LineKind): string => {
  const element = kind === "plain" ? "span" : kind;
  return `<${element} class="${LINE_CLASS}">${html}</${element}>`;
};

/**
 * Each line coloured, the code before the change and after it apart: a deleted line that leaves a string or a comment
 * open would otherwise colour the inserted line after it as part of it.
 *
 * @param code - the code, its diff signs taken off.
 * @param kinds - each line's kind.
 * @param language - the language it is coloured in.
 */
const coloredLines = (code: string, kinds: readonly LineKind[], language: string | undefined): string[] => {
  const lines = code.split("\n");
  if (!kinds.includes("del")) return htmlLines(highlightCode(code, language));
  const version = (left: LineKind): { readonly places: number[]; readonly html: string[] } => {
    const places = lines.flatMap((_line, index) => (kinds[index] === left ? [] : [index]));
    const html = htmlLines(highlightCode(places.map((index) => lines[index] ?? "").join("\n"), language));
    return { places, html };
  };
  const coloured: string[] = [];
  for (const { places, html } of [version("ins"), version("del")]) {
    places.forEach((index, at) => {
      coloured[index] ??= html[at] ?? "";
    });
  }
  return lines.map((_line, index) => coloured[index] ?? "");
};

/**
 * A diff's code without its signs, or the code itself.
 *
 * @param code - the code as the fence holds it.
 * @param info - what its fence's line says.
 */
const shownCode = (code: string, info: FenceInfo): string =>
  info.isDiff ? diffLines(code, isCodeDiff(info)).code : code;

/**
 * The first line a fence names that its code does not have; none when every line it names is there.
 *
 * @param code - the code as the fence holds it.
 * @param info - what its fence's line says.
 * @returns the line, and how many the code has.
 */
export const missingLine = (
  code: string,
  info: FenceInfo
): { readonly line: number; readonly count: number } | undefined => {
  const count = shownCode(code, info).split("\n").length;
  const beyond = [...info.marked, ...info.inserted, ...info.deleted].filter((line) => line > count);
  return beyond.length === 0 ? undefined : { line: Math.min(...beyond), count };
};

/**
 * A fenced block's code as the page draws it.
 *
 * @param code - the code as the fence holds it.
 * @param info - what its fence's line says.
 */
export const fencedCode = (code: string, info: FenceInfo): FencedCode => {
  const diff = info.isDiff ? diffLines(code, isCodeDiff(info)) : undefined;
  const plain = shownCode(code, info);
  const base = { language: info.language, title: info.title, isWrapped: info.isWrapped };
  if (diff === undefined && info.marked.size + info.inserted.size + info.deleted.size === 0) {
    return { ...base, text: code, html: highlightCode(code, info.language) };
  }
  const kinds: LineKind[] = plain.split("\n").map((_line, index): LineKind => {
    const line = index + 1;
    if (info.deleted.has(line)) return "del";
    if (info.inserted.has(line)) return "ins";
    if (info.marked.has(line)) return "mark";
    return diff?.kinds[index] ?? "plain";
  });
  const html = coloredLines(plain, kinds, info.language)
    .map((line, index) => lineElement(line, kinds[index] ?? "plain"))
    .join("\n");
  // a patch is copied whole, to apply; code is copied as it reads after the change
  const isPatch = info.isDiff && !isCodeDiff(info);
  const text = isPatch
    ? plain
    : plain
        .split("\n")
        .filter((_line, index) => kinds[index] !== "del")
        .join("\n");
  return { ...base, text, html };
};
