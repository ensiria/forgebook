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
import { parseStoryFile } from "./storyParse.ts";
import { metaObject, objectOf, storyExports, type TopLevel, topLevelOf } from "./storyTopLevel.ts";

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

/**
 * A field of a story, as far as the file lets say: its value, `null` when the story has none, `undefined` when what
 * gives it cannot be read; and the places followed to read it, so a field that leads back to itself ends.
 */
type FieldRead = {
  readonly value: ESTree.Expression | null | undefined;
  readonly seen: ReadonlySet<string>;
};

/** Whether an expression is `undefined`, which sets a field to none. */
const isUndefined = (expression: ESTree.Expression): boolean =>
  expression.type === "Identifier" && expression.name === "undefined";

/**
 * A field of a story by its local name (`args`, `render`): what is assigned to it after its declaration
 * (`A.args = …`), else what its object holds. An assignment that reads the field itself (`A.args = { ...A.args }`)
 * reads the object's, as it does when the file runs.
 *
 * @param context - the file.
 * @param local - the story's local name.
 * @param field - the field's name.
 * @param seen - the places followed so far.
 */
const storyField = (
  context: FileContext,
  local: string,
  field: string,
  seen: ReadonlySet<string>
): FieldRead => {
  const assignedPlace = `${local}.${field}=`;
  const objectPlace = `${local}.${field}`;
  const assigned = context.top.assigned.get(local)?.get(field);
  if (assigned !== undefined && !seen.has(assignedPlace))
    return { value: isUndefined(assigned) ? null : assigned, seen: new Set([...seen, assignedPlace]) };
  const object = objectOf(context.top, context.top.values.get(local));
  if (object === undefined || seen.has(objectPlace)) return { value: undefined, seen };
  return objectField(context, object, field, new Set([...seen, objectPlace]));
};

/**
 * A field a story object holds: its own property, else the field of the story a spread in it names, the later over
 * the earlier, as the object has it when the file runs.
 *
 * @param context - the file.
 * @param object - the story's object.
 * @param field - the field's name.
 * @param seen - the places followed so far.
 */
const objectField = (
  context: FileContext,
  object: ESTree.ObjectExpression,
  field: string,
  seen: ReadonlySet<string>
): FieldRead => {
  let read: FieldRead = { value: null, seen };
  for (const property of object.properties) {
    if (property.type === "SpreadElement") {
      const argument = unwrapped(property.argument);
      const spread =
        argument.type === "Identifier"
          ? storyField(context, argument.name, field, seen)
          : { value: undefined, seen };
      if (spread.value !== null) read = spread;
    } else if (!property.computed && keyName(property.key) === field) {
      const value = unwrapped(property.value);
      read = { value: isUndefined(value) ? null : value, seen };
    }
  }
  return read;
};

/** The args an object holds written as code, by name; `undefined` for one that a spread it cannot read may replace. */
type WrittenArgs = Map<string, string | undefined>;

/** Whether an arg's value is plain data the frame reports as written: a literal, or `undefined`. */
const isPlainValue = (value: ESTree.Expression): boolean =>
  (value.type === "Literal" && !("regex" in value && value.regex !== undefined) && !("bigint" in value)) ||
  isUndefined(value);

/**
 * An expression's text as written; a method's function (`render(args) {…}`), whose text starts at its parameters, is
 * written as the function expression it is (`function (args) {…}`), so it can stand on its own.
 */
const expressionText = (context: FileContext, value: ESTree.Node): string => {
  const text = textOf(context, value);
  if (value.type !== "FunctionExpression" || !text.startsWith("(")) return text;
  return `${value.async ? "async " : ""}function${value.generator ? "*" : ""} ${text}`;
};

/** An arg's text: a constant of the file by its value, anything else as written; none for plain data. */
const argText = (context: FileContext, value: ESTree.Expression): string | undefined => {
  if (isPlainValue(value)) return undefined;
  const held = value.type === "Identifier" ? context.top.values.get(value.name) : undefined;
  if (held !== undefined) return isPlainValue(held) ? undefined : expressionText(context, held);
  return expressionText(context, value);
};

/** Forgets every arg written so far: a spread or a value that cannot be read may replace any of them. */
const forgetAll = (written: WrittenArgs): void => {
  for (const name of written.keys()) written.set(name, undefined);
};

/** The story whose args a member expression reads (`First.args`); none for any other. */
const argsOwner = (member: ESTree.MemberExpression): string | undefined => {
  const { object, property } = member;
  if (member.computed || object.type !== "Identifier" || property.type !== "Identifier") return undefined;
  return property.name === "args" ? object.name : undefined;
};

/**
 * Adds the args an object writes, in order: a later one replaces an earlier one in its place, as a spread does when
 * the file runs.
 *
 * @param context - the file.
 * @param object - the args' object.
 * @param written - the args so far.
 * @param seen - the places followed so far.
 */
const writeObjectArgs = (
  context: FileContext,
  object: ESTree.ObjectExpression,
  written: WrittenArgs,
  seen: ReadonlySet<string>
): void => {
  for (const property of object.properties) {
    if (property.type === "SpreadElement") {
      writeArgsOf(context, property.argument, written, seen);
      continue;
    }
    const name = property.computed ? undefined : keyName(property.key);
    if (name === undefined) forgetAll(written);
    else written.set(name, argText(context, unwrapped(property.value)));
  }
};

/**
 * Adds the args a value writes to those written so far: an object in place or a constant of the file, or another
 * story's (`First.args`); one that cannot be read forgets them all.
 *
 * @param context - the file.
 * @param value - the args' value.
 * @param written - the args so far.
 * @param seen - the places followed so far.
 */
const writeArgsOf = (
  context: FileContext,
  value: ESTree.Expression,
  written: WrittenArgs,
  seen: ReadonlySet<string>
): void => {
  const plain = unwrapped(value);
  if (plain.type === "MemberExpression") {
    const story = argsOwner(plain);
    const read = story === undefined ? { value: undefined, seen } : storyField(context, story, "args", seen);
    if (read.value === undefined) forgetAll(written);
    else if (read.value !== null) writeArgsOf(context, read.value, written, read.seen);
    return;
  }
  const object = objectOf(context.top, plain);
  if (object === undefined) forgetAll(written);
  else writeObjectArgs(context, object, written, seen);
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
  if (metaArgs !== undefined) writeArgsOf(context, metaArgs, written, new Set());
  const own = storyField(context, local, "args", new Set());
  if (own.value === undefined) forgetAll(written);
  else if (own.value !== null) writeArgsOf(context, own.value, written, own.seen);
  return Object.fromEntries(
    [...written].flatMap(([name, text]): [string, string][] => (text === undefined ? [] : [[name, text]]))
  );
};

/** A render's text: the code a name of the file holds, else the expression as written, a method as a function. */
const renderText = (context: FileContext, render: ESTree.Expression): string => {
  const held = render.type === "Identifier" ? functionNamed(context, render.name) : undefined;
  return expressionText(context, held ?? render);
};

/**
 * A story's render text, by its local name: its own `render` (assigned after it, in its object or in a story it
 * spreads), else the story itself when it is a function, else the meta's; none for a story drawn from its args, or
 * one whose render cannot be read (a helper's result), which is written from its values.
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
  const own = storyField(context, local, "render", new Set()).value;
  if (own !== undefined && own !== null) return renderText(context, own);
  if (own === null) return metaRender === undefined ? undefined : renderText(context, metaRender);
  const value = context.top.values.get(local);
  const asFunction = value === undefined ? context.functions.get(local) : storyFunction(context, value);
  return asFunction === undefined ? undefined : textOf(context, asFunction);
};

/**
 * One story's code: its render text, or its args written as code; none when reading it failed.
 *
 * @param context - the file.
 * @param meta - the meta's object, when the file has one written plainly.
 * @param local - the story's local name.
 * @param metaRender - the meta's render, when it has one.
 */
const storyCodeOf = (
  context: FileContext,
  meta: ESTree.ObjectExpression | undefined,
  local: string,
  metaRender: ESTree.Expression | undefined
): string | Readonly<Record<string, string>> | undefined => {
  try {
    return storyRender(context, local, metaRender) ?? writtenArgsOf(context, meta, local);
  } catch {
    // a story the reader trips on is written from its values: the other stories of the file keep their code
    return undefined;
  }
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
    const read = storyCodeOf(context, meta, local, metaRender);
    if (typeof read === "string") renders[exportName] = read;
    else if (read !== undefined && Object.keys(read).length > 0) args[exportName] = read;
  }
  return { renders, args };
};
