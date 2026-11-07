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
import { objectLiteralOf, parsedFile, propertyName, removalEdits } from "./objectEdits.ts";

/** The strings the Props tab no longer has. */
export const REMOVED_PROP_GROUP_STRINGS: ReadonlySet<string> = new Set([
  "propGroups.choice",
  "propGroups.text",
  "propGroups.structured",
  "propGroups.toggle"
]);

/** Whether an object's element is one of the strings removed. */
const isRemovedString = (element: ts.ObjectLiteralElementLike): boolean => {
  const name = propertyName(element);
  return name !== undefined && REMOVED_PROP_GROUP_STRINGS.has(name);
};

/** Whether an object's element has a name only running the code would tell: a computed key or a spread. */
const isUnreadName = (element: ts.ObjectLiteralElementLike): boolean =>
  ts.isSpreadAssignment(element) || (element.name !== undefined && ts.isComputedPropertyName(element.name));

/** What a `strings` property holds: its own object, the object a name it uses is given in the file, or none. */
const stringsObject = (
  property: ts.PropertyAssignment | ts.ShorthandPropertyAssignment,
  file: ts.SourceFile
): ts.ObjectLiteralExpression | undefined =>
  ts.isShorthandPropertyAssignment(property)
    ? objectLiteralOf(property.name, file)
    : objectLiteralOf(property.initializer, file);

/** Whether a node is an object's `strings` property, written out or shorthand. */
const isStringsProperty = (node: ts.Node): node is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
  (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
  ts.isObjectLiteralExpression(node.parent) &&
  propertyName(node) === "strings";

/** Advice for strings the codemod cannot read. */
const UNREAD_STRINGS =
  "These strings are not all written in this file: if they name propGroups.choice, .text, .structured or .toggle, remove them, since the Props tab no longer has them.";

/**
 * The edits to one file: in every `strings` object, written in place or in a name the file declares, the removed strings
 * out, and a `strings: { … }` left with nothing out as well.
 *
 * @param text - the file's text.
 * @param path - its path.
 */
const run = (text: string, path: string): CodemodResult => {
  const file = parsedFile(text, path);
  const edits: TextEdit[] = [];
  const advice = new Set<string>();
  // an object two configurations share through one name is rewritten once
  const done = new Set<ts.ObjectLiteralExpression>();
  const visit = (node: ts.Node): void => {
    ts.forEachChild(node, visit);
    if (!isStringsProperty(node)) return;
    const strings = stringsObject(node, file);
    if (strings === undefined) {
      advice.add(UNREAD_STRINGS);
      return;
    }
    if (strings.properties.some(isUnreadName)) advice.add(UNREAD_STRINGS);
    if (done.has(strings)) return;
    done.add(strings);
    const removed = new Set(strings.properties.filter(isRemovedString));
    if (removed.size === 0) return;
    const isInPlace = ts.isPropertyAssignment(node) && node.initializer === strings;
    edits.push(
      ...(isInPlace && removed.size === strings.properties.length
        ? removalEdits(file, node.parent, new Set([node]))
        : removalEdits(file, strings, removed))
    );
  };
  visit(file);
  return { edits, advice: [...advice] };
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
