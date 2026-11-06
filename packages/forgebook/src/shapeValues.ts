/**
 * What reads a value against its shape (`valueShape.ts`): whether it fits, what the panel starts from, what a story's own
 * arg looks like, and the worst case of each kind. Loaded with the first prop that has a shape, so a catalogue of plain
 * props never pays for it; the commands import it directly.
 *
 * @remarks
 * A link's author chooses the values, and a component may spread an object onto an element. What a type declares is
 * checked by name; what no type describes (`json`, `record`) is checked for what an element would run: an attribute that
 * runs a script or writes markup, Vue's marks for a property or a modifier (`.innerHTML`, `^onclick`), an address that
 * runs when opened, and a named value, which only a type offers. Pure.
 *
 * @module
 */
import { type ArgValue, isArgList, isArgObject, isArgValue, isNamedArg } from "./messages.ts";
import { type NamedValues, namedValueOf } from "./namedValues.ts";
import type { ShapeField, ValueShape } from "./valueShape.ts";
import { WORST_ARG_TEXT, WORST_NUMBER } from "./worstCase.ts";

/**
 * The names a free-form part of a value may not hold (`json`, `record`): an attribute that runs a script or writes
 * markup when a component spreads the object onto an element. A link's author chooses these names, and no type says
 * which are meant; an `on` word that is no event stays allowed.
 *
 * @param name - the name.
 */
export const isUnsafeFreeName = (name: string): boolean =>
  /^(dangerouslySetInnerHTML|innerHTML|outerHTML|srcdoc)$/i.test(name) ||
  /^[.^:@#]/.test(name) ||
  name.includes(":") ||
  (/^on/i.test(name) && !/^(once|one|only|online|onboarding|ongoing|onward)$/.test(name));

/** Whether a text in a free-form value is an address a browser would run. */
const isRunnableText = (text: string): boolean =>
  // browsers skip control characters and white space inside a scheme, so a link's `java\tscript:` is the same address
  /^(javascript|vbscript|data:text\/html)/i.test([...text].filter((each) => each > " ").join(""));

/** Whether a free-form value holds anything it may not hold, at any depth. */
const holdsUnsafePart = (value: ArgValue): boolean => {
  if (typeof value === "string") return isRunnableText(value);
  if (isNamedArg(value)) return true;
  if (isArgList(value)) return value.some(holdsUnsafePart);
  if (!isArgObject(value)) return false;
  return Object.entries(value).some(([name, each]) => isUnsafeFreeName(name) || holdsUnsafePart(each));
};

/** Whether a value fits a tuple's items. */
const fitsTuple = (items: readonly ValueShape[], value: ArgValue, namedValues: NamedValues): boolean =>
  isArgList(value) &&
  value.length === items.length &&
  items.every((item, index) => {
    const each = value[index];
    return each !== undefined && isValueOfShape(item, each, namedValues);
  });

/** Whether a value fits an object's fields, and names no other. */
const fitsObject = (fields: readonly ShapeField[], value: ArgValue, namedValues: NamedValues): boolean => {
  if (!isArgObject(value) || isNamedArg(value)) return false;
  const isKnown = Object.keys(value).every((name) => fields.some((field) => field.name === name));
  return (
    isKnown &&
    fields.every((field) => {
      const each = Object.hasOwn(value, field.name) ? value[field.name] : undefined;
      if (each === undefined) return !field.isRequired;
      return (each === null && field.isNullable === true) || isValueOfShape(field.shape, each, namedValues);
    })
  );
};

/** Whether a value fits a part only the source's named values fill, or a text where it takes one. */
const fitsNamed = (
  shape: { readonly type: string; readonly canTakeText?: true },
  value: ArgValue,
  namedValues: NamedValues
): boolean => {
  if (typeof value === "string") return shape.canTakeText === true;
  return (
    isNamedArg(value) &&
    value.of === shape.type &&
    namedValueOf(namedValues, value.of, value.named) !== undefined
  );
};

/**
 * Whether a value fits a shape: what the panel could have set. Names an object's type does not declare are refused, as
 * a prop the story does not declare is: a link must not reach an element's attributes through them.
 *
 * @param shape - the shape.
 * @param value - the value.
 * @param namedValues - the source's named values.
 */
export const isValueOfShape = (shape: ValueShape, value: ArgValue, namedValues: NamedValues): boolean => {
  switch (shape.kind) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean" && (shape.only === undefined || shape.only === value);
    case "choice":
      return (typeof value === "string" || typeof value === "number") && shape.values.includes(value);
    case "list":
      return isArgList(value) && value.every((item) => isValueOfShape(shape.of, item, namedValues));
    case "tuple":
      return fitsTuple(shape.items, value, namedValues);
    case "object":
      return fitsObject(shape.fields, value, namedValues);
    case "record":
      return (
        isArgObject(value) &&
        !isNamedArg(value) &&
        Object.entries(value).every(
          ([name, each]) => !isUnsafeFreeName(name) && isValueOfShape(shape.of, each, namedValues)
        )
      );
    case "union":
      return shape.of.some((member) => isValueOfShape(member, value, namedValues));
    case "named":
      return fitsNamed(shape, value, namedValues);
    case "json":
      return isArgValue(value) && !holdsUnsafePart(value);
    case "like":
      return isValueOfShape(shapeOfValue(shape.value), value, namedValues);
  }
};

/**
 * The value a shape starts from when the panel first gives it one: what a required part must hold, so a value the
 * panel sends always fits its type.
 *
 * @param shape - the shape.
 * @param namedValues - the source's named values.
 * @returns the value; none when the source names none for a part that needs one.
 */
export const startValueOf = (shape: ValueShape, namedValues: NamedValues): ArgValue | undefined => {
  switch (shape.kind) {
    case "text":
      return "";
    case "number":
      return 0;
    case "boolean":
      return shape.only ?? false;
    case "choice":
      return shape.values[0];
    case "list":
      return [];
    case "record":
      return {};
    case "json":
      return null;
    case "like":
      return startValueOf(shapeOfValue(shape.value), namedValues);
    case "tuple": {
      const items = shape.items.map((item) => startValueOf(item, namedValues));
      return items.every((item) => item !== undefined)
        ? items.filter((item) => item !== undefined)
        : undefined;
    }
    case "object": {
      const fields = shape.fields
        .filter((field) => field.isRequired)
        .map((field): [string, ArgValue | undefined] => [field.name, startValueOf(field.shape, namedValues)]);
      return fields.every(([, each]) => each !== undefined)
        ? Object.fromEntries(fields.flatMap(([name, each]) => (each === undefined ? [] : [[name, each]])))
        : undefined;
    }
    case "union":
      return shape.of.map((member) => startValueOf(member, namedValues)).find((start) => start !== undefined);
    case "named": {
      if (Object.hasOwn(namedValues, shape.type)) {
        const [first] = Object.keys(namedValues[shape.type] ?? {});
        if (first !== undefined) return { of: shape.type, named: first };
      }
      return shape.canTakeText === true ? "" : undefined;
    }
  }
};

/**
 * The shape a story's own arg shows, for an arg no type describes: fields from its names, a list's items from its
 * items when they all look alike, JSON for the rest.
 *
 * @param value - the arg's value.
 */
export const shapeOfValue = (value: ArgValue): ValueShape => {
  if (typeof value === "string") return { kind: "text" };
  if (typeof value === "number") return { kind: "number" };
  if (typeof value === "boolean") return { kind: "boolean" };
  if (isNamedArg(value)) return { kind: "named", type: value.of };
  if (isArgList(value)) {
    const shapes = [...new Set(value.map((item) => JSON.stringify(shapeOfValue(item))))];
    const [first] = value;
    return {
      kind: "list",
      of: shapes.length === 1 && first !== undefined ? shapeOfValue(first) : { kind: "json" }
    };
  }
  if (isArgObject(value)) {
    return {
      kind: "object",
      fields: Object.entries(value).map(([name, each]) => ({
        name,
        shape: shapeOfValue(each),
        isRequired: false
      }))
    };
  }
  return { kind: "json" };
};

/**
 * A shape with what a story's own arg looks like read from it.
 *
 * @param shape - the shape.
 */
export const resolvedShape = (shape: ValueShape): ValueShape =>
  shape.kind === "like" ? shapeOfValue(shape.value) : shape;

/** The longest text a `file` control keeps: a link holds the file, and a server refuses a longer address. */
export const MOST_FILE_TEXT = 8000;

/** What a `file` control keeps: pictures, sound and film, a plain text and a PDF, none of which a browser runs as a page. */
const FILE_TYPES =
  /^data:((image\/(png|jpeg|gif|webp|avif|bmp|x-icon))|(audio\/[\w.+-]+)|(video\/[\w.+-]+)|text\/plain|application\/pdf)(;[\w=.+-]+)*,/i;

/**
 * Whether a text is what a `file` control sets: a small file as a `data:` address, of a type it keeps.
 *
 * @param value - the text.
 */
export const isFileText = (value: ArgValue): boolean =>
  typeof value === "string" && value.length <= MOST_FILE_TEXT && FILE_TYPES.test(value);

/**
 * Whether a value is what a `file` control sets.
 *
 * @param value - the value.
 */
export const isFileList = (value: ArgValue): boolean => isArgList(value) && value.every(isFileText);

/** How many items a list at the top takes in the worst case: more than a row or a page of a list lays out comfortably. */
const WORST_ITEMS = 12;

/** How many items a list inside another part takes: several levels of many would write an address no server takes. */
const WORST_NESTED_ITEMS = 2;

/** The longest worst value kept, as JSON: an address holds it, and a server refuses a longer one. */
const MOST_WORST_TEXT = 3000;

/** A tuple's worst value: each item's, or what it must hold; none when no item has a worst case. */
const worstTuple = (
  shapes: readonly ValueShape[],
  namedValues: NamedValues,
  depth: number
): ArgValue | undefined => {
  const items = shapes.map(
    (item) => worstAt(item, namedValues, depth + 1) ?? startValueOf(item, namedValues)
  );
  const fitted = items.filter((item) => item !== undefined);
  const hasWorst = shapes.some((item) => worstAt(item, namedValues, depth + 1) !== undefined);
  return hasWorst && fitted.length === items.length ? fitted : undefined;
};

/** An object's worst value: each field's, or what a required one must hold; none when no field has a worst case. */
const worstObject = (
  shapes: readonly ShapeField[],
  namedValues: NamedValues,
  depth: number
): ArgValue | undefined => {
  const fields = shapes.flatMap((field): [string, ArgValue, boolean][] => {
    const worst = worstAt(field.shape, namedValues, depth + 1);
    if (worst !== undefined) return [[field.name, worst, true]];
    const start = field.isRequired ? startValueOf(field.shape, namedValues) : undefined;
    return start === undefined ? [] : [[field.name, start, false]];
  });
  const isWhole = shapes.every((field) => !field.isRequired || fields.some(([name]) => name === field.name));
  return isWhole && fields.some(([, , isWorst]) => isWorst)
    ? Object.fromEntries(fields.map(([name, value]) => [name, value]))
    : undefined;
};

/** A shape's worst value, however long. */
const worstAt = (shape: ValueShape, namedValues: NamedValues, depth: number): ArgValue | undefined => {
  switch (shape.kind) {
    case "text":
      return WORST_ARG_TEXT;
    case "number":
      return WORST_NUMBER;
    case "like":
      return worstAt(shapeOfValue(shape.value), namedValues, depth);
    case "list": {
      const item = worstAt(shape.of, namedValues, depth + 1);
      const length = depth === 0 ? WORST_ITEMS : WORST_NESTED_ITEMS;
      return item === undefined ? undefined : Array.from({ length }, () => item);
    }
    case "tuple":
      return worstTuple(shape.items, namedValues, depth);
    case "object":
      return worstObject(shape.fields, namedValues, depth);
    case "union":
      return shape.of
        .map((member) => worstAt(member, namedValues, depth + 1))
        .find((each) => each !== undefined);
    default:
      return undefined;
  }
};

/**
 * A shape's worst value: an object's fields at their worst, a list of many items, a mixed union's first member that has a
 * worst case.
 *
 * @param shape - the shape.
 * @param namedValues - the source's named values, for a required part only they can fill.
 * @returns the value; none when a long text or a huge number has no place in it, or when the address could not hold it.
 */
export const worstOfShape = (shape: ValueShape, namedValues: NamedValues): ArgValue | undefined => {
  const worst = worstAt(shape, namedValues, 0);
  return worst !== undefined && JSON.stringify(worst).length <= MOST_WORST_TEXT ? worst : undefined;
};
