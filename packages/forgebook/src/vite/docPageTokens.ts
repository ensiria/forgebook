/**
 * The tokens of a docs page read: each top-level fence given its kind, every link and image checked and addressed,
 * every value checked, each mistake noted where it is in the file.
 *
 * @remarks
 * Markdown tokens carry no position, so a token's place is found from its text inside the text it was read from: its
 * whole text, or its first line where a list item's lines lost their indent. Used by `docPageBlocks.ts` for every run of
 * Markdown, a step's included.
 *
 * @module
 */
import type { Token, Tokens } from "marked";

import { type FenceInfo, fenceInfo, missingLine } from "./codeFence.ts";
import type { PageNote, SourceLine, SourcePosition } from "./docDirectives.ts";
import { isPageValue, isValueToken, LEXER } from "./docMarkdown.ts";
import {
  assetAddress,
  isOutside,
  isOwnImage,
  isPageLink,
  linkedSlug,
  pageAddress,
  type ReadPage,
  relativeTarget
} from "./docPageLinks.ts";

/** What a top-level code fence is. */
export type FenceRead =
  | { readonly kind: "story" | "props"; readonly id: string }
  | { readonly kind: "code"; readonly info: FenceInfo };

/** What reading a page gathers as it goes. */
export type PageReading = {
  /** The page's file, absolute. */
  readonly file: string;
  /** Reads a linked page's text. */
  readonly read: ReadPage;
  /** Whether the page is the catalogue's written home, where the home's pieces may be placed. */
  readonly isHome: boolean;
  /** The version `{{version}}` shows: the page's package's; none without one. */
  readonly version: () => string | undefined;
  /** What it gets wrong. */
  readonly notes: PageNote[];
  /** What each top-level fence is. */
  readonly fences: Map<Token, FenceRead>;
  /** The stories it shows, in its order. */
  readonly stories: string[];
  /** The components whose tables it shows. */
  readonly components: string[];
  /** The slugs of the pages it links to. */
  readonly links: string[];
  /** The sources its home pieces name. */
  readonly sources: string[];
  /** Its images' files, in the order their addresses name them. */
  readonly images: string[];
};

/**
 * Where each character of a text made of lines sits in the file.
 *
 * @param lines - the lines the text joins.
 */
export const positionsOf = (lines: readonly SourceLine[]): ((offset: number) => SourcePosition) => {
  const starts: number[] = [];
  let total = 0;
  for (const line of lines) {
    starts.push(total);
    total += line.text.length + 1;
  }
  return (offset: number): SourcePosition => {
    let index = starts.findLastIndex((start) => start <= offset);
    if (index === -1) index = 0;
    const line = lines[index];
    return line === undefined
      ? { line: 1, column: 1 }
      : { line: line.line, column: line.column + offset - (starts[index] ?? 0) };
  };
};

/** Notes a value token, and writes `version` in. */
const readValue = (token: Token, position: SourcePosition, reading: PageReading): void => {
  if (!isValueToken(token)) return;
  if (!isPageValue(token.name)) {
    reading.notes.push({
      position,
      message: `\`${token.raw}\` is not a value a page can show: title, version, components, stories, libraries or pages`
    });
    return;
  }
  if (token.name !== "version") return;
  const version = reading.version();
  if (version === undefined)
    reading.notes.push({
      position,
      message: "`{{version}}` has no version to show: its package.json has none"
    });
  token.text = version ?? "";
};

/** Checks and addresses a link or an image, in place. */
const readAddress = (token: Token, position: SourcePosition, reading: PageReading): void => {
  if (token.type !== "link" && token.type !== "image") return;
  const href: unknown = token["href"];
  if (typeof href !== "string" || isOutside(href)) return;
  const { file, read } = reading;
  if (token.type === "image") {
    const image = relativeTarget(file, href).file;
    if (!isOwnImage(file, image)) {
      reading.notes.push({ position, message: `its image "${href}" is not a file of its package` });
      return;
    }
    reading.images.push(image);
    token.href = assetAddress(reading.images.length - 1);
    return;
  }
  if (!isPageLink(href)) return;
  const slug = linkedSlug(file, href, read);
  if (slug === undefined) {
    reading.notes.push({ position, message: `it links to "${href}", which is not there` });
    return;
  }
  reading.links.push(slug);
  token.href = pageAddress(file, href, read) ?? href;
};

/** The start of a fence's line after its backticks, where its words start. */
const fenceWordsStart = (raw: string): number => /^ {0,3}(?:`{3,}|~{3,})\s*/.exec(raw)?.[0].length ?? 3;

/**
 * Reads a top-level code fence: a story, a table, or code with its whole line.
 *
 * @param token - the fence.
 * @param position - where it starts.
 * @param reading - the reading.
 */
const readFence = (token: Tokens.Code, position: SourcePosition, reading: PageReading): void => {
  const info = typeof token.lang === "string" ? token.lang.trim() : "";
  const words = info === "" ? [] : info.split(/\s+/);
  const [kind, id, ...rest] = words;
  if (kind === "story" || kind === "props") {
    if (id === undefined) {
      reading.notes.push({ position, message: `a \`${kind}\` block names no id` });
      return;
    }
    if (rest.length > 0)
      reading.notes.push({
        position,
        message: `a \`${kind}\` block takes only an id, not "${rest.join(" ")}"`
      });
    (kind === "story" ? reading.stories : reading.components).push(id);
    reading.fences.set(token, { kind, id });
    return;
  }
  const start = { line: position.line, column: position.column + fenceWordsStart(token.raw) };
  const read = fenceInfo(info, start, reading.notes);
  const missing = missingLine(token.text, read);
  if (missing !== undefined)
    reading.notes.push({
      position: start,
      message: `the code fence names line ${missing.line}, and its code has ${missing.count}`
    });
  reading.fences.set(token, { kind: "code", info: read });
};

/**
 * Whether a token is a code block.
 *
 * @param token - the token.
 */
export const isCode = (token: Token): token is Tokens.Code =>
  token.type === "code" && typeof token["text"] === "string";

/**
 * Whether a token is an ordered list.
 *
 * @param token - the token.
 */
export const isOrderedList = (token: Token | undefined): token is Tokens.List =>
  token?.type === "list" && token["ordered"] === true && Array.isArray(token["items"]);

/** Whether a fence names a page's own block (`story <id>`, `props <id>`). */
const isBlockFence = (token: Token): token is Tokens.Code =>
  isCode(token) && typeof token.lang === "string" && /^(story|props)(\s|$)/.test(token.lang.trim());

/**
 * Reads tokens that sit in a page's own flow: each fence a block, every link, image and value checked inside them.
 *
 * @param tokens - the tokens.
 * @param container - the text they were read from.
 * @param base - where that text starts in the text the positions are counted in.
 * @param at - the position of a character of that text.
 * @param reading - the reading.
 */
export const readTokens = (
  tokens: readonly Token[],
  container: string,
  base: number,
  at: (offset: number) => SourcePosition,
  reading: PageReading
): void => {
  let cursor = 0;
  for (const token of tokens) {
    const found = container.indexOf(token.raw, cursor);
    const start = found === -1 ? cursor : found;
    cursor = start + token.raw.length;
    const offset = base + start;
    if (isCode(token)) readFence(token, at(offset), reading);
    let inner = 0;
    void LEXER.walkTokens([token], (child: Token): void => {
      if (child === token) return;
      const place = placeIn(token.raw, child.raw, inner);
      if (place !== -1) inner = place;
      const position = at(offset + (place === -1 ? 0 : place));
      if (isBlockFence(child))
        reading.notes.push({
          position,
          message: `a \`${(child.lang ?? "").trim()}\` block inside a list or a quote is not drawn`
        });
      readAddress(child, position, reading);
      readValue(child, position, reading);
    });
    readAddress(token, at(offset), reading);
  }
};

/**
 * Where a nested token's text sits in its top-level token's, from a place on: its first line alone when the whole is
 * not there, since a list item's lines lose their indent before they are read; -1 when neither is.
 */
const placeIn = (text: string, raw: string, from: number): number => {
  const whole = text.indexOf(raw, from);
  if (whole !== -1) return whole;
  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  return firstLine === "" ? -1 : text.indexOf(firstLine, from);
};

/**
 * A run of Markdown lines' text and its tokens.
 *
 * @param lines - the lines.
 */
export const lexed = (lines: readonly SourceLine[]): { readonly text: string; readonly tokens: Token[] } => {
  const text = lines.map((line) => line.text).join("\n");
  return { text, tokens: [...LEXER.lexer(text)] };
};
