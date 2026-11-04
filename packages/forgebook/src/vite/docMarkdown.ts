/**
 * What every docs page and the written home go through before their blocks: the front matter, the Markdown reader with
 * the page's own inline syntax (a value in double braces, `{{components}}`), and the page's title.
 *
 * @remarks
 * A value is a token of its own, read by the same lexer as the rest of the text, so it is never read inside code: a
 * fence or a code span shows `{{title}}` as written, which is how a page documents the syntax itself. Pure.
 *
 * @module
 */
import { basename } from "node:path";

import { Marked, type MarkedExtension, type Token, type Tokens } from "marked";

import { PAGE_VALUES, type PageValue, valueMark } from "../docPages.ts";
import { storyName } from "../storyTree.ts";
import { escapeHtml } from "./highlightCode.ts";

/** The line a front matter starts and ends with. */
const FENCE = "---";

/** The keys a front matter can hold. */
const FRONT_MATTER_KEYS = ["title", "order", "description"];

/** A page's front matter and the Markdown after it. */
export type FrontMatter = {
  /** The Markdown after the front matter. */
  readonly body: string;
  /** The file's line the body starts on, from 1. */
  readonly bodyLine: number;
  /** Its `title`, when it has one. */
  readonly title: string | undefined;
  /** Its `order`, when it has a number. */
  readonly order: number | undefined;
  /** Its `description`, when it has one. */
  readonly description: string | undefined;
  /** What in it cannot be used, each with its line. */
  readonly notes: readonly { readonly line: number; readonly message: string }[];
};

/** A value without its surrounding quotes. */
const unquoted = (value: string): string => {
  const first = value.at(0);
  return value.length > 1 && (first === '"' || first === "'") && value.endsWith(first)
    ? value.slice(1, -1)
    : value;
};

/**
 * A page's text split at its front matter: `key: value` lines between two `---` lines, the file's very first line
 * the opening one.
 *
 * @remarks
 * Only three plain keys, so no YAML parser joins the core's dependencies; a key it does not know is reported, since a
 * typo would otherwise leave a page silently out of its place.
 *
 * @param text - the file's text.
 */
export const frontMatterOf = (text: string): FrontMatter => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const none = { title: undefined, order: undefined, description: undefined, bodyLine: 1 };
  if (lines[0]?.trim() !== FENCE) return { ...none, body: lines.join("\n"), notes: [] };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (end === -1)
    return { ...none, body: lines.join("\n"), notes: [{ line: 1, message: "its front matter never ends" }] };
  const notes: { line: number; message: string }[] = [];
  const fields = new Map<string, { readonly value: string; readonly line: number }>();
  lines.slice(1, end).forEach((line, index) => {
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).trim();
    if (colon === -1 || !FRONT_MATTER_KEYS.includes(key)) {
      notes.push({
        line: index + 2,
        message: `its front matter has a line it does not read: "${line.trim()}"`
      });
      return;
    }
    fields.set(key, { value: unquoted(line.slice(colon + 1).trim()), line: index + 2 });
  });
  const orderField = fields.get("order");
  const order = orderField === undefined || orderField.value === "" ? undefined : Number(orderField.value);
  if (orderField !== undefined && order !== undefined && !Number.isFinite(order))
    notes.push({ line: orderField.line, message: `its order "${orderField.value}" is not a number` });
  return {
    body: lines.slice(end + 1).join("\n"),
    bodyLine: end + 2,
    title: fields.get("title")?.value || undefined,
    order: order !== undefined && Number.isFinite(order) ? order : undefined,
    description: fields.get("description")?.value || undefined,
    notes
  };
};

/** The token a value in double braces is read as. */
export type ValueToken = Tokens.Generic & {
  /** A value. */
  readonly type: "value";
  /** The name it is written with (`components`). */
  readonly name: string;
  /** The text the HTML shows: the build-time value of `version`; otherwise the value as written. */
  text: string;
};

/**
 * Whether a token is a value.
 *
 * @param token - the token.
 */
export const isValueToken = (token: Token): token is ValueToken =>
  token.type === "value" && typeof token["name"] === "string" && typeof token["text"] === "string";

/**
 * Whether a name is one of the values a page can name.
 *
 * @param name - the name.
 */
export const isPageValue = (name: string): name is PageValue => PAGE_VALUES.some((value) => value === name);

/** A value in double braces: `{{components}}`, spaces inside allowed. */
const VALUE = /^\{\{\s*([A-Za-z][\w-]*)\s*\}\}/;

/**
 * The inline syntax of a page's values: read as a token, drawn as its build-time text (`version`) or as the mark the
 * shell fills; a name the page cannot use stays as written, and the page's checks report it.
 */
export const VALUES_EXTENSION: MarkedExtension = {
  extensions: [
    {
      name: "value",
      level: "inline",
      start: (source: string): number | undefined => {
        const at = source.indexOf("{{");
        return at === -1 ? undefined : at;
      },
      tokenizer: (source: string): Tokens.Generic | undefined => {
        const match = VALUE.exec(source);
        return match?.[1] === undefined
          ? undefined
          : { type: "value", raw: match[0], name: match[1], text: match[0] };
      },
      renderer: (token: Tokens.Generic): string => {
        if (!isValueToken(token) || !isPageValue(token.name)) return escapeHtml(token.raw);
        return token.name === "version" ? escapeHtml(token.text) : valueMark(token.name);
      }
    }
  ]
};

/** A reader of a page's tokens: nothing rendered. */
export const LEXER = new Marked({ async: false, gfm: true }, VALUES_EXTENSION);

/** The first token that is not blank space. */
export const firstToken = (tokens: readonly Token[]): Token | undefined =>
  tokens.find((token) => token.type !== "space");

/** A file name as a page's title: `getting-started.md` → "Getting started". */
const titleFromFile = (file: string): string => storyName(basename(file, ".md").replace(/[-_]+/g, " "));

/**
 * A page's title: its front matter's, else its opening `#` heading, else its file's name.
 *
 * @param file - the page's file.
 * @param frontMatter - its front matter.
 */
export const titleOf = (file: string, frontMatter: FrontMatter): string => {
  if (frontMatter.title !== undefined) return frontMatter.title;
  const heading = openingHeading(LEXER.lexer(frontMatter.body));
  return heading ?? titleFromFile(file);
};

/**
 * The text of a page's opening `#` heading; none when it opens with something else.
 *
 * @param tokens - the page's tokens.
 */
export const openingHeading = (tokens: readonly Token[]): string | undefined => {
  const first = firstToken(tokens);
  return first?.type === "heading" && first["depth"] === 1 && typeof first["text"] === "string"
    ? first["text"]
    : undefined;
};

/** The tokens without the page's opening `#` title: the page's header shows the title. */
export const withoutTitle = (tokens: readonly Token[]): readonly Token[] => {
  const first = firstToken(tokens);
  return first?.type === "heading" && first["depth"] === 1
    ? tokens.filter((token) => token !== first)
    : tokens;
};
