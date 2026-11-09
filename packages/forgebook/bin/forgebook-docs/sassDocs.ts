/**
 * The mixins and functions of a public Sass module, with the first line of their `///` comment, and the summary of a
 * style sheet: read from the text, no Sass compiler needed.
 *
 * @module
 */
import type { SassMemberDocs } from "./catalogueDocs.types.ts";

/** A mixin or function declaration and its parameter list. */
const MEMBER = /^@(mixin|function)\s+([\w-]+)\s*(?:\(([^)]*)\))?/;

/**
 * The documented members of a Sass module.
 *
 * @param text - the module's source.
 */
export const sassMembers = (text: string): SassMemberDocs[] => {
  const members: SassMemberDocs[] = [];
  let comment: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("///")) {
      comment.push(trimmed.slice(3).trim());
      continue;
    }
    // a declaration may span lines: its first line is enough for the name, the parameters come from the whole text
    const match = MEMBER.exec(trimmed);
    if (match !== null) {
      const [, kind = "mixin", name = ""] = match;
      const parameterText = parametersAfter(text, name);
      members.push({
        kind: kind === "function" ? "function" : "mixin",
        name,
        parameters: parameterText
          .split(",")
          .map((parameter) => parameter.split(":")[0]?.trim() ?? "")
          .filter((parameter) => parameter.startsWith("$")),
        summary: summaryOfComment(comment)
      });
    }
    comment = [];
  }
  return members;
};

/** A `///` comment's summary: its lines up to the first blank line or tag, joined. */
const summaryOfComment = (comment: readonly string[]): string => {
  const end = comment.findIndex((entry) => entry === "" || entry.startsWith("@"));
  return comment
    .slice(0, end === -1 ? comment.length : end)
    .join(" ")
    .trim();
};

/** The parameter list of a declaration, across lines. */
const parametersAfter = (text: string, name: string): string => {
  const start = text.search(new RegExp(`@(?:mixin|function)\\s+${name}\\s*\\(`));
  if (start === -1) return "";
  const open = text.indexOf("(", start);
  let depth = 0;
  for (let index: number = open; index < text.length; index++) {
    if (text[index] === "(") depth++;
    if (text[index] === ")") depth--;
    if (depth === 0) return text.slice(open + 1, index);
  }
  return "";
};

/** A `/* … *\/` comment at the very start of a style sheet, what is inside it captured. */
const LEADING_BLOCK = /^\s*\/\*([\s\S]*?)\*\//;

/**
 * The text of a style sheet's leading comment: its `//` lines, or a `/* … *\/` block, which is the only comment plain
 * CSS has. A block's lines lose their ` * ` margin and end at its first blank line or tag, so a licence's `@license` is
 * no summary.
 *
 * @param text - the style sheet's source.
 */
const leadingComment = (text: string): string => {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("//")) break;
    lines.push(line.slice(2).trim());
  }
  if (lines.length > 0) return lines.join(" ");
  const block = LEADING_BLOCK.exec(text)?.[1];
  if (block === undefined) return "";
  const inner = block
    .replace(/^[*!]+/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim());
  const first = inner.findIndex((line) => line !== "");
  const body = first === -1 ? [] : inner.slice(first);
  return summaryOfComment(body);
};

/**
 * The first sentence of a style sheet's leading comment, `//` lines or a `/* … *\/` block; empty when it has none.
 *
 * @param text - the style sheet's source.
 */
export const styleSheetSummary = (text: string): string => {
  const comment = leadingComment(text);
  const end = comment.search(/\.(\s|$)/);
  return end === -1 ? comment : comment.slice(0, end + 1);
};
