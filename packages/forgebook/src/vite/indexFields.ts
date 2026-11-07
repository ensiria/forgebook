/**
 * What a story file's index reads of a meta's or a story's fields: each setting as written, `undefined` when it is
 * missing or left to the frame, an `Error` when it cannot stand, and for a design a note when it is left out.
 * `indexStoryFile` says which settings are which.
 *
 * @module
 */

import type { StoryGroup } from "@forgebook/story-format/csf";
import type { FigmaLink, StoryControlsSetting } from "@forgebook/story-format/source";
import type { ESTree } from "vite";

import { TOOL_TAGS } from "../storyTagNames.ts";
import { figmaLink } from "./figmaLink.ts";

/** A story's or a meta's fields by name: an object's properties, or a function story's assigned properties. */
export type Fields = (name: string) => ESTree.Expression | undefined;

/**
 * An expression without the TypeScript wrappers a meta is often written with (`satisfies Meta<…>`, `as Meta`).
 *
 * @param expression - the expression.
 */
export const unwrapped = (expression: ESTree.Expression): ESTree.Expression => {
  if (
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "ParenthesizedExpression"
  ) {
    return unwrapped(expression.expression);
  }
  return expression;
};

/** A property key's name: an identifier's or a literal's; `undefined` for any other key. */
export const keyName = (key: ESTree.PropertyKey): string | undefined => {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" ? String(key.value) : undefined;
};

/**
 * The value of an object's property written plainly (a name or a string as its key), its TypeScript wrappers removed.
 *
 * @param object - the object.
 * @param name - the property's name.
 */
export const propertyValue = (
  object: ESTree.ObjectExpression,
  name: string
): ESTree.Expression | undefined => {
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    if (keyName(property.key) === name) return unwrapped(property.value);
  }
  return undefined;
};

/** An object's fields. */
export const objectFields =
  (object: ESTree.ObjectExpression): Fields =>
  (name: string): ESTree.Expression | undefined =>
    propertyValue(object, name);

/** Whether an expression is written plainly: a literal, or a list of literals; anything else is written by code. */
const isPlain = (expression: ESTree.Expression): boolean =>
  expression.type === "Literal" ||
  (expression.type === "ArrayExpression" &&
    expression.elements.every((element) => element !== null && element.type === "Literal"));

/** A field's value when it is a plain string; `undefined` when it is missing or written by code. */
export const stringField = (fields: Fields, name: string): string | undefined => {
  const value = fields(name);
  return value?.type === "Literal" && typeof value.value === "string" ? value.value : undefined;
};

/** A field of the `parameters` object, when the fields write one as an object. */
export const parameter = (fields: Fields, name: string): ESTree.Expression | undefined => {
  const parameters = fields("parameters");
  return parameters?.type === "ObjectExpression" ? propertyValue(parameters, name) : undefined;
};

/** Why `parameters.controls` cannot be read. */
const CONTROLS_PROBLEM = "`parameters.controls` must be written as `false` or a list of plain strings";

/**
 * `parameters.controls`: `undefined` when none or written by code, `[]` for `false`, the names of a list, or a
 * problem when written plainly but wrongly.
 */
export const controlsOf = (fields: Fields): StoryControlsSetting | undefined | Error => {
  const controls = parameter(fields, "controls");
  if (controls === undefined || !isPlain(controls)) return undefined;
  if (controls.type === "Literal" && controls.value === false) return [];
  if (controls.type !== "ArrayExpression") return new Error(CONTROLS_PROBLEM);
  const names = controls.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
  );
  return names.length === controls.elements.length ? names : new Error(CONTROLS_PROBLEM);
};

/** A list of plain strings: `undefined` when none or written by code, the strings, or a problem when it is wrong. */
export const stringListOf = (fields: Fields, name: string): readonly string[] | undefined | Error => {
  const list = fields(name);
  if (list === undefined || !isPlain(list)) return undefined;
  if (list.type !== "ArrayExpression")
    return new Error(`\`${name}\` must be written as a list of plain strings`);
  const strings = list.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
  );
  return strings.length === list.elements.length
    ? strings
    : new Error(`\`${name}\` must be written as a list of plain strings`);
};

/** `parameters.group`: `undefined` when none or written by code, the group, or a problem when it is wrong. */
export const groupOf = (fields: Fields): StoryGroup | undefined | Error => {
  const group = parameter(fields, "group");
  if (group === undefined || !isPlain(group)) return undefined;
  if (group.type === "Literal" && typeof group.value === "string" && group.value !== "") return group.value;
  return new Error("`parameters.group` must be written as a plain string");
};

/**
 * `parameters.propGroups`, read by the index only since a component's API reference is drawn before any story runs:
 * `undefined` when none, the names, or a problem when it is not a list of plain strings. Written by code it would be
 * lost, since the frame does not read it.
 */
export const propGroupsOf = (fields: Fields): readonly string[] | undefined | Error => {
  const groups = parameter(fields, "propGroups");
  if (groups === undefined) return undefined;
  const names =
    groups.type === "ArrayExpression"
      ? groups.elements.flatMap((element) =>
          element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
        )
      : [];
  return groups.type === "ArrayExpression" && names.length === groups.elements.length
    ? names
    : new Error("`parameters.propGroups` must be written as a list of plain strings");
};

/** `parameters.height`: `undefined` when none or written by code, the height in CSS px, or a problem when wrong. */
export const heightOf = (fields: Fields): number | undefined | Error => {
  const height = parameter(fields, "height");
  if (height === undefined || !isPlain(height)) return undefined;
  if (height.type === "Literal" && typeof height.value === "number" && height.value > 0) return height.value;
  return new Error("`parameters.height` must be written as a plain positive number of CSS px");
};

/**
 * `parameters.design`, read by the index only since the shell offers the Design tab before any story runs. A design
 * with no `figma`, or not written as an object, is left alone: it may be another tool's (Storybook's design addon uses
 * the same parameter).
 *
 * @returns the checked link; `undefined` for none; a message when the link is not a Figma file's, which the file's
 * notes carry while the file keeps its stories and the pages never see the link; an `Error` when it is written by code.
 */
export const designOf = (fields: Fields): FigmaLink | undefined | string | Error => {
  const design = parameter(fields, "design");
  const figma = design?.type === "ObjectExpression" ? propertyValue(design, "figma") : undefined;
  if (figma === undefined) return undefined;
  if (figma.type !== "Literal" || typeof figma.value !== "string") {
    return new Error("`parameters.design.figma` must be written as a plain string");
  }
  const link = figmaLink(figma.value);
  return typeof link === "string" ? `\`parameters.design.figma\`: ${link}` : link;
};

/** `parameters.docs.description.<kind>`, when written as a plain string. */
export const docsDescription = (fields: Fields, kind: "story" | "component"): string | undefined => {
  const docs = parameter(fields, "docs");
  const description = docs?.type === "ObjectExpression" ? propertyValue(docs, "description") : undefined;
  if (description?.type !== "ObjectExpression") return undefined;
  const text = propertyValue(description, kind);
  return text?.type === "Literal" && typeof text.value === "string" ? text.value : undefined;
};

/** The strings an expression writes plainly: a string, or a list of strings; none for anything else. */
const plainStrings = (expression: ESTree.Expression | undefined): readonly string[] | undefined => {
  if (expression?.type === "Literal")
    return typeof expression.value === "string" ? [expression.value] : undefined;
  if (expression?.type !== "ArrayExpression") return undefined;
  const strings = expression.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
  );
  return strings.length === expression.elements.length ? strings : undefined;
};

/**
 * `parameters.status`, as the status addons of Storybook write it (`"beta"`, `{ type: "beta" }`, `{ type: ["beta"] }`),
 * read as tags so a catalogue moved from Storybook keeps its statuses: `undefined` when none. Never a problem: the
 * parameter is another tool's, so a value written otherwise or by code is left alone.
 */
export const statusTagsOf = (fields: Fields): readonly string[] | undefined => {
  const status = parameter(fields, "status");
  const written = status?.type === "ObjectExpression" ? propertyValue(status, "type") : status;
  // a status names what a component is: never a tool's tag, which would list or test a story its meta left out
  return plainStrings(written)?.filter((tag) => tag !== "" && !tag.startsWith("!") && !TOOL_TAGS.has(tag));
};
