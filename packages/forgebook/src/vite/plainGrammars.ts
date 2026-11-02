/**
 * The languages outside the TypeScript family that a component's documentation writes, split into coloured pieces: CSS,
 * SCSS, JSON, shell and HTML.
 *
 * @remarks
 * Each is a short list of patterns tried in order at every position, since a page shows short examples and colouring
 * them needs no parser: a general highlighter would add 9 MB to every install for five small grammars. The patterns
 * take negated classes and no nested repetition, so a long text cannot slow them down.
 *
 * @module
 */
import type { CodePiece, CodeRole } from "./typeScriptPieces.ts";

/** A rule: what it matches, sticky, and how it colours it. */
type GrammarRule = readonly [pattern: RegExp, role: CodeRole];

/** A quoted string, either quote, on one line. */
const QUOTED = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y;

/** A number, with a CSS unit when it has one. */
const NUMBER = /-?\b\d+(?:\.\d+)?(?:[a-zA-Z]+|%)?/y;

/** The rules of CSS, which SCSS extends. */
const CSS_RULES: readonly GrammarRule[] = [
  [/\/\*[\s\S]*?\*\//y, "comment"],
  [QUOTED, "string"],
  [/@[\w-]+/y, "keyword"],
  [/#[0-9a-fA-F]{3,8}\b/y, "number"],
  [/[.#][a-zA-Z_][\w-]*/y, "type"],
  [/--[\w-]+/y, "property"],
  [/[a-zA-Z-]+(?=[ \t]*:[ \t])/y, "property"],
  [NUMBER, "number"]
];

/** The rules of SCSS: line comments and variables on top of CSS. */
const SCSS_RULES: readonly GrammarRule[] = [
  [/\/\/[^\n]*/y, "comment"],
  [/\$[\w-]+/y, "property"],
  ...CSS_RULES
];

/** The rules of JSON: a string before a colon is a key. */
const JSON_RULES: readonly GrammarRule[] = [
  [/"(?:[^"\\\n]|\\.)*"(?=[ \t]*:)/y, "property"],
  [QUOTED, "string"],
  [/\b(?:true|false|null)\b/y, "keyword"],
  [NUMBER, "number"]
];

/** The rules of a shell. */
const SHELL_RULES: readonly GrammarRule[] = [
  [/(?<![^\s])#[^\n]*/y, "comment"],
  [QUOTED, "string"],
  [/\$\{[^}\n]*\}|\$\w+/y, "property"],
  [/\b(?:if|then|else|elif|fi|for|in|do|done|while|case|esac|function|export|return|cd|echo)\b/y, "keyword"]
];

/** The rules inside an HTML tag, whose name comes first. */
const TAG_RULES: readonly GrammarRule[] = [
  [/(?<=<\/?)[\w:.-]+/y, "tag"],
  [QUOTED, "string"],
  [/[\w:.-]+(?==)/y, "attribute"]
];

/** The grammars, by the names a Markdown fence gives them. */
const GRAMMARS: Readonly<Record<string, readonly GrammarRule[]>> = {
  css: CSS_RULES,
  scss: SCSS_RULES,
  json: JSON_RULES,
  bash: SHELL_RULES,
  sh: SHELL_RULES,
  shell: SHELL_RULES,
  zsh: SHELL_RULES
};

/** The names of HTML. */
const HTML_NAMES: ReadonlySet<string> = new Set(["html", "xml", "svg"]);

/** The rule that matches at a position, with its length. */
const matchAt = (
  code: string,
  index: number,
  rules: readonly GrammarRule[]
): { readonly role: CodeRole; readonly length: number } | undefined => {
  for (const [pattern, role] of rules) {
    pattern.lastIndex = index;
    const found = pattern.exec(code);
    if (found !== null && found[0] !== "") return { role, length: found[0].length };
  }
  return undefined;
};

/** Pieces with the plain text between them joined, so an example makes few spans. */
const piecesOf = (code: string, rules: readonly GrammarRule[]): CodePiece[] => {
  const pieces: CodePiece[] = [];
  let plainFrom = 0;
  let index = 0;
  while (index < code.length) {
    const match = matchAt(code, index, rules);
    if (match === undefined) {
      index += 1;
    } else {
      if (plainFrom < index) pieces.push({ text: code.slice(plainFrom, index) });
      pieces.push({ text: code.slice(index, index + match.length), role: match.role });
      index += match.length;
      plainFrom = index;
    }
  }
  if (plainFrom < code.length) pieces.push({ text: code.slice(plainFrom) });
  return pieces;
};

/** HTML: comments and tags are coloured, and the text between them is left as it is. */
const htmlPieces = (code: string): CodePiece[] => {
  const pieces: CodePiece[] = [];
  let index = 0;
  for (const part of code.matchAll(/<!--[\s\S]*?-->|<[^>]*>/g)) {
    if (part.index > index) pieces.push({ text: code.slice(index, part.index) });
    const isComment = part[0].startsWith("<!--");
    pieces.push(
      ...(isComment ? [{ text: part[0], role: "comment" as const }] : piecesOf(part[0], TAG_RULES))
    );
    index = part.index + part[0].length;
  }
  if (index < code.length) pieces.push({ text: code.slice(index) });
  return pieces;
};

/**
 * A piece of documentation's code as coloured pieces.
 *
 * @param code - the code.
 * @param language - its language, as a Markdown fence names it.
 * @returns the pieces, or none for a language with no grammar here.
 */
export const grammarPieces = (code: string, language: string): readonly CodePiece[] | undefined => {
  if (HTML_NAMES.has(language)) return htmlPieces(code);
  const rules = Object.hasOwn(GRAMMARS, language) ? GRAMMARS[language] : undefined;
  return rules === undefined ? undefined : piecesOf(code, rules);
};
