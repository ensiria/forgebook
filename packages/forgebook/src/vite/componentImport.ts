/**
 * Where a story file's component comes from, read with Vite's parser: the plugin resolves it for the component's page.
 *
 * @module
 */
import { propertyValue } from "./indexFields.ts";
import { metaObject, parseStoryFile, topLevelOf } from "./indexStoryFile.ts";

/**
 * The module a story file imports its meta's component from (`./Button`), read from the file alone: no program, so it
 * answers at once, where the docs need the package's program.
 *
 * @param file - the story file's path, for the parser (its extension decides TypeScript and JSX).
 * @param text - the story file's text.
 * @returns the import's module specifier, or none when the meta names no imported component.
 */
export const componentImport = (file: string, text: string): string | undefined => {
  const { program } = parseStoryFile(file, text);
  const meta = metaObject(program, topLevelOf(program));
  const component = meta === undefined ? undefined : propertyValue(meta, "component");
  if (component?.type !== "Identifier") return undefined;
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const isLocal = statement.specifiers.some(({ local }) => local.name === component.name);
    if (isLocal) return statement.source.value;
  }
  return undefined;
};
