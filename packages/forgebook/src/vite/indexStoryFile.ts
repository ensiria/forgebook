/**
 * A story file's index, read from its source without running it: the meta's title and the stories with their names.
 *
 * @remarks
 * The sidebar lists every story before any is loaded, so the index comes from the code itself, parsed with Vite's
 * parser (the same files Vite compiles). The title and the story names must therefore be written as plain strings,
 * `parameters.controls` (the shell decides from it whether a story has a props panel before loading it) as `false`
 * or a list of plain strings, `parameters.group` as a plain string, `parameters.height` as a number, and the meta's `alsoIn`, `related` and
 * `keywords` as lists of plain strings; a story is a named `export const`, and
 * the first sentence of the TSDoc above it says what it shows. Pure: text in, index or problem out.
 *
 * @module
 */

import type { StoryGroup } from "@forgebook/story-format/csf";
import type { StoryControlsSetting, StoryFileIndex, StoryIndexEntry } from "@forgebook/story-format/source";
import { type ESTree, parseSync } from "vite";

/** An expression without the TypeScript wrappers a meta is often written with (`satisfies Meta<…>`, `as Meta`). */
const unwrapped = (expression: ESTree.Expression): ESTree.Expression => {
  if (
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "ParenthesizedExpression"
  ) {
    return unwrapped(expression.expression);
  }
  return expression;
};

/** A property's value when it is a plain string, by the property's name. */
const stringProperty = (object: ESTree.ObjectExpression, name: string): string | undefined => {
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key;
    const keyName = key.type === "Identifier" ? key.name : undefined;
    if (keyName !== name) continue;
    const value = unwrapped(property.value);
    return value.type === "Literal" && typeof value.value === "string" ? value.value : undefined;
  }
  return undefined;
};

/** A property's value expression, by the property's name. */
const propertyValue = (object: ESTree.ObjectExpression, name: string): ESTree.Expression | undefined => {
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key;
    if (key.type === "Identifier" && key.name === name) return unwrapped(property.value);
  }
  return undefined;
};

/** Why an object's `parameters.controls` cannot be read statically. */
const CONTROLS_PROBLEM = "`parameters.controls` must be written as `false` or a list of plain strings";

/**
 * An object's `parameters.controls`: `undefined` when it sets none, `[]` for `false`, the names of a list, or a
 * problem when it is not written plainly.
 */
const controlsOf = (object: ESTree.ObjectExpression): StoryControlsSetting | undefined | Error => {
  const parameters = propertyValue(object, "parameters");
  if (parameters?.type !== "ObjectExpression") return undefined;
  const controls = propertyValue(parameters, "controls");
  if (controls === undefined) return undefined;
  if (controls.type === "Literal" && controls.value === false) return [];
  if (controls.type !== "ArrayExpression") return new Error(CONTROLS_PROBLEM);
  const names: string[] = [];
  for (const element of controls.elements) {
    if (element?.type !== "Literal" || typeof element.value !== "string") return new Error(CONTROLS_PROBLEM);
    names.push(element.value);
  }
  return names;
};

/**
 * A meta's list of plain strings (`alsoIn`, `related`, `keywords`): `undefined` when it sets none, the strings, or a problem when
 * it is not written as a list of string literals.
 */
const stringListOf = (
  object: ESTree.ObjectExpression,
  name: string
): readonly string[] | undefined | Error => {
  const list = propertyValue(object, name);
  if (list === undefined) return undefined;
  const problem = new Error(`\`${name}\` must be written as a list of plain strings`);
  if (list.type !== "ArrayExpression") return problem;
  const strings: string[] = [];
  for (const element of list.elements) {
    if (element?.type !== "Literal" || typeof element.value !== "string") return problem;
    strings.push(element.value);
  }
  return strings;
};

/**
 * An object's `parameters.group`: `undefined` when it sets none, the group, or a problem when it is not a plain
 * string.
 */
const groupOf = (object: ESTree.ObjectExpression): StoryGroup | undefined | Error => {
  const parameters = propertyValue(object, "parameters");
  if (parameters?.type !== "ObjectExpression") return undefined;
  const group = propertyValue(parameters, "group");
  if (group === undefined) return undefined;
  if (group.type === "Literal" && typeof group.value === "string" && group.value !== "") return group.value;
  return new Error("`parameters.group` must be written as a plain string");
};

/**
 * An object's `parameters.height`: `undefined` when it sets none, the height in CSS px, or a problem when it is not
 * written as a plain positive number.
 */
const heightOf = (object: ESTree.ObjectExpression): number | undefined | Error => {
  const parameters = propertyValue(object, "parameters");
  if (parameters?.type !== "ObjectExpression") return undefined;
  const height = propertyValue(parameters, "height");
  if (height === undefined) return undefined;
  if (height.type === "Literal" && typeof height.value === "number" && height.value > 0) return height.value;
  return new Error("`parameters.height` must be written as a plain positive number of CSS px");
};

/** A comment as the parser gives it. */
type SourceComment = {
  readonly type: string;
  readonly value: string;
  readonly start: number;
  readonly end: number;
};

/**
 * The first sentence of the TSDoc right above a statement, without its tags; `undefined` when there is none.
 *
 * @param text - the file's source.
 * @param comments - the file's comments.
 * @param start - where the statement starts.
 */
const leadingSentence = (
  text: string,
  comments: readonly SourceComment[],
  start: number
): string | undefined => {
  const comment = comments.find(
    (candidate) =>
      candidate.type === "Block" &&
      candidate.value.startsWith("*") &&
      text.slice(candidate.end, start).trim() === ""
  );
  if (comment === undefined) return undefined;
  const prose = comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, ""))
    .filter((line) => !line.startsWith("@"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(prose)?.[1] ?? prose;
  return sentence === "" ? undefined : sentence;
};

/** Whether a story object sets `parameters.main: true`, written plainly. */
const isMainStory = (object: ESTree.ObjectExpression): boolean => {
  const parameters = propertyValue(object, "parameters");
  if (parameters?.type !== "ObjectExpression") return false;
  const main = propertyValue(parameters, "main");
  return main?.type === "Literal" && main.value === true;
};

/**
 * What the index reads of one story object besides its export: its name, controls, group, height and whether it is
 * the demo.
 */
const storyFields = (
  object: ESTree.ObjectExpression | undefined
): Pick<StoryIndexEntry, "name" | "controls" | "group" | "height" | "isMain"> | Error => {
  if (object === undefined) return {};
  const name = stringProperty(object, "name");
  const controls = controlsOf(object);
  if (controls instanceof Error) return controls;
  const group = groupOf(object);
  if (group instanceof Error) return group;
  const height = heightOf(object);
  if (height instanceof Error) return height;
  return {
    ...(name === undefined ? {} : { name }),
    ...(controls === undefined ? {} : { controls }),
    ...(group === undefined ? {} : { group }),
    ...(height === undefined ? {} : { height }),
    ...(isMainStory(object) ? { isMain: true } : {})
  };
};

/** The stories a named export declares: each `export const` holding an object (or nothing more). */
const exportedStories = (
  declaration: ESTree.Declaration,
  description: string | undefined
): (StoryIndexEntry | Error)[] => {
  if (declaration.type !== "VariableDeclaration") return [];
  return declaration.declarations.flatMap((declarator): (StoryIndexEntry | Error)[] => {
    if (declarator.id.type !== "Identifier") return [];
    const exportName = declarator.id.name;
    const init = declarator.init === null ? undefined : unwrapped(declarator.init);
    const fields = storyFields(init?.type === "ObjectExpression" ? init : undefined);
    if (fields instanceof Error) return [new Error(`story ${exportName}: ${fields.message}`)];
    return [{ exportName, ...fields, ...(description === undefined ? {} : { description }) }];
  });
};

/**
 * The index of one story file.
 *
 * @param file - the file's path, for the parser (its extension decides TypeScript and JSX) and the messages.
 * @param text - the file's source.
 * @returns the title and the stories, or a message saying why the file cannot be indexed.
 */
export const indexStoryFile = (file: string, text: string): StoryFileIndex | string => {
  const { program, comments, errors } = parseSync(file, text);
  const [error] = errors;
  if (error !== undefined) return `${file} does not parse: ${error.message}`;
  const meta = program.body.find((statement) => statement.type === "ExportDefaultDeclaration");
  const entries = program.body.flatMap((statement) =>
    statement.type === "ExportNamedDeclaration" && statement.declaration !== null
      ? exportedStories(statement.declaration, leadingSentence(text, comments, statement.start))
      : []
  );
  if (meta === undefined) return `${file} has no default export: the meta is the default export (CSF)`;
  const metaObject = metaExpression(meta.declaration);
  const title = metaObject === undefined ? undefined : stringProperty(metaObject, "title");
  if (metaObject === undefined || title === undefined)
    return `${file}: the meta's title must be a plain string`;
  const problem = entries.find((entry): entry is Error => entry instanceof Error);
  if (problem !== undefined) return `${file}: ${problem.message}`;
  const stories = entries.filter((entry): entry is StoryIndexEntry => !(entry instanceof Error));
  const controls = controlsOf(metaObject);
  if (controls instanceof Error) return `${file}: the meta's ${controls.message}`;
  const height = heightOf(metaObject);
  if (height instanceof Error) return `${file}: the meta's ${height.message}`;
  const lists = metaListsOf(metaObject);
  if (lists instanceof Error) return `${file}: the meta's ${lists.message}`;
  return {
    title,
    stories,
    ...(controls === undefined ? {} : { controls }),
    ...(height === undefined ? {} : { height }),
    ...lists
  };
};

/** The meta's lists of plain strings, each only when it sets it. */
type MetaLists = Pick<StoryFileIndex, "alsoIn" | "related" | "keywords">;

/**
 * A meta's lists of plain strings (`alsoIn`, `related`, `keywords`), each only when the meta sets it, or the first
 * one's problem.
 */
const metaListsOf = (object: ESTree.ObjectExpression): MetaLists | Error => {
  const lists: { -readonly [Name in keyof MetaLists]: MetaLists[Name] } = {};
  for (const name of ["alsoIn", "related", "keywords"] as const) {
    const list = stringListOf(object, name);
    if (list instanceof Error) return list;
    if (list !== undefined) lists[name] = list;
  }
  return lists;
};

/** The meta's object, when the default export is an object. */
const metaExpression = (
  declaration: ESTree.ExportDefaultDeclarationKind
): ESTree.ObjectExpression | undefined => {
  const expression = isExpression(declaration) ? unwrapped(declaration) : undefined;
  return expression?.type === "ObjectExpression" ? expression : undefined;
};

/** Whether a default export is an expression (not a function, class or interface declaration). */
const isExpression = (declaration: ESTree.ExportDefaultDeclarationKind): declaration is ESTree.Expression =>
  declaration.type !== "FunctionDeclaration" &&
  declaration.type !== "ClassDeclaration" &&
  declaration.type !== "TSInterfaceDeclaration";
