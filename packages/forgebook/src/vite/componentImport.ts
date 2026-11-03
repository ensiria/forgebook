/**
 * Where a story file's component comes from, read with Vite's parser from the file alone: the plugin resolves it for
 * the component's page, which answers at once, where the docs need the package's TypeScript program.
 *
 * @remarks
 * The meta is read as the index reads it (`storyFileMeta`), so the forms the sidebar understands, a meta held in a
 * constant or exported by name, give a page too; the dev server's thread loads no compiler for it.
 *
 * @module
 */
import { propertyValue } from "./indexFields.ts";
import { storyFileMeta } from "./indexStoryFile.ts";
import { parseStoryFile } from "./storyParse.ts";

/**
 * The module a story file imports its meta's component from (`./Button`).
 *
 * @param storyFile - the story file's path, for the parser (its extension decides TypeScript and JSX).
 * @param text - the story file's text.
 * @returns the import's module specifier, or none when the meta names no imported component.
 */
export const componentImport = (storyFile: string, text: string): string | undefined => {
  const { program } = parseStoryFile(storyFile, text);
  const meta = storyFileMeta(program);
  const component = meta === undefined ? undefined : propertyValue(meta, "component");
  if (component?.type !== "Identifier") return undefined;
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const isImported = statement.specifiers.some(({ local }) => local.name === component.name);
    if (isImported) return statement.source.value;
  }
  return undefined;
};
