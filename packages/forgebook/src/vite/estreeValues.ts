/**
 * Values read from a parsed file without running it: an expression without its TypeScript wrappers, and an object's
 * property written plainly. Shared by the story index (`indexStoryFile.ts`, `indexedParameters.ts`) and the reader of
 * a source's id (`forgebook-docs`). Pure.
 *
 * @module
 */
import type { ESTree } from "vite";

/**
 * An expression without the TypeScript wrappers a meta is often written with (`satisfies Meta<…>`, `as Meta`).
 *
 * @param expression - the expression.
 */
export const unwrapped = (expression: ESTree.Expression): ESTree.Expression => {
  if (
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "ParenthesizedExpression"
  ) {
    return unwrapped(expression.expression);
  }
  return expression;
};

/**
 * A property key's name: an identifier's or a literal's; `undefined` for any other key.
 *
 * @param key - the key.
 */
export const keyName = (key: ESTree.PropertyKey): string | undefined => {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" ? String(key.value) : undefined;
};

/**
 * The value of an object's property written plainly (a name or a string as its key), its TypeScript wrappers removed.
 *
 * @param object - the object.
 * @param name - the property's name.
 */
export const propertyValue = (
  object: ESTree.ObjectExpression,
  name: string
): ESTree.Expression | undefined => {
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    if (keyName(property.key) === name) return unwrapped(property.value);
  }
  return undefined;
};
