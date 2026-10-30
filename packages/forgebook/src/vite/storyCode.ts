/**
 * The code a story shows in the catalogue's Code card: each story's `render` as written in its file, read with Vite's
 * parser, never run.
 *
 * @remarks
 * A story without a `render` draws the meta's component with its args: the shell writes that JSX itself from the args
 * of the moment, so only the stories with a `render` need their text. A `render` written elsewhere (a helper the
 * story points to) shows as the name it is given, which is what the file says.
 *
 * @module
 */

import { type ESTree, parseSync } from "vite";

/** An expression without the TypeScript wrappers around it (`satisfies`, `as`, parentheses). */
const unwrapped = (expression: ESTree.Expression): ESTree.Expression => {
  if (
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "ParenthesizedExpression"
  ) {
    return unwrapped(expression.expression);
  }
  return expression;
};

/** The `render` property of a story object, when it has one. */
const renderOf = (object: ESTree.ObjectExpression): ESTree.Node | undefined =>
  object.properties.find(
    (property) =>
      property.type === "Property" &&
      !property.computed &&
      property.key.type === "Identifier" &&
      property.key.name === "render"
  );

/**
 * Removes from every line past the first the indentation of the line the code starts on, so a `render` reads as if
 * written at the left edge.
 *
 * @param text - the code.
 * @param indent - the indentation of the line the code starts on, in characters.
 */
export const dedented = (text: string, indent: number): string => {
  const [first = "", ...rest] = text.split("\n");
  const trimmed = rest.map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length)));
  return [first, ...trimmed].join("\n");
};

/** The indentation of the line a position is on. */
const indentAt = (text: string, position: number): number => {
  const lineStart = text.lastIndexOf("\n", position - 1) + 1;
  const line = text.slice(lineStart, position);
  return line.length - line.trimStart().length;
};

/** A story's `render` text, when the declaration is a story object with one. */
const renderText = (declarator: ESTree.VariableDeclarator, text: string): string | undefined => {
  if (declarator.init === null || declarator.init === undefined) return undefined;
  const init = unwrapped(declarator.init);
  const render = init.type === "ObjectExpression" ? renderOf(init) : undefined;
  if (render?.type !== "Property") return undefined;
  const { start, end } = render.value;
  return dedented(text.slice(start, end), indentAt(text, start));
};

/**
 * Each story's `render` text in a story file.
 *
 * @param file - the file's path, for the parser (its extension decides TypeScript and JSX) and the messages.
 * @param text - the file's source.
 * @returns the texts by export name, or a message saying why the file cannot be read.
 */
export const storyCode = (file: string, text: string): Readonly<Record<string, string>> | string => {
  const { program, errors } = parseSync(file, text);
  const [error] = errors;
  if (error !== undefined) return `${file} does not parse: ${error.message}`;
  const code: Record<string, string> = {};
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration")
      continue;
    for (const declarator of statement.declaration.declarations) {
      const render = renderText(declarator, text);
      if (declarator.id.type === "Identifier" && render !== undefined) code[declarator.id.name] = render;
    }
  }
  return code;
};
