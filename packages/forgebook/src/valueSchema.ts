/**
 * The schema of a custom control's value, and the check of a value against it: a small part of JSON Schema, written by the
 * control's author, read in the shell and by the commands. No dependency, so the check costs a catalogue with custom
 * controls little and any other nothing.
 *
 * @remarks
 * A keyword outside this list is refused rather than ignored: a schema that says less than it seems to would let a link
 * through. Pure.
 *
 * @module
 */
import type { SchemaType, ValueSchema } from "./argControl.ts";
import { type ArgValue, isArgList, isArgObject } from "./messages.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The keywords a schema may use. */
const KEYWORDS: readonly string[] = [
  "title",
  "description",
  "default",
  "type",
  "enum",
  "const",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "items",
  "minItems",
  "maxItems",
  "properties",
  "required",
  "additionalProperties",
  "anyOf"
];

/** The types JSON Schema names. */
const SCHEMA_TYPES: readonly unknown[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "null",
  "object",
  "array"
];

/** Whether a keyword holds a number, when it is there: one that holds another thing would refuse nothing. */
const areNumbers = (schema: Readonly<Record<string, unknown>>, keywords: readonly string[]): boolean =>
  keywords.every((keyword) => schema[keyword] === undefined || typeof schema[keyword] === "number");

/** Whether a pattern compiles, and repeats no repeat (`(a+)+`), the form that hangs a page on a short text. */
const isUsablePattern = (pattern: unknown): boolean => {
  if (pattern === undefined) return true;
  if (typeof pattern !== "string" || /\([^)]*[+*}][^)]*\)[+*{]/.test(pattern)) return false;
  try {
    return new RegExp(pattern, "u") !== undefined;
  } catch {
    return false;
  }
};

/** Whether a keyword holding one schema, or several, holds schemas. */
const areNested = (value: Readonly<Record<string, unknown>>): boolean => {
  const { items, properties, additionalProperties, anyOf } = value;
  return (
    (items === undefined || isValueSchema(items)) &&
    (properties === undefined || (isRecord(properties) && Object.values(properties).every(isValueSchema))) &&
    (additionalProperties === undefined ||
      typeof additionalProperties === "boolean" ||
      isValueSchema(additionalProperties)) &&
    (anyOf === undefined || (Array.isArray(anyOf) && anyOf.every(isValueSchema)))
  );
};

/** Whether the keywords of one level hold what they say. */
const areLeavesRead = (value: Readonly<Record<string, unknown>>): boolean => {
  const { type, required } = value;
  const types = type === undefined ? [] : [type].flat();
  return (
    types.every((each) => SCHEMA_TYPES.includes(each)) &&
    (value["enum"] === undefined || Array.isArray(value["enum"])) &&
    (required === undefined ||
      (Array.isArray(required) && required.every((name) => typeof name === "string"))) &&
    areNumbers(value, ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) &&
    isUsablePattern(value["pattern"])
  );
};

/**
 * Whether a module's `schema` is one this check reads in full, at any depth: a keyword it does not know, or one holding what
 * it cannot use, would let through what the schema seems to refuse.
 *
 * @param value - the module's export.
 */
export const isValueSchema = (value: unknown): value is ValueSchema =>
  isRecord(value) &&
  Object.keys(value).every((key) => KEYWORDS.includes(key)) &&
  areLeavesRead(value) &&
  areNested(value);

/** Whether a value is of one of JSON Schema's types. */
const isOfType = (type: SchemaType, value: ArgValue): boolean => {
  switch (type) {
    case "string":
    case "boolean":
      return typeof value === type;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "null":
      return value === null;
    case "array":
      return isArgList(value);
    case "object":
      return isArgObject(value);
  }
};

/** Whether two values are the same JSON, whatever order an object writes its fields in. */
const isSameValue = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((each, index) => isSameValue(each, right[index]));
  if (!isRecord(left) || !isRecord(right)) return left === right;
  const names = Object.keys(left);
  return (
    names.length === Object.keys(right).length &&
    names.every((name) => Object.hasOwn(right, name) && isSameValue(left[name], right[name]))
  );
};

/** What is wrong with a value's own kind: its type and the values it may be. */
const kindProblem = (schema: ValueSchema, value: ArgValue, path: string): string | undefined => {
  const types = schema.type === undefined ? [] : [schema.type].flat();
  if (types.length > 0 && !types.some((type) => isOfType(type, value)))
    return `${path} must be of type ${types.join(" or ")}`;
  if (schema.enum !== undefined && !schema.enum.some((each) => isSameValue(each, value)))
    return `${path} must be one of ${JSON.stringify(schema.enum)}`;
  return schema.const !== undefined && !isSameValue(schema.const, value)
    ? `${path} must be ${JSON.stringify(schema.const)}`
    : undefined;
};

/** What is wrong with a number or a text. */
const leafProblem = (schema: ValueSchema, value: ArgValue, path: string): string | undefined => {
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      return `${path} must be at least ${schema.minimum}`;
    if (schema.maximum !== undefined && value > schema.maximum)
      return `${path} must be at most ${schema.maximum}`;
  }
  if (typeof value !== "string") return undefined;
  // in characters, as JSON Schema counts: an emoji is one
  const { length } = [...value];
  if (schema.minLength !== undefined && length < schema.minLength)
    return `${path} must have at least ${schema.minLength} characters`;
  if (schema.maxLength !== undefined && length > schema.maxLength)
    return `${path} must have at most ${schema.maxLength} characters`;
  return schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)
    ? `${path} must match ${schema.pattern}`
    : undefined;
};

/** What is wrong with a list. */
const listProblem = (schema: ValueSchema, value: readonly ArgValue[], path: string): string | undefined => {
  if (schema.minItems !== undefined && value.length < schema.minItems)
    return `${path} must have at least ${schema.minItems} items`;
  if (schema.maxItems !== undefined && value.length > schema.maxItems)
    return `${path} must have at most ${schema.maxItems} items`;
  const { items } = schema;
  if (items === undefined) return undefined;
  return value
    .map((item, index) => problemAt(items, item, `${path}[${index}]`))
    .find((each) => each !== undefined);
};

/** What is wrong with an object. */
const objectProblem = (
  schema: ValueSchema,
  value: Readonly<Record<string, ArgValue>>,
  path: string
): string | undefined => {
  const missing = (schema.required ?? []).find((name) => !Object.hasOwn(value, name));
  if (missing !== undefined) return `${path} must have ${missing}`;
  for (const [name, each] of Object.entries(value)) {
    const fieldPath = `${path}.${name}`;
    const declared = schema.properties !== undefined && Object.hasOwn(schema.properties, name);
    const field = declared ? schema.properties?.[name] : schema.additionalProperties;
    if (field === false) return `${fieldPath} is not a field it takes`;
    const problem = isRecord(field) ? problemAt(field, each, fieldPath) : undefined;
    if (problem !== undefined) return problem;
  }
  return undefined;
};

/** What is wrong with a value, at a place in the whole. */
const problemAt = (schema: ValueSchema, value: ArgValue, path: string): string | undefined => {
  const problem = kindProblem(schema, value, path) ?? leafProblem(schema, value, path);
  if (problem !== undefined) return problem;
  if (schema.anyOf !== undefined && schema.anyOf.every((each) => problemAt(each, value, path) !== undefined))
    return `${path} fits none of its forms`;
  if (isArgList(value)) return listProblem(schema, value, path);
  return isArgObject(value) ? objectProblem(schema, value, path) : undefined;
};

/**
 * What is wrong with a value, in a sentence.
 *
 * @param schema - the control's schema.
 * @param value - the value.
 * @returns the sentence; none when it fits.
 */
export const schemaProblem = (schema: ValueSchema, value: ArgValue): string | undefined => {
  try {
    return problemAt(schema, value, "the value");
  } catch (error) {
    // a pattern that is no regular expression is the control's mistake: no value can be known to fit it
    return error instanceof Error ? error.message : String(error);
  }
};
