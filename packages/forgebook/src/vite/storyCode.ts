/**
 * The code a story shows in the catalogue's Code card, read from its file with Vite's parser, never run: each story's
 * `render` as written, and for a story drawn from its args, each arg the file writes as code.
 *
 * @remarks
 * A story's render is its own, else the meta's; a story written as a function (CSF 2), or bound from one
 * (`Template.bind({})`), is its render. A render kept in a constant or a function of the file shows as that code; one
 * imported from another file shows as its name, which is what the file says.
 *
 * A story without a render draws the meta's component with its args, and the shell writes that component in the
 * framework's code from the args of the moment. Only plain data crosses from the frame, so a function, an element or
 * any other code would be missing: this module gives the text of each such arg as written (`icon: <IconStar />`,
 * `onClick: fn()`), the meta's args under the story's, following spreads of the file's constants and of another
 * story's args. A plain literal is left to the value the frame reports, which is the same; a constant of the file is
 * written by its value, an import by its name. What a spread or a value it cannot read may replace is forgotten, so
 * the shell writes it from the value, never from a text the story does not draw. Pure: text in, texts out.
 *
 * @module
 */

import type { ESTree } from "vite";

import { keyName, propertyValue, unwrapped } from "./indexFields.ts";
import { metaObject, objectOf, storyExports, type TopLevel, topLevelOf } from "./indexStoryFile.ts";
import { parseStoryFile } from "./storyParse.ts";

/** A story file's code: each story's render, and each args story's args written as code. */
export type StoryFileCodeRead = {
  /** Each story's render as written, by export name. */
  readonly renders: Readonly<Record<string, string>>;
  /** Each args story's args written as code, by export name then arg; a story with none is left out. */
  readonly args: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

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

/** What reading a file's code needs: its text, its top level, and the functions it declares by name. */
type FileContext = {
  readonly text: string;
  readonly top: TopLevel;
  readonly functions: ReadonlyMap<string, ESTree.Function>;
};

/** A node's text, as written, without the indentation of the line it starts on. */
const textOf = ({ text }: FileContext, node: ESTree.Node): string =>
  dedented(text.slice(node.start, node.end), indentAt(text, node.start));

/** The functions the file declares at its top (`function renderGrid() {}`, exported or not), by name. */
const declaredFunctions = (program: ESTree.Program): ReadonlyMap<string, ESTree.Function> => {
  const functions = new Map<string, ESTree.Function>();
  for (const statement of program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "FunctionDeclaration" && declaration.id !== null)
      functions.set(declaration.id.name, declaration);
  }
  return functions;
};

/** Whether an expression is a function written in place. */
const isFunction = (expression: ESTree.Expression): boolean =>
  expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression";

/**
 * The function a name of the file holds: a constant written as one, or a function declaration.
 *
 * @param context - the file.
 * @param name - the name.
 */
const functionNamed = (context: FileContext, name: string): ESTree.Node | undefined => {
  const value = context.top.values.get(name);
  if (value !== undefined && isFunction(value)) return value;
  return context.functions.get(name);
};

/** A render's text: the code a name of the file holds, else the expression as written. */
const renderText = (context: FileContext, render: ESTree.Expression): string => {
  const held = render.type === "Identifier" ? functionNamed(context, render.name) : undefined;
  return textOf(context, held ?? render);
};

/**
 * The render a story's value is itself: a function (CSF 2), or one bound from a function of the file
 * (`Template.bind({})`).
 */
const storyFunction = (
  context: FileContext,
  value: ESTree.Expression | undefined
): ESTree.Node | undefined => {
  if (value === undefined) return undefined;
  if (isFunction(value)) return value;
  if (value.type !== "CallExpression" || value.callee.type !== "MemberExpression") return undefined;
  const { object, property } = value.callee;
  if (object.type !== "Identifier" || property.type !== "Identifier" || property.name !== "bind")
    return undefined;
  return functionNamed(context, object.name);
};

/** The args an object holds written as code, by name; `undefined` for one that a spread it cannot read may replace. */
type WrittenArgs = Map<string, string | undefined>;

/** Whether an arg's value is plain data the frame reports as written: a literal, or `undefined`. */
const isPlainValue = (value: ESTree.Expression): boolean =>
  (value.type === "Literal" && !("regex" in value && value.regex !== undefined) && !("bigint" in value)) ||
  (value.type === "Identifier" && value.name === "undefined");

/** An arg's text: a constant of the file by its value, anything else as written; none for plain data. */
const argText = (context: FileContext, value: ESTree.Expression): string | undefined => {
  if (isPlainValue(value)) return undefined;
  const held = value.type === "Identifier" ? context.top.values.get(value.name) : undefined;
  if (held !== undefined) return isPlainValue(held) ? undefined : textOf(context, held);
  return textOf(context, value);
};

/** Forgets every arg written so far: a spread or a value that cannot be read may replace any of them. */
const forgetAll = (written: WrittenArgs): void => {
  for (const name of written.keys()) written.set(name, undefined);
};

/**
 * The object a story's args are, as written: in place, a constant of the file, or another story's
 * (`First.args`); `undefined` when it cannot be read.
 *
 * @param context - the file.
 * @param value - the args' value.
 * @param seen - the stories followed so far, so stories that lead back to themselves end.
 */
const argsObject = (
  context: FileContext,
  value: ESTree.Expression,
  seen: ReadonlySet<string>
): ESTree.ObjectExpression | undefined => {
  const plain = unwrapped(value);
  if (plain.type === "MemberExpression" && !plain.computed) {
    const { object, property } = plain;
    if (object.type !== "Identifier" || property.type !== "Identifier" || property.name !== "args")
      return undefined;
    const args = storyArgs(context, object.name, seen);
    if (args === undefined || args === null) return undefined;
    return argsObject(context, args, new Set([...seen, object.name]));
  }
  return objectOf(context.top, plain);
};

/**
 * Adds the args an object writes, in order, to those written so far: a later one replaces an earlier one in its
 * place, as a spread does when the file runs.
 *
 * @param context - the file.
 * @param object - the args' object.
 * @param written - the args so far.
 * @param seen - the stories followed so far.
 */
const writeArgs = (
  context: FileContext,
  object: ESTree.ObjectExpression,
  written: WrittenArgs,
  seen: ReadonlySet<string>
): void => {
  for (const property of object.properties) {
    if (property.type === "SpreadElement") {
      const spread = argsObject(context, property.argument, seen);
      if (spread === undefined) forgetAll(written);
      else writeArgs(context, spread, written, seen);
      continue;
    }
    const name = property.computed ? undefined : keyName(property.key);
    if (name === undefined) {
      forgetAll(written);
      continue;
    }
    written.set(name, argText(context, unwrapped(property.value)));
  }
};

/**
 * A field a story object holds (`args`, `render`): its own property, else the field of the story a spread in it names,
 * as the object has it when the file runs; `null` when it holds none, `undefined` when a spread it cannot read may give
 * it.
 *
 * @param context - the file.
 * @param object - the story's object.
 * @param field - the field's name.
 * @param seen - the stories followed so far, so stories that lead back to themselves end.
 */
const objectField = (
  context: FileContext,
  object: ESTree.ObjectExpression,
  field: string,
  seen: ReadonlySet<string>
): ESTree.Expression | null | undefined => {
  let value: ESTree.Expression | null | undefined = null;
  for (const property of object.properties) {
    const found =
      property.type === "SpreadElement"
        ? spreadField(context, property, field, seen)
        : ownField(property, field);
    if (found === undefined) return undefined;
    if (found !== null) value = found;
  }
  return value;
};

/** The field a property of a story object sets; `null` for any other property. */
const ownField = (property: ESTree.ObjectProperty, field: string): ESTree.Expression | null =>
  !property.computed && keyName(property.key) === field ? unwrapped(property.value) : null;

/**
 * The field a spread in a story object gives: the field of the story it names; `null` when that has none, `undefined`
 * when the spread cannot be read.
 */
const spreadField = (
  context: FileContext,
  spread: ESTree.SpreadElement,
  field: string,
  seen: ReadonlySet<string>
): ESTree.Expression | null | undefined => {
  const argument = unwrapped(spread.argument);
  if (argument.type !== "Identifier" || seen.has(argument.name)) return undefined;
  const story = objectOf(context.top, argument);
  return story === undefined
    ? undefined
    : objectField(context, story, field, new Set([...seen, argument.name]));
};

/**
 * A story's args as written, by its local name: assigned after it (`A.args = …`), else held by its object;
 * `null` when it has none, `undefined` when they cannot be read.
 *
 * @param context - the file.
 * @param local - the story's local name.
 * @param seen - the stories followed so far.
 */
const storyArgs = (
  context: FileContext,
  local: string,
  seen: ReadonlySet<string>
): ESTree.Expression | null | undefined => {
  const assigned = context.top.assigned.get(local)?.get("args");
  if (assigned !== undefined) return assigned;
  const object = objectOf(context.top, context.top.values.get(local));
  return object === undefined ? undefined : objectField(context, object, "args", new Set([...seen, local]));
};

/**
 * An args story's args written as code: the meta's, then the story's over them.
 *
 * @param context - the file.
 * @param meta - the meta's object, when the file has one written plainly.
 * @param local - the story's local name.
 */
const writtenArgsOf = (
  context: FileContext,
  meta: ESTree.ObjectExpression | undefined,
  local: string
): Readonly<Record<string, string>> => {
  const written: WrittenArgs = new Map();
  const metaArgs = meta === undefined ? undefined : propertyValue(meta, "args");
  if (metaArgs !== undefined) {
    const object = argsObject(context, metaArgs, new Set());
    if (object !== undefined) writeArgs(context, object, written, new Set());
  }
  const own = storyArgs(context, local, new Set());
  const object = own === null || own === undefined ? undefined : argsObject(context, own, new Set([local]));
  if (object !== undefined) writeArgs(context, object, written, new Set([local]));
  else if (own !== null) forgetAll(written);
  return Object.fromEntries(
    [...written].flatMap(([name, text]): [string, string][] => (text === undefined ? [] : [[name, text]]))
  );
};

/**
 * A story's render text, by its local name: its own `render` (assigned after it, or in its object), else the story
 * itself when it is a function, else the meta's; none for a story drawn from its args.
 *
 * @param context - the file.
 * @param local - the story's local name.
 * @param metaRender - the meta's render, when it has one.
 */
const storyRender = (
  context: FileContext,
  local: string,
  metaRender: ESTree.Expression | undefined
): string | undefined => {
  const value = context.top.values.get(local);
  const object = objectOf(context.top, value);
  const own =
    context.top.assigned.get(local)?.get("render") ??
    (object === undefined ? undefined : objectField(context, object, "render", new Set([local])));
  // a spread it cannot read leaves the render unknown: the story is written from its args, all the file lets say
  if (own === undefined && object !== undefined) return undefined;
  if (own !== undefined && own !== null) return renderText(context, own);
  const asFunction = storyFunction(context, value);
  if (asFunction !== undefined) return textOf(context, asFunction);
  return metaRender === undefined ? undefined : renderText(context, metaRender);
};

/**
 * Each story's code in a story file: its render as written, or its args written as code.
 *
 * @param file - the file's path, for the parser (its extension decides TypeScript and JSX) and the messages.
 * @param text - the file's source.
 * @returns the texts by export name, or a message saying why the file cannot be read.
 */
export const storyCode = (file: string, text: string): StoryFileCodeRead | string => {
  const { program, errors } = parseStoryFile(file, text);
  const [error] = errors;
  if (error !== undefined) return `${file} does not parse: ${error.message}`;
  const top = topLevelOf(program);
  const context: FileContext = { text, top, functions: declaredFunctions(program) };
  const meta = metaObject(program, top);
  const metaFields = (name: string): ESTree.Expression | undefined =>
    meta === undefined ? undefined : propertyValue(meta, name);
  const metaRender = metaFields("render");
  const renders: Record<string, string> = {};
  const args: Record<string, Readonly<Record<string, string>>> = {};
  for (const { exportName, local } of storyExports(program, top, metaFields)) {
    // a story from another file is read there: its code is the values of the moment
    if (local === undefined) continue;
    const render = storyRender(context, local, metaRender);
    if (render !== undefined) {
      renders[exportName] = render;
      continue;
    }
    const written = writtenArgsOf(context, meta, local);
    if (Object.keys(written).length > 0) args[exportName] = written;
  }
  return { renders, args };
};
