/**
 * TypeScript written as coloured tokens, for the events' signatures and the call log: no highlighting library, the
 * signatures are short and their shapes known.
 *
 * @module
 */

/** What a token is, which is its colour. */
export type CodeTokenKind = "keyword" | "type" | "name" | "string" | "number" | "punctuation" | "space";

/** One token. */
export type CodeToken = {
  /** What it is. */
  readonly kind: CodeTokenKind;
  /** Its text. */
  readonly text: string;
};

/** The words TypeScript reserves for its built-in types and values. */
const KEYWORDS = new Set([
  "string",
  "number",
  "boolean",
  "void",
  "undefined",
  "null",
  "unknown",
  "never",
  "any",
  "object",
  "bigint",
  "symbol",
  "true",
  "false",
  "readonly",
  "keyof",
  "typeof"
]);

/** The pieces of a TypeScript text, in order. */
const PIECES = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|(\s+)|(=>|[^\w\s])/g;

/**
 * The tokens of a TypeScript type or call.
 *
 * @param text - a type (`(value: string) => void`) or a call (`onValueChange("monthly")`).
 * @param names - identifiers to colour as names (the parameters, the event); other capitalised words are types.
 */
export const codeTokens = (text: string, names: ReadonlySet<string> = new Set()): CodeToken[] =>
  [...text.matchAll(PIECES)].map(([piece = "", string, number, word, space]): CodeToken => {
    if (string !== undefined) return { kind: "string", text: piece };
    if (number !== undefined) return { kind: "number", text: piece };
    if (space !== undefined) return { kind: "space", text: piece };
    if (word === undefined) return { kind: "punctuation", text: piece };
    if (KEYWORDS.has(word)) return { kind: "keyword", text: piece };
    return { kind: names.has(word) ? "name" : "type", text: piece };
  });
