/**
 * The block syntax of a docs page read from its lines: `:::` directives (containers, nested by more colons), `::`
 * leaf directives, and GitHub alerts (`> [!NOTE]`), as a tree of segments whose leaves are plain Markdown.
 *
 * @remarks
 * The syntax is the one Starlight, Docusaurus and VitePress share, so an author knows it and a page stays readable on
 * GitHub: `:::name[label]{key="value"}` opens a container, a line of the same colons closes it, and a container inside
 * another has fewer colons than its parent (`::::tabs` around `:::tab`). Only the line structure is read here, before
 * Markdown: what a name means, and which attributes it takes, is the compiler's (`docPageBlocks.ts`). Every line keeps
 * its place in the file, so a mistake is reported with its line and column and the page still draws: a block that
 * cannot be read stays text. A directive is read only at a line's start, and never inside a code fence, so a fence can
 * show the syntax itself. Pure.
 *
 * @module
 */

/** A line of a page, with where it sits in the file. */
export type SourceLine = {
  /** Its text, without what an enclosing quote took off its start. */
  readonly text: string;
  /** Its line in the file, from 1. */
  readonly line: number;
  /** The column its text starts at in the file, from 1: more than 1 inside a quote. */
  readonly column: number;
};

/** A place in a page's file. */
export type SourcePosition = {
  /** The line, from 1. */
  readonly line: number;
  /** The column, from 1. */
  readonly column: number;
};

/** Something a page gets wrong, and where. */
export type PageNote = {
  /** Where it is; none when it is about the whole page. */
  readonly position: SourcePosition | undefined;
  /** What is wrong, in a sentence that starts in lower case. */
  readonly message: string;
};

/** The kinds of GitHub alert, as their marker writes them. */
export const ALERT_KINDS = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

/** A kind of GitHub alert. */
export type AlertKind = (typeof ALERT_KINDS)[number];

/** A directive's attributes, by key: a key written alone has the empty text. */
export type DirectiveAttributes = ReadonlyMap<
  string,
  { readonly value: string; readonly position: SourcePosition }
>;

/** A directive as its line writes it. */
export type Directive = {
  /** Its name (`tabs`). */
  readonly name: string;
  /** Its label, the text in square brackets; none when it has none. */
  readonly label: string | undefined;
  /** Where its label's text starts, for a note about what it holds. */
  readonly labelPosition: SourcePosition | undefined;
  /** Its attributes. */
  readonly attributes: DirectiveAttributes;
  /** Where its colons start. */
  readonly position: SourcePosition;
};

/** A piece of a page's body. */
export type BodySegment =
  | {
      /** Plain Markdown lines between the blocks. */
      readonly type: "markdown";
      /** The lines. */
      readonly lines: readonly SourceLine[];
    }
  | {
      /** A container directive and what it holds: `:::name` up to its closing colons. */
      readonly type: "container";
      /** The directive. */
      readonly directive: Directive;
      /** What it holds. */
      readonly children: readonly BodySegment[];
    }
  | {
      /** A leaf directive, alone on its line: `::name[label]{attributes}`. */
      readonly type: "leaf";
      /** The directive. */
      readonly directive: Directive;
    }
  | {
      /** A GitHub alert: a quote whose first line is `[!NOTE]`, `[!TIP]` and so on. */
      readonly type: "alert";
      /** Its kind. */
      readonly kind: AlertKind;
      /** Where its marker starts. */
      readonly position: SourcePosition;
      /** What the quote holds, its `>` taken off. */
      readonly children: readonly BodySegment[];
    };

/**
 * A note's text as a person reads it in a list of problems: `line 12, column 3: …`.
 *
 * @param note - the note.
 */
export const noteText = (note: PageNote): string =>
  note.position === undefined
    ? note.message
    : `line ${note.position.line}, column ${note.position.column}: ${note.message}`;

/**
 * A text's lines, each with its place in the file.
 *
 * @param text - the text.
 * @param firstLine - the file's line the text starts on, from 1.
 */
export const sourceLines = (text: string, firstLine: number): SourceLine[] =>
  text.split(/\r?\n/).map((line, index) => ({ text: line, line: firstLine + index, column: 1 }));

/** A code fence's opening: up to three spaces, then three or more backticks or tildes. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** A container directive's opening line: its colons and its name at the line's start, then the rest. */
const CONTAINER_OPEN = /^(:{3,})([a-z][a-z0-9-]*)(.*)$/;

/** A container's closing line: colons alone. */
const CONTAINER_CLOSE = /^(:{3,})\s*$/;

/** A leaf directive's line: exactly two colons and its name, then the rest. */
const LEAF = /^::([a-z][a-z0-9-]*)(.*)$/;

/** A directive written after spaces: Markdown would take it as a list item's text, so it is not read. */
const INDENTED_DIRECTIVE = /^\s+(:{2,})[a-z]/;

/** An alert's first line: a quote holding only `[!KIND]`. */
const ALERT_OPEN = /^( {0,3}>\s?)\[!([A-Za-z]+)\]\s*$/;

/** A quote's line: up to three spaces, `>`, and the space after it when there is one. */
const QUOTE_LINE = /^ {0,3}> ?/;

/** An attribute's key. */
const ATTRIBUTE_KEY = /^[A-Za-z_][\w-]*/;

/** Where a character of a line sits in the file. */
const positionIn = (line: SourceLine, offset: number): SourcePosition => ({
  line: line.line,
  column: line.column + offset
});

/**
 * The end of a label that starts after `[` at `start`: the place of its closing `]`, brackets inside it balanced and
 * `\]` escaped; -1 when it never closes.
 */
const labelEnd = (text: string, start: number): number => {
  let depth = 0;
  for (let index: number = start; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (character === "\\") index += 1;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
};

/** A quoted value's end: the place of its closing quote, or -1. */
const quotedEnd = (text: string, start: number, quote: string): number => {
  for (let index: number = start; index < text.length; index += 1) {
    if (text[index] === "\\") index += 1;
    else if (text[index] === quote) return index;
  }
  return -1;
};

/** A value as written, its escapes read. */
const unescaped = (value: string): string => value.replace(/\\(.)/g, "$1");

/** An attribute's value read, and the place after it; none when it cannot be read, with a note. */
type ReadValue = { readonly value: string; readonly next: number } | undefined;

/**
 * An attribute's value after its `=`: quoted, or bare up to the next space.
 *
 * @param line - the directive's line.
 * @param start - the place after `=`.
 * @param end - the place of the attributes' `}`.
 * @param key - the attribute's key, for the notes.
 * @param position - where the attribute starts, for the notes.
 * @param notes - receives what cannot be read.
 */
const attributeValue = (
  line: SourceLine,
  start: number,
  end: number,
  key: string,
  position: SourcePosition,
  notes: PageNote[]
): ReadValue => {
  const { text } = line;
  const quote = text.charAt(start);
  if (quote === '"' || quote === "'") {
    const close = quotedEnd(text, start + 1, quote);
    if (close !== -1 && close < end)
      return { value: unescaped(text.slice(start + 1, close)), next: close + 1 };
    notes.push({ position, message: `the value of "${key}" never ends: close its quote` });
    return undefined;
  }
  const bare = /^[^\s"'=]+/.exec(text.slice(start, end))?.[0] ?? "";
  if (bare !== "") return { value: bare, next: start + bare.length };
  notes.push({ position, message: `"${key}=" has no value` });
  return undefined;
};

/** A directive's attributes, as they are read. */
type Attributes = Map<string, { readonly value: string; readonly position: SourcePosition }>;

/**
 * The attributes between a directive's braces: `key="value"`, `key='value'`, `key=value` or `key` alone.
 *
 * @param line - the directive's line.
 * @param start - the place after `{`.
 * @param end - the place of `}`.
 * @param notes - receives what cannot be read.
 */
const attributesOf = (line: SourceLine, start: number, end: number, notes: PageNote[]): Attributes => {
  const attributes: Attributes = new Map();
  const { text } = line;
  let index = start;
  while (index < end) {
    const rest = text.slice(index, end);
    const space = /^\s+/.exec(rest)?.[0].length ?? 0;
    if (space > 0) {
      index += space;
      continue;
    }
    const position = positionIn(line, index);
    const key = ATTRIBUTE_KEY.exec(rest)?.[0];
    if (key === undefined) {
      notes.push({ position, message: `"${rest.trim()}" is not an attribute: write key="value"` });
      return attributes;
    }
    index += key.length;
    const read: ReadValue =
      text.charAt(index) === "="
        ? attributeValue(line, index + 1, end, key, position, notes)
        : { value: "", next: index };
    if (read === undefined) return attributes;
    if (attributes.has(key)) notes.push({ position, message: `"${key}" is written twice` });
    attributes.set(key, { value: read.value, position });
    index = read.next;
  }
  return attributes;
};

/** The place of the `}` that closes attributes starting at `start`, quotes skipped; -1 when none. */
const attributesEnd = (text: string, start: number): number => {
  for (let index: number = start; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (character === "}") return index;
    if (character !== '"' && character !== "'") continue;
    const close = quotedEnd(text, index + 1, character);
    if (close === -1) return -1;
    index = close;
  }
  return -1;
};

/** A directive's label read, and the place after it. */
type ReadLabel = {
  readonly label: string | undefined;
  readonly labelPosition: SourcePosition | undefined;
  readonly next: number;
};

/** A directive's label, when one starts at `start`. */
const labelAt = (line: SourceLine, start: number, notes: PageNote[]): ReadLabel => {
  const none = { label: undefined, labelPosition: undefined, next: start };
  if (line.text.charAt(start) !== "[") return none;
  const close = labelEnd(line.text, start + 1);
  if (close === -1) {
    notes.push({ position: positionIn(line, start), message: "its label never ends: add `]`" });
    return none;
  }
  return {
    label: line.text.slice(start + 1, close),
    labelPosition: positionIn(line, start + 1),
    next: close + 1
  };
};

/** A directive's attributes, when they start at `start`, and the place after them. */
const attributesAt = (
  line: SourceLine,
  start: number,
  notes: PageNote[]
): { readonly attributes: DirectiveAttributes; readonly next: number } => {
  if (line.text.charAt(start) !== "{") return { attributes: new Map(), next: start };
  const close = attributesEnd(line.text, start + 1);
  if (close === -1) {
    notes.push({ position: positionIn(line, start), message: "its attributes never end: add `}`" });
    return { attributes: new Map(), next: start };
  }
  return { attributes: attributesOf(line, start + 1, close, notes), next: close + 1 };
};

/**
 * A directive read from what follows its name: an optional `[label]`, optional `{attributes}`, nothing after.
 *
 * @param line - the directive's line.
 * @param name - its name.
 * @param restStart - the place its label or attributes start.
 * @param notes - receives what cannot be read.
 */
const directiveOf = (line: SourceLine, name: string, restStart: number, notes: PageNote[]): Directive => {
  const noted = notes.length;
  const { label, labelPosition, next } = labelAt(line, restStart, notes);
  const { attributes, next: end } = attributesAt(line, next, notes);
  const trailing = line.text.slice(end).trim();
  // after a label or attributes that never end, the rest of the line is already said to be wrong
  if (trailing !== "" && notes.length === noted) {
    notes.push({
      position: positionIn(line, line.text.indexOf(trailing, end)),
      message: `"${trailing}" after the block's name is not read: a label goes in [ ], attributes in { }`
    });
  }
  return { name, label, labelPosition, attributes, position: positionIn(line, 0) };
};

/** A container being read: its directive, its colons and what it holds so far. */
type OpenContainer = {
  readonly directive: Directive;
  readonly colons: number;
  readonly children: BodySegment[];
};

/** A code fence that is open: its character and its length. */
type OpenFence = { readonly marker: string; readonly length: number };

/** The code fence a line opens, when it opens one. */
const fenceOpened = (text: string): OpenFence | undefined => {
  const marker = FENCE_OPEN.exec(text)?.[1];
  return marker === undefined ? undefined : { marker: marker.charAt(0), length: marker.length };
};

/** Whether a line closes a fence: the same character, at least as many, nothing after. */
const isFenceClose = (text: string, fence: OpenFence): boolean => {
  const marker = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text)?.[1];
  return marker !== undefined && marker.charAt(0) === fence.marker && marker.length >= fence.length;
};

/**
 * The lines of an alert from its first, its quote's marks taken off: up to the first line that is no quote's.
 *
 * @param lines - the lines.
 * @param start - the place of the alert's first line.
 * @returns the lines it holds, without the marker's, and the place after it.
 */
const alertLines = (lines: readonly SourceLine[], start: number): { inner: SourceLine[]; next: number } => {
  const inner: SourceLine[] = [];
  let index = start + 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const mark = line === undefined ? undefined : QUOTE_LINE.exec(line.text)?.[0];
    if (line === undefined || mark === undefined) break;
    inner.push({ text: line.text.slice(mark.length), line: line.line, column: line.column + mark.length });
  }
  return { inner, next: index };
};

/** A container's opening as its line writes it: its colons and its name. */
const containerName = (container: OpenContainer): string =>
  `\`${":".repeat(container.colons)}${container.directive.name}\``;

/** The state of a body being read, line by line, and what each kind of line does to it. */
type BodyReader = {
  /** The top-level segments. */
  readonly top: BodySegment[];
  /** The containers open, the innermost last. */
  readonly open: OpenContainer[];
  /** The Markdown lines since the last block. */
  markdown: SourceLine[];
  /** The code fence open, whose lines are Markdown whatever they hold. */
  fence: OpenFence | undefined;
  /** What cannot be read. */
  readonly notes: PageNote[];
};

/** Where the next segment goes: in the innermost open container, or at the top. */
const childrenOf = (reader: BodyReader): BodySegment[] => reader.open.at(-1)?.children ?? reader.top;

/** Ends the Markdown since the last block as a segment of its own. */
const flush = (reader: BodyReader): void => {
  if (reader.markdown.length > 0) childrenOf(reader).push({ type: "markdown", lines: reader.markdown });
  reader.markdown = [];
};

/** Closes the innermost container. */
const closeInnermost = (reader: BodyReader): void => {
  flush(reader);
  const container = reader.open.pop();
  if (container !== undefined)
    childrenOf(reader).push({
      type: "container",
      directive: container.directive,
      children: container.children
    });
};

/** Reads a line that may open or sit in a code fence; whether it did. */
const readFenceLine = (reader: BodyReader, line: SourceLine): boolean => {
  if (reader.fence !== undefined) {
    reader.markdown.push(line);
    if (isFenceClose(line.text, reader.fence)) reader.fence = undefined;
    return true;
  }
  const opened = fenceOpened(line.text);
  if (opened === undefined) return false;
  reader.fence = opened;
  reader.markdown.push(line);
  return true;
};

/** Reads a line that may open a container; whether it did. */
const readOpening = (reader: BodyReader, line: SourceLine): boolean => {
  const [, colonText, name] = CONTAINER_OPEN.exec(line.text) ?? [];
  if (colonText === undefined || name === undefined) return false;
  const colons = colonText.length;
  const parent = reader.open.at(-1);
  if (parent !== undefined && colons >= parent.colons) {
    reader.notes.push({
      position: positionIn(line, 0),
      message: `\`${colonText}${name}\` sits inside ${containerName(parent)} (line ${parent.directive.position.line}), so it needs fewer colons than its parent: give the parent ${colons + 1}`
    });
  }
  flush(reader);
  reader.open.push({
    directive: directiveOf(line, name, colons + name.length, reader.notes),
    colons,
    children: []
  });
  return true;
};

/** Reads a line that may close a container; whether it did. */
const readClosing = (reader: BodyReader, line: SourceLine): boolean => {
  const colonText = CONTAINER_CLOSE.exec(line.text)?.[1];
  if (colonText === undefined) return false;
  const { open, notes } = reader;
  const innermost = open.at(-1);
  const depth = open.findLastIndex((container) => container.colons === colonText.length);
  if (innermost === undefined) {
    notes.push({ position: positionIn(line, 0), message: `\`${colonText}\` closes no block` });
    return true;
  }
  if (depth === -1) {
    notes.push({
      position: positionIn(line, 0),
      message: `\`${colonText}\` does not match ${containerName(innermost)} (line ${innermost.directive.position.line}): close it with ${innermost.colons} colons`
    });
    closeInnermost(reader);
    return true;
  }
  for (let inner = open.at(-1); inner !== undefined && open.length - 1 > depth; inner = open.at(-1)) {
    notes.push({
      position: inner.directive.position,
      message: `${containerName(inner)} is never closed before line ${line.line} closes its parent: add a line of ${inner.colons} colons`
    });
    closeInnermost(reader);
  }
  closeInnermost(reader);
  return true;
};

/** Reads a line that may be a leaf directive; whether it was. */
const readLeaf = (reader: BodyReader, line: SourceLine): boolean => {
  const name = LEAF.exec(line.text)?.[1];
  if (name === undefined) return false;
  flush(reader);
  childrenOf(reader).push({
    type: "leaf",
    directive: directiveOf(line, name, 2 + name.length, reader.notes)
  });
  return true;
};

/**
 * Reads a line that may start an alert, with the quote's lines after it.
 *
 * @returns the place of the alert's last line; none when the line starts none.
 */
const readAlert = (reader: BodyReader, lines: readonly SourceLine[], index: number): number | undefined => {
  const line = lines[index];
  const [, mark, written] = line === undefined ? [] : (ALERT_OPEN.exec(line.text) ?? []);
  if (line === undefined || mark === undefined || written === undefined) return undefined;
  const position = positionIn(line, mark.length);
  const kind = ALERT_KINDS.find((each) => each === written.toUpperCase());
  if (kind === undefined) {
    reader.notes.push({
      position,
      message: `\`[!${written}]\` is not an alert: write NOTE, TIP, IMPORTANT, WARNING or CAUTION`
    });
    return undefined;
  }
  flush(reader);
  const { inner, next } = alertLines(lines, index);
  childrenOf(reader).push({ type: "alert", kind, position, children: bodySegments(inner, reader.notes) });
  return next - 1;
};

/**
 * A page's body as a tree of segments.
 *
 * @param lines - the body's lines.
 * @param notes - receives what cannot be read, with its place.
 */
export const bodySegments = (lines: readonly SourceLine[], notes: PageNote[]): BodySegment[] => {
  const reader: BodyReader = { top: [], open: [], markdown: [], fence: undefined, notes };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || readFenceLine(reader, line)) continue;
    if (readOpening(reader, line) || readClosing(reader, line) || readLeaf(reader, line)) continue;
    const last = readAlert(reader, lines, index);
    if (last !== undefined) {
      index = last;
      continue;
    }
    if (INDENTED_DIRECTIVE.test(line.text)) {
      notes.push({
        position: positionIn(line, line.text.search(/:/)),
        message: "a block written after spaces is not read: start it at the line's start, outside lists"
      });
    }
    reader.markdown.push(line);
  }
  for (let container = reader.open.at(-1); container !== undefined; container = reader.open.at(-1)) {
    notes.push({
      position: container.directive.position,
      message: `${containerName(container)} is never closed: add a line of ${container.colons} colons`
    });
    closeInnermost(reader);
  }
  flush(reader);
  return reader.top;
};
