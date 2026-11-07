/**
 * The codemod for plays in a build: a built catalogue no longer runs a story's play when it opens, since a reader of
 * published docs did not ask for it. A catalogue that relied on it gets `play: "on"` in its configuration, which keeps the
 * behaviour on the dev server and in a build alike.
 *
 * @remarks
 * It keeps an old behaviour rather than rewriting what broke, so it runs only for a project coming from before the change
 * (`--from`): run again on a project that left `play` out on purpose, it would undo that choice.
 *
 * @module
 */
import ts from "typescript-6";

import type { Codemod, CodemodResult } from "./migrate.types.ts";
import { defaultExportObject, insertionEdit, parsedFile, propertyName } from "./objectEdits.ts";

/** The quote the object's own strings use, so that the added one matches them; double when it has none. */
const quoteOf = (file: ts.SourceFile, object: ts.ObjectLiteralExpression): string => {
  let quote: string | undefined;
  const visit = (node: ts.Node): void => {
    if (quote !== undefined) return;
    if (ts.isStringLiteral(node)) {
      quote = file.text.charAt(node.getStart(file));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(object);
  return quote === "'" ? "'" : '"';
};

/**
 * The edit to the configuration: `play: "on"` after its title, unless it says `play` already.
 *
 * @param text - the configuration's text.
 * @param path - its path.
 */
const run = (text: string, path: string): CodemodResult => {
  const file = parsedFile(text, path);
  const object = defaultExportObject(file);
  if (object === undefined)
    return {
      edits: [],
      manual: [
        'The configuration\'s object was not found in this file: write play: "on" in it to keep plays running when a built story opens.'
      ]
    };
  const names = object.properties.map(propertyName);
  if (names.includes("play")) return { edits: [], manual: [] };
  if (object.properties.some(ts.isSpreadAssignment))
    return {
      edits: [],
      manual: [
        'The configuration spreads another object: unless that one sets play, write play: "on" to keep plays running when a built story opens.'
      ]
    };
  const title = names.indexOf("title");
  const before = object.properties[title === -1 ? 0 : title + 1];
  const quote = quoteOf(file, object);
  return { edits: [insertionEdit(file, object, `play: ${quote}on${quote}`, before)], manual: [] };
};

/** The codemod. */
export const playOnInBuilds: Codemod = {
  id: "play-on-in-builds",
  breaksIn: "0.4.0",
  kind: "keep",
  files: ["config"],
  summary:
    'Writes play: "on", so a built catalogue still runs a story\'s play when it opens; leave it out to take the new default, where a build waits for Run.',
  run
};
