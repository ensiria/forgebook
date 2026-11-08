/**
 * The text edits the codemods of `forgebook migrate` share: a file parsed, a configuration's object found, properties of an
 * object literal removed or added, and edits applied.
 *
 * @remarks
 * The file is edited as text, at the places the compiler's tree gives, so everything a codemod does not touch keeps its
 * formatting and comments: printing the tree again would rewrite the whole file in the printer's style. A property alone on
 * its lines is removed with its lines; one sharing a line with others is cut out of it.
 *
 * @module
 */
import ts from "typescript-6";

import type { TextEdit } from "./migrate.types.ts";

/** How deep a configuration's name is followed back to the object it holds (`const config = …; export default config`). */
const NAME_DEPTH = 4;

/**
 * The kind of script a file is, by its extension: JSX is only read in a file that may hold it.
 *
 * @param path - the file's path.
 */
const scriptKindOf = (path: string): ts.ScriptKind => {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

/**
 * A file's tree, with each node's parent set.
 *
 * @param text - the file's text.
 * @param path - its path, for the kind of script.
 */
export const parsedFile = (text: string, path: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));

/**
 * A property's name as written, when it is a plain one (`play`, `"propGroups.choice"`); none for a spread, a method or a
 * computed name.
 *
 * @param element - the object literal's element.
 */
export const propertyName = (element: ts.ObjectLiteralElementLike): string | undefined => {
  if (!ts.isPropertyAssignment(element) && !ts.isShorthandPropertyAssignment(element)) return undefined;
  const { name } = element;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
    return name.text;
  return undefined;
};

/**
 * The value a name is given where the file declares it at its top (`const config = …`); none when it is not declared so.
 *
 * @param name - the name.
 * @param file - the file.
 */
const declaredValue = (name: string, file: ts.SourceFile): ts.Expression | undefined =>
  file.statements
    .flatMap((statement) =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []
    )
    .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name)?.initializer;

/** Whether an expression only wraps another: parentheses, `satisfies`, `as`. */
const isWrapper = (
  expression: ts.Expression
): expression is ts.ParenthesizedExpression | ts.SatisfiesExpression | ts.AsExpression =>
  ts.isParenthesizedExpression(expression) ||
  ts.isSatisfiesExpression(expression) ||
  ts.isAsExpression(expression);

/**
 * The object literal an expression stands for, through parentheses, `satisfies`, `as`, `defineConfig(…)` and a name
 * declared in the file.
 *
 * @param expression - the expression.
 * @param file - the file, for its declarations.
 * @param depth - how many more names may be followed.
 */
const objectOf = (
  expression: ts.Expression,
  file: ts.SourceFile,
  depth: number
): ts.ObjectLiteralExpression | undefined => {
  if (ts.isObjectLiteralExpression(expression)) return expression;
  if (isWrapper(expression)) return objectOf(expression.expression, file, depth);
  if (ts.isCallExpression(expression)) {
    const [first] = expression.arguments;
    const isDefine = ts.isIdentifier(expression.expression) && expression.expression.text === "defineConfig";
    return isDefine && first !== undefined ? objectOf(first, file, depth) : undefined;
  }
  if (!ts.isIdentifier(expression) || depth === 0) return undefined;
  const value = declaredValue(expression.text, file);
  return value === undefined ? undefined : objectOf(value, file, depth - 1);
};

/**
 * The object literal an expression stands for, as written in the file (through a name it declares, `satisfies`, `as`);
 * none when it is built some other way.
 *
 * @param expression - the expression.
 * @param file - the file.
 */
export const objectLiteralOf = (
  expression: ts.Expression,
  file: ts.SourceFile
): ts.ObjectLiteralExpression | undefined => objectOf(expression, file, NAME_DEPTH);

/**
 * The object a configuration file exports by default, as written in it; none when the file builds it some other way (a
 * function's result, an import).
 *
 * @param file - the configuration's tree.
 */
export const defaultExportObject = (file: ts.SourceFile): ts.ObjectLiteralExpression | undefined => {
  for (const statement of file.statements) {
    if (ts.isExportAssignment(statement) && statement.isExportEquals !== true)
      return objectOf(statement.expression, file, NAME_DEPTH);
  }
  return undefined;
};

/** The line ending a text uses: CRLF when any line ends so, LF otherwise. */
const lineEndingOf = (text: string): string => (text.includes("\r\n") ? "\r\n" : "\n");

/** Where the line holding an offset starts. */
const lineStart = (text: string, at: number): number => text.lastIndexOf("\n", at - 1) + 1;

/** Whether only spaces come before an offset on its line. */
const isLineLead = (text: string, at: number): boolean => text.slice(lineStart(text, at), at).trim() === "";

/**
 * Where the line after an offset ends, newline included, when only a comma, spaces and a line comment follow the offset on
 * it; none when more code follows.
 */
const lineTailEnd = (text: string, at: number): number | undefined => {
  const newline = text.indexOf("\n", at);
  const end = newline === -1 ? text.length : newline + 1;
  return /^[ \t]*,?[ \t]*(\/\/[^\n]*)?\r?\n?$/.test(text.slice(at, end)) ? end : undefined;
};

/** The edit removing the comma right after an offset, past spaces; none when no comma comes next. */
const commaAfter = (text: string, at: number): TextEdit | undefined => {
  const comma = /^\s*,/.exec(text.slice(at));
  return comma === null
    ? undefined
    : { start: at + comma[0].length - 1, end: at + comma[0].length, insert: "" };
};

/** A run of neighbouring properties removed together, by their indexes, the last included. */
type RemovedRun = { readonly first: number; readonly last: number };

/**
 * The runs of neighbouring properties to remove, so that no two edits meet.
 *
 * @param elements - the object's properties.
 * @param removed - those to remove.
 */
const removedRuns = (
  elements: readonly ts.ObjectLiteralElementLike[],
  removed: ReadonlySet<ts.ObjectLiteralElementLike>
): RemovedRun[] => {
  const runs: RemovedRun[] = [];
  elements.forEach((element, index) => {
    if (!removed.has(element)) return;
    const previous = runs[runs.length - 1];
    if (previous !== undefined && previous.last === index - 1)
      runs[runs.length - 1] = { ...previous, last: index };
    else runs.push({ first: index, last: index });
  });
  return runs;
};

/**
 * The edits that remove one run: its lines when it has them to itself, else its text with the comma that joins it.
 *
 * @param file - the file's tree.
 * @param elements - the object's properties.
 * @param run - the run.
 */
const runEdits = (
  file: ts.SourceFile,
  elements: ts.NodeArray<ts.ObjectLiteralElementLike>,
  { first, last }: RemovedRun
): TextEdit[] => {
  const text = file.text;
  const before = elements[first - 1];
  const after = elements[last + 1];
  const start = elements[first]?.getStart(file) ?? 0;
  const end = elements[last]?.end ?? start;
  const tail = lineTailEnd(text, end);
  if (isLineLead(text, start) && tail !== undefined) {
    const lines: TextEdit = { start: lineStart(text, start), end: tail, insert: "" };
    // the run was the end of the object: the property now last loses the comma it no longer needs
    const isEnd = after === undefined && !elements.hasTrailingComma && before !== undefined;
    const comma = isEnd ? commaAfter(text, before.end) : undefined;
    return comma === undefined ? [lines] : [lines, comma];
  }
  if (after !== undefined) return [{ start, end: after.getStart(file), insert: "" }];
  return before === undefined ? [] : [{ start: before.end, end, insert: "" }];
};

/**
 * The edits that remove some of an object literal's properties, keeping the others as written. Removing all of them leaves
 * `{}`.
 *
 * @param file - the file's tree.
 * @param object - the object literal.
 * @param removed - the properties to remove, of that object.
 */
export const removalEdits = (
  file: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  removed: ReadonlySet<ts.ObjectLiteralElementLike>
): TextEdit[] => {
  const elements = object.properties;
  if (elements.every((element) => removed.has(element)))
    return [{ start: object.getStart(file) + 1, end: object.end - 1, insert: "" }];
  return removedRuns(elements, removed).flatMap((run) => runEdits(file, elements, run));
};

/**
 * The edit that adds a property to an object literal before one of its properties, or after the last when none is given,
 * in the object's own layout: on a line of its own when the properties are, inline when they share one.
 *
 * @param file - the file's tree.
 * @param object - the object literal.
 * @param property - the property's text (`play: "on"`), with no comma.
 * @param before - the property it goes before; none for the end.
 * @returns the edits: one, or two when the last property needs a comma before the new one.
 */
export const insertionEdit = (
  file: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  property: string,
  before: ts.ObjectLiteralElementLike | undefined
): TextEdit[] => {
  const text = file.text;
  const eol = lineEndingOf(text);
  const elements = object.properties;
  const last = elements[elements.length - 1];
  if (last === undefined) {
    const inside = object.getStart(file) + 1;
    return [{ start: inside, end: object.end - 1, insert: ` ${property} ` }];
  }
  if (before !== undefined) {
    const start = before.getStart(file);
    if (!isLineLead(text, start)) return [{ start, end: start, insert: `${property}, ` }];
    const from = lineStart(text, start);
    return [{ start: from, end: from, insert: `${text.slice(from, start)}${property},${eol}` }];
  }
  const start = last.getStart(file);
  const tail = lineTailEnd(text, last.end);
  if (!isLineLead(text, start) || tail === undefined)
    return [{ start: last.end, end: last.end, insert: `, ${property}` }];
  // a line of its own after the last property's, so that a comment ending that line stays with it
  const indent = text.slice(lineStart(text, start), start);
  const line = `${indent}${property}${elements.hasTrailingComma ? "," : ""}${text.endsWith("\n", tail) ? eol : ""}`;
  const added: TextEdit = { start: tail, end: tail, insert: tail === text.length ? `${eol}${line}` : line };
  return elements.hasTrailingComma ? [added] : [{ start: last.end, end: last.end, insert: "," }, added];
};

/**
 * A text with edits applied, from the last to the first so that each offset still holds.
 *
 * @param text - the text.
 * @param edits - the edits, in any order.
 * @throws when two edits overlap, which would make the result depend on their order.
 */
export const appliedEdits = (text: string, edits: readonly TextEdit[]): string => {
  const sorted = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  let result = text;
  let floor = Number.POSITIVE_INFINITY;
  for (const edit of sorted) {
    if (edit.end > floor) throw new Error(`two edits overlap at ${edit.start}`);
    result = `${result.slice(0, edit.start)}${edit.insert}${result.slice(edit.end)}`;
    floor = edit.start;
  }
  return result;
};
