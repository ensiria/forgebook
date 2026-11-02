/**
 * The id a package's stories carry in a catalogue, read from the module that declares its source (its `./stories`
 * export) without running it: the `id` of the exported `source`, when written plainly.
 *
 * @remarks
 * A story's id starts with its source's id (`kit:inputs-select--overview`), so `CATALOG.md` can name a component's
 * main story only when it knows it. A source built by code gives none, and the lines then name no story.
 *
 * @module
 */
import { type ESTree, parseSync } from "vite";

import { propertyValue, unwrapped } from "../../src/vite/estreeValues.ts";

/** The object a top-level `export const source = …` holds, if it is written as one. */
const sourceObject = (
  statement: ESTree.Statement | ESTree.ModuleDeclaration
): ESTree.ObjectExpression | undefined => {
  if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration")
    return undefined;
  for (const declarator of statement.declaration.declarations) {
    if (declarator.id.type !== "Identifier" || declarator.id.name !== "source" || declarator.init === null)
      continue;
    const init = unwrapped(declarator.init);
    if (init.type === "ObjectExpression") return init;
  }
  return undefined;
};

/**
 * The source's id, from the declaring module's text.
 *
 * @param file - the module's path, for the parser (its extension says TypeScript or JSX).
 * @param text - the module's text.
 * @returns the id, or none when the module does not write it plainly.
 */
export const sourceIdOf = (file: string, text: string): string | undefined => {
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return undefined;
  for (const statement of program.body) {
    const object = sourceObject(statement);
    const id = object === undefined ? undefined : propertyValue(object, "id");
    if (id?.type === "Literal" && typeof id.value === "string") return id.value;
  }
  return undefined;
};
