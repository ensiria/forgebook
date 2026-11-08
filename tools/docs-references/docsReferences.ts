/**
 * What the user documentation in `docs/` claims about the code, read so a test can hold it to the code: the messages the
 * troubleshooting page quotes, which must still be printed by the packages, and the `forgebook` commands and options the
 * pages name, which must still exist.
 *
 * @remarks
 * Pure: text in, findings out. `docsReferences.test.ts` reads the files, the sources and the command's description.
 *
 * @module
 */

/** A line of a page, with where it is. */
export type PageLine = {
  /** The line's number in the page, from 1. */
  readonly line: number;
  /** Its text. */
  readonly text: string;
};

/** A text the source can print: its fixed parts, between the values a template fills in. */
export type SourceText = {
  /** The fixed parts in order; a template's holes sit between them. One part for a plain string. */
  readonly parts: readonly string[];
};

/** A `forgebook` command line named by a page. */
export type NamedCommand = PageLine & {
  /** The command's name (`init`). */
  readonly command: string;
  /** The options given to it, without their dashes or values (`agents`, `hooks`). */
  readonly options: readonly string[];
};

/** A fence's language and its lines, with the first line's number. */
type Fence = { readonly language: string; readonly lines: readonly PageLine[] };

/**
 * The shortest fixed text a template must hold to stand for a message whose filled-in values are words with no space
 * (a file, a key): shorter ones match nearly anything.
 */
const MIN_TEMPLATE_TEXT = 8;

/**
 * The shortest fixed text a template must hold for its values to be read as any text, spaces included (a list): below
 * it, `No ${file} here` would also print "No file was found here".
 */
const MIN_TEMPLATE_TEXT_ANY_VALUE = 24;

/** The shortest piece of a quoted message worth looking for; shorter ones are punctuation around a placeholder. */
const MIN_FRAGMENT = 4;

/** What a command prints before a line: the error, warning and next-step marks, and the hint's indent. */
const LINE_MARK = /^\s*(?:[✗!›✓]\s+)?/u;

/** A placeholder of the page, standing for a value of the reader's project (`<file>`). */
const PLACEHOLDER = /<[^<>]+>/g;

/** The punctuation a fragment may start or end with, left over around a placeholder. */
const EDGE_PUNCTUATION = /^[\s:;,.()"'`]+|[\s:;,.()"'`]+$/g;

/**
 * A `forgebook` command in a line of shell: its name, then what follows up to a comment or another command. A
 * `forgebook` that is an option's value, the package `pnpm --filter forgebook test` picks, runs no command of its own.
 */
const COMMAND_IN_LINE = /(?:^|[\s`(])(?<!(?:--filter|-F) )forgebook ([a-z][a-z-]*)((?:[^#`;|&]*))/g;

/** An option given on a command line, without its value. */
const OPTION = /(?:^|\s)--([a-z][a-z0-9-]*)/g;

/**
 * The fences of a Markdown page, with their language and lines. A fence of four backticks or more holds the shorter
 * ones as its text, as CommonMark reads it.
 *
 * @param markdown - the page.
 */
export const fencesOf = (markdown: string): readonly Fence[] => {
  const fences: Fence[] = [];
  let open: { readonly marker: string; readonly language: string; readonly lines: PageLine[] } | undefined;
  markdown.split("\n").forEach((text, index) => {
    const fence = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/.exec(text);
    if (open === undefined) {
      if (fence !== null)
        open = { marker: fence[1] ?? "```", language: (fence[2] ?? "").toLowerCase(), lines: [] };
      return;
    }
    if (fence !== null && fence[2] === "" && (fence[1] ?? "").startsWith(open.marker)) {
      fences.push({ language: open.language, lines: open.lines });
      open = undefined;
      return;
    }
    open.lines.push({ line: index + 1, text });
  });
  return fences;
};

/**
 * The messages a troubleshooting page quotes: every line of its `text` fences, without the marks a command prints
 * before it.
 *
 * @param markdown - the page.
 */
export const quotedMessages = (markdown: string): readonly PageLine[] =>
  fencesOf(markdown)
    .filter((fence) => fence.language === "text")
    .flatMap((fence) => fence.lines)
    .map(({ line, text }) => ({ line, text: text.replace(LINE_MARK, "").trim() }))
    .filter(({ text }) => text !== "");

/** What may stand before a `/` that opens a regular expression rather than divides. */
const BEFORE_REGEX = /[(,=:[!&|?{};+\-*%<>~^]$/;

/** A scan's place in a source: the next character to read. */
type Cursor = { at: number };

/**
 * Reads a quoted string from its opening quote, and leaves the cursor past its closing one.
 *
 * @returns its text, with an escaped character as the character.
 */
const readString = (source: string, cursor: Cursor): string => {
  const quote = source[cursor.at];
  let text = "";
  cursor.at += 1;
  while (cursor.at < source.length && source[cursor.at] !== quote && source[cursor.at] !== "\n") {
    if (source[cursor.at] === "\\") cursor.at += 1;
    text += source[cursor.at] ?? "";
    cursor.at += 1;
  }
  cursor.at += 1;
  return text;
};

/** Skips a regular expression from its opening slash to past its closing one, over escapes and character classes. */
const skipRegex = (source: string, cursor: Cursor): void => {
  let isInClass = false;
  cursor.at += 1;
  while (cursor.at < source.length && source[cursor.at] !== "\n") {
    const char = source[cursor.at];
    if (char === "\\") cursor.at += 1;
    else if (char === "[") isInClass = true;
    else if (char === "]") isInClass = false;
    else if (char === "/" && !isInClass) break;
    cursor.at += 1;
  }
  cursor.at += 1;
};

/**
 * Skips what holds no text a command prints, where the cursor stands: a comment, or a regular expression (whose
 * quotes start no string).
 *
 * @param previous - the last character of code before the cursor, which tells a regular expression from a division.
 * @returns whether it skipped anything.
 */
const skipNoText = (source: string, cursor: Cursor, previous: string): boolean => {
  if (source[cursor.at] !== "/") return false;
  const next = source[cursor.at + 1];
  if (next === "/" || next === "*") {
    const end = next === "/" ? source.indexOf("\n", cursor.at) : source.indexOf("*/", cursor.at + 2);
    cursor.at = end === -1 ? source.length : end + (next === "/" ? 0 : 2);
    return true;
  }
  if (previous !== "" && !BEFORE_REGEX.test(previous)) return false;
  skipRegex(source, cursor);
  return true;
};

/** The characters that open a string or a template. */
const QUOTES = ['"', "'", "`"];

/** Reads the string or template the cursor stands on, and gives its fixed parts. */
const readQuoted = (source: string, cursor: Cursor, texts: SourceText[]): readonly string[] =>
  source[cursor.at] === "`" ? readTemplate(source, cursor, texts) : [readString(source, cursor)];

/** How a brace changes the depth of the code's blocks. */
const BRACE_DEPTH: Readonly<Record<string, number>> = { "{": 1, "}": -1 };

/** Where a scan of code stands: how deep in its own braces, and its last character of code. */
type CodeState = { depth: number; previous: string };

/**
 * Reads one piece of code where the cursor stands: a comment or a regular expression skipped, a string or a template
 * collected, or one character.
 *
 * @returns whether that character was a `}` closing more than the code opened.
 */
const readPiece = (source: string, cursor: Cursor, texts: SourceText[], state: CodeState): boolean => {
  const char = source[cursor.at] ?? "";
  if (skipNoText(source, cursor, state.previous)) {
    state.previous = "/";
    return false;
  }
  if (QUOTES.includes(char)) {
    texts.push({ parts: readQuoted(source, cursor, texts) });
    state.previous = char;
    return false;
  }
  cursor.at += 1;
  if (char === "}" && state.depth === 0) return true;
  state.depth += BRACE_DEPTH[char] ?? 0;
  if (!/\s/.test(char)) state.previous = char;
  return false;
};

/**
 * Reads code up to the `}` that closes a template's hole, collecting the texts inside it, and leaves the cursor past
 * that brace; or, with no brace to wait for, the whole source.
 */
const readCode = (source: string, cursor: Cursor, texts: SourceText[], isHole: boolean): void => {
  const state: CodeState = { depth: 0, previous: "" };
  while (cursor.at < source.length) {
    if (readPiece(source, cursor, texts, state) && isHole) return;
  }
};

/**
 * Reads a template from its opening backtick, collecting the texts inside its holes, and leaves the cursor past its
 * closing backtick.
 *
 * @returns its fixed parts, the holes between them.
 */
const readTemplate = (source: string, cursor: Cursor, texts: SourceText[]): readonly string[] => {
  const parts: string[] = [];
  let part = "";
  cursor.at += 1;
  while (cursor.at < source.length && source[cursor.at] !== "`") {
    if (source[cursor.at] === "\\") {
      cursor.at += 1;
      part += source[cursor.at] ?? "";
      cursor.at += 1;
    } else if (source[cursor.at] === "$" && source[cursor.at + 1] === "{") {
      parts.push(part);
      part = "";
      cursor.at += 2;
      readCode(source, cursor, texts, true);
    } else {
      part += source[cursor.at] ?? "";
      cursor.at += 1;
    }
  }
  cursor.at += 1;
  parts.push(part);
  return parts;
};

/**
 * The texts a module's source holds: its strings, and its templates as their fixed parts. A scan, not a parse: it
 * skips comments and regular expressions, so an apostrophe in either starts no string, and that is all it needs.
 *
 * @param source - the module's text.
 */
export const sourceTexts = (source: string): readonly SourceText[] => {
  const texts: SourceText[] = [];
  readCode(source, { at: 0 }, texts, false);
  return texts;
};

/**
 * A template's fixed parts as a pattern that matches the whole of a text it can print, with the values it fills in as
 * words with no space, or as any text when its fixed parts are long enough to tell it apart on their own.
 */
const wholePattern = (parts: readonly string[]): RegExp | undefined => {
  const fixed = parts.join("").length;
  if (parts.length < 2 || fixed < MIN_TEMPLATE_TEXT) return undefined;
  const value = fixed >= MIN_TEMPLATE_TEXT_ANY_VALUE ? "[\\s\\S]*" : "\\S*";
  return new RegExp(`^${parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(value)}$`);
};

/** Whether a piece of a message is part of a fixed text of the source, or a whole text a template of it can print. */
const isFound = (piece: string, texts: readonly SourceText[]): boolean =>
  texts.some((text) => text.parts.some((part) => part.includes(piece))) ||
  texts.some((text) => wholePattern(text.parts)?.test(piece) === true);

/**
 * Whether a quoted message is still printed by the source: the whole of it is found there (a source may write a
 * placeholder itself, `<component file>`), or else each of its pieces between placeholders is, since the page writes a
 * placeholder where the source fills in a value and a message may be put together from several texts.
 *
 * @param message - the message as the page quotes it.
 * @param texts - every text of the sources.
 */
export const isPrintedBy = (message: string, texts: readonly SourceText[]): boolean =>
  isFound(message, texts) ||
  message
    .split(PLACEHOLDER)
    .map((fragment) => fragment.replace(EDGE_PUNCTUATION, ""))
    .filter((fragment) => fragment.length >= MIN_FRAGMENT)
    .every((fragment) => isFound(fragment, texts));

/**
 * The `forgebook` commands a page names where a reader would copy them: in its inline code and in its shell and
 * workflow fences.
 *
 * @param markdown - the page.
 */
export const namedCommands = (markdown: string): readonly NamedCommand[] => {
  const lines: PageLine[] = [];
  const isInFence = new Set<number>();
  for (const fence of fencesOf(markdown)) {
    for (const each of fence.lines) isInFence.add(each.line);
    if (["sh", "bash", "shell", "yaml", "yml"].includes(fence.language)) lines.push(...fence.lines);
  }
  markdown.split("\n").forEach((text, index) => {
    if (isInFence.has(index + 1)) return;
    for (const span of text.matchAll(/`([^`]+)`/g)) lines.push({ line: index + 1, text: span[1] ?? "" });
  });
  return lines.flatMap(({ line, text }) =>
    [...text.matchAll(COMMAND_IN_LINE)].map((match) => ({
      line,
      text,
      command: match[1] ?? "",
      options: [...(match[2] ?? "").matchAll(OPTION)].map((option) => option[1] ?? "")
    }))
  );
};

/** What the command's description (`CLI_KIT_DESCRIBE=1`) says of its commands and options. */
export type CommandDescription = {
  /** The options every command takes. */
  readonly options: readonly { readonly name: string }[];
  /** Each command, with its own options and those it inherits. */
  readonly commands: readonly {
    readonly name: string;
    readonly options: readonly { readonly name: string }[];
    readonly inheritedOptions?: readonly { readonly name: string }[];
  }[];
};

/**
 * What is wrong with a named command: a command that does not exist, or an option it does not take.
 *
 * @param named - the command as the page names it.
 * @param description - the command's description.
 * @returns the problems; none when it is right.
 */
export const commandProblems = (named: NamedCommand, description: CommandDescription): readonly string[] => {
  const command = description.commands.find((each) => each.name === named.command);
  if (command === undefined) return [`forgebook ${named.command} is no command`];
  const taken = new Set(
    [...description.options, ...command.options, ...(command.inheritedOptions ?? [])].map(
      (option) => option.name
    )
  );
  return named.options
    .filter((option) => !taken.has(option))
    .map((option) => `forgebook ${named.command} takes no --${option}`);
};
