/**
 * The codemod for the Props tab's control groups: the shell's strings `propGroups.choice`, `.text`, `.structured` and
 * `.toggle` named their headings, and the tab now lists props in the order their source declares them, with no such
 * headings. A catalogue's `strings` naming them replaces nothing any more, so they are removed, from the configuration and
 * from any preset module given.
 *
 * @module
 */
import ts from "typescript-6";

import type { Codemod, CodemodResult, TextEdit } from "./migrate.types.ts";
import { parsedFile, propertyName, removalEdits } from "./objectEdits.ts";

/** The strings the Props tab no longer has. */
export const REMOVED_PROP_GROUP_STRINGS: ReadonlySet<string> = new Set([
  "propGroups.choice",
  "propGroups.text",
  "propGroups.structured",
  "propGroups.toggle"
]);

/**
 * The edits to one file: in every `strings: { … }` object, the removed strings out, and a `strings` left with nothing out
 * as well.
 *
 * @param text - the file's text.
 * @param path - its path.
 */
const run = (text: string, path: string): CodemodResult => {
  const file = parsedFile(text, path);
  const edits: TextEdit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node) === "strings" &&
      ts.isObjectLiteralExpression(node.initializer) &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      const strings = node.initializer;
      const removed = new Set(
        strings.properties.filter((element) => {
          const name = propertyName(element);
          return name !== undefined && REMOVED_PROP_GROUP_STRINGS.has(name);
        })
      );
      if (removed.size === 0) return;
      edits.push(
        ...(removed.size === strings.properties.length
          ? removalEdits(file, node.parent, new Set([node]))
          : removalEdits(file, strings, removed))
      );
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { edits, manual: [] };
};

/** The codemod. */
export const propGroupStrings: Codemod = {
  id: "prop-group-strings",
  breaksIn: "0.4.0",
  kind: "rewrite",
  files: ["config", "module"],
  summary:
    "Removes the strings propGroups.choice, .text, .structured and .toggle: the Props tab lists props in their source's order, with no such headings.",
  run
};
