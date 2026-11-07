/**
 * When to use a component and when not, read from its TSDoc tags. Shared by the frameworks' docs modules: a framework
 * whose components have no symbol to carry a comment (a Vue single-file component) hands the tags it read itself. It holds
 * only the compiler's types, so that what reads a whole project in a moment, from comments' text, does not load it.
 *
 * @module
 */
import type ts from "typescript-6";

import type { UsageGuidance } from "../componentDocs.ts";

/** A tag at a word's start. */
const TAG = /(?:^|\s)@(\w+)/g;

/** One TSDoc tag, read. */
export type DocTag = {
  /** The tag's name, without its `@` (`useWhen`). */
  readonly name: string;
  /** Its text; empty when it has none. */
  readonly text: string;
};

/**
 * The field of a component's docs saying when to use it and when not; none when its TSDoc says nothing, so most
 * components carry nothing.
 *
 * @param tags - the component's TSDoc tags.
 */
export const guidanceOfTags = (tags: readonly DocTag[]): { readonly guidance?: UsageGuidance } => {
  const textsOf = (name: string): string[] =>
    tags.filter((tag) => tag.name === name && tag.text !== "").map((tag) => tag.text);
  const textOf = (name: string): string | undefined =>
    tags.find((tag) => tag.name === name)?.text.replace(/^`(.*)`$/, "$1");
  const useWhen = textsOf("useWhen");
  const avoidWhen = textsOf("avoidWhen");
  const alternatives = textsOf("alternatives")
    .join(",")
    .replace(/`/g, "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const isDeprecated = tags.some((tag) => tag.name === "deprecated");
  const replacedBy = textOf("replacedBy");
  const guidance: UsageGuidance = {
    ...(useWhen.length === 0 ? {} : { useWhen }),
    ...(avoidWhen.length === 0 ? {} : { avoidWhen }),
    ...(alternatives.length === 0 ? {} : { alternatives }),
    ...(isDeprecated ? { deprecated: textOf("deprecated") || "Deprecated." } : {}),
    ...(replacedBy === undefined ? {} : { replacedBy })
  };
  return Object.keys(guidance).length === 0 ? {} : { guidance };
};

/** A comment's text without its fenced examples: what an example shows is not said of this component. */
const withoutFences = (text: string): string => {
  const parts = text.split("```");
  return parts.filter((_, index) => index % 2 === 0).join(" ");
};

/**
 * The tags of a documentation comment's text, each with the lines that follow it.
 *
 * @param comment - the comment, with or without its stars.
 */
export const tagsOfComment = (comment: string): DocTag[] => {
  const plain = comment
    .split("\n")
    .map((line) => {
      const text = line.trimEnd();
      const open = text.replace(/^\s*\/?\*+\/?\s?/, "");
      return open.endsWith("*/") ? open.slice(0, -2) : open;
    })
    .join(" ");
  const shown = withoutFences(plain);
  const found = [...shown.matchAll(TAG)];
  return found.map((match, index) => ({
    name: match[1] ?? "",
    text: shown
      .slice(match.index + match[0].length, found[index + 1]?.index ?? shown.length)
      .split(/\s+/)
      .join(" ")
      .trim()
  }));
};

/**
 * The field of a component's docs saying when to use it and when not, from its symbol's TSDoc.
 *
 * @param symbol - the component.
 * @param checker - the program's type checker.
 */
export const guidanceOf = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker
): { readonly guidance?: UsageGuidance } =>
  guidanceOfTags(
    symbol.getJsDocTags(checker).map((tag) => ({
      name: tag.name,
      text: (tag.text ?? [])
        .map((part) => part.text)
        .join("")
        .trim()
    }))
  );
