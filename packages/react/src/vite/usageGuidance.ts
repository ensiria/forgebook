/**
 * When to use a component and when not, read from its TSDoc tags.
 *
 * @module
 */
import type { UsageGuidance } from "forgebook/component-docs";
import { tagOf, tagsOf } from "forgebook/vite/docs-program";
import type ts from "typescript-6";

/**
 * The field of a component's docs saying when to use it and when not; none when its TSDoc says nothing, so most
 * components carry nothing.
 *
 * @param symbol - the component.
 * @param checker - the program's type checker.
 */
export const guidanceOf = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker
): { readonly guidance?: UsageGuidance } => {
  const useWhen = tagsOf(symbol, checker, "useWhen");
  const avoidWhen = tagsOf(symbol, checker, "avoidWhen");
  const alternatives = tagsOf(symbol, checker, "alternatives")
    .join(",")
    .replace(/`/g, "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const isDeprecated = symbol.getJsDocTags(checker).some((tag) => tag.name === "deprecated");
  const replacedBy = tagOf(symbol, checker, "replacedBy");
  const guidance: UsageGuidance = {
    ...(useWhen.length === 0 ? {} : { useWhen }),
    ...(avoidWhen.length === 0 ? {} : { avoidWhen }),
    ...(alternatives.length === 0 ? {} : { alternatives }),
    ...(isDeprecated ? { deprecated: tagOf(symbol, checker, "deprecated") || "Deprecated." } : {}),
    ...(replacedBy === undefined ? {} : { replacedBy })
  };
  return Object.keys(guidance).length === 0 ? {} : { guidance };
};
