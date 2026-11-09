/**
 * Hands every `import()` of the code a story frame loads to the frame, which waits for those a story starts while it is
 * first drawn before it says the story is ready (`frame/startedImports.ts`).
 *
 * @remarks
 * The call stays as written, wrapped: `__forgebookTrackImport(import("./Chart"))`, so Vite still reads and rewrites its
 * specifier. The wrapper is a function declaration added at the module's end, so no line moves; it asks `globalThis`
 * for the frame's tracker each time and hands the promise back as it is where there is none (the catalogue's own page,
 * a server render). Imports are found in the module's syntax, so a comment or a string holding the word is not one.
 * Forgebook's own packages are left as they are: the frame does not wait for what it loads itself.
 *
 * @module
 */
import { type ESTree, type Plugin, parseSync } from "vite";

import { STARTED_IMPORTS_KEY_NAME } from "../frame/startedImportsKey.ts";

/** The wrapper's name, unlikely to meet one of the module's own. */
const TRACK = "__forgebookTrackImport";

/** A quick test before the parse: a module without the word has nothing to wrap. */
const MAY_IMPORT = /\bimport\s*\(/;

/** Modules never wrapped: Vite's and the plugins' virtual ones, and Forgebook's own packages, installed or pre-bundled. */
const LEFT_AS_IS =
  /\0|[\\/]node_modules[\\/](?:forgebook|@forgebook[\\/][^\\/]+)[\\/]|[\\/]\.vite[\\/]deps[\\/](?:forgebook|@forgebook)_/;

/** The wrapper's declaration, added at a module's end. */
const DECLARATION = `\nfunction ${TRACK}(loading) { const track = globalThis[Symbol.for(${JSON.stringify(STARTED_IMPORTS_KEY_NAME)})]; return track === undefined ? loading : track(loading); }\n`;

/** Whether a value is a node of the syntax tree. */
const isNode = (value: unknown): value is { readonly type: string } =>
  typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";

/** The `import()` expressions under a node, outermost first in source order. */
const importExpressions = (
  node: unknown,
  found: ESTree.ImportExpression[] = []
): ESTree.ImportExpression[] => {
  if (Array.isArray(node)) {
    for (const each of node) importExpressions(each, found);
    return found;
  }
  if (!isNode(node)) return found;
  if (node.type === "ImportExpression") found.push(node as ESTree.ImportExpression);
  for (const [key, value] of Object.entries(node))
    if (key !== "type" && typeof value === "object" && value !== null) importExpressions(value, found);
  return found;
};

/**
 * A module's code with each `import()` wrapped for the frame; none when it has none, or does not parse (Vite says why).
 *
 * @param code - the module's code, as JavaScript.
 */
export const withTrackedImports = (code: string): string | undefined => {
  if (!MAY_IMPORT.test(code)) return undefined;
  const { program, errors } = parseSync("module.js", code);
  if (errors.length > 0) return undefined;
  const found = importExpressions(program.body);
  if (found.length === 0) return undefined;
  // from the end, so an earlier offset still holds; a nested `import()` is wrapped inside its outer one's text
  const edits = found.flatMap((each) => [
    { at: each.start, text: `${TRACK}(` },
    { at: each.end, text: ")" }
  ]);
  edits.sort((a, b) => b.at - a.at);
  let written = code;
  for (const edit of edits) written = `${written.slice(0, edit.at)}${edit.text}${written.slice(edit.at)}`;
  return `${written}${DECLARATION}`;
};

/**
 * The plugin: after every other, so the code it reads is JavaScript, on the browser's modules only.
 *
 * @returns the plugin.
 */
export const trackedImportsPlugin = (): Plugin => ({
  name: "forgebook:tracked-imports",
  enforce: "post",
  transform: {
    filter: { code: MAY_IMPORT },
    handler(code: string, id: string): { code: string; map: null } | undefined {
      if (this.environment.name !== "client" || LEFT_AS_IS.test(id)) return undefined;
      const written = withTrackedImports(code);
      return written === undefined ? undefined : { code: written, map: null };
    }
  }
});
