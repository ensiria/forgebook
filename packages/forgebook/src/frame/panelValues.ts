/**
 * A story's values as they cross to the panel, and back: its own value found by name among the source's named values, and
 * a name the panel sent turned back into the value for the story. Read in the frame.
 *
 * @remarks
 * A component or a function cannot cross between the shell and a frame; its name can, and each side holds the same source.
 * Pure.
 *
 * @module
 */
import {
  type ArgValue,
  isArgList,
  isArgObject,
  isArgValue,
  isNamedArg,
  isUnsetArg,
  type NamedArg,
  type PanelArgs
} from "../messages.ts";
import { type NamedValues, namedValueOf } from "../namedValues.ts";

/**
 * The name of a value among the named ones, when it is one of them.
 *
 * @param value - a story's own arg.
 * @param namedValues - the source's named values.
 */
export const nameOf = (value: unknown, namedValues: NamedValues): NamedArg | undefined => {
  for (const [of, values] of Object.entries(namedValues)) {
    for (const [named, known] of Object.entries(values)) {
      if (known === value) return { of, named };
    }
  }
  return undefined;
};

/** The most parts of one arg the panel is told of: a table's data is the story's, and costs every message it crosses. */
const MOST_PARTS = 2000;

/** The deepest an arg the panel is told of nests: a cycle ends here too. */
const MOST_DEPTH = 12;

/** What walking one arg's value carries: the source's named values, and the parts still allowed. */
type PanelWalk = {
  /** The source's named values. */
  readonly namedValues: NamedValues;
  /** The parts still allowed. */
  parts: number;
};

/** A list as the panel can show it, or none when any item is not plain data. */
const panelListOf = (list: readonly unknown[], walk: PanelWalk, depth: number): ArgValue | undefined => {
  const items = list.map((item) => panelValueOf(item, walk, depth + 1));
  return items.every((item) => item !== undefined) ? items.filter((item) => item !== undefined) : undefined;
};

/** A plain object as the panel can show it, or none when any field is not plain data. */
const panelObjectOf = (value: object, walk: PanelWalk, depth: number): ArgValue | undefined => {
  const fields: [string, ArgValue][] = [];
  for (const [name, each] of Object.entries(value)) {
    if (each === undefined) continue;
    const shown = panelValueOf(each, walk, depth + 1);
    if (shown === undefined) return undefined;
    fields.push([name, shown]);
  }
  return Object.fromEntries(fields);
};

/**
 * A story's value as the panel can show it, or none when any part of it is not plain data.
 *
 * @param value - the value.
 * @param walk - what the walk carries.
 * @param depth - how deep it is.
 */
const panelValueOf = (value: unknown, walk: PanelWalk, depth: number): ArgValue | undefined => {
  walk.parts -= 1;
  if (walk.parts < 0 || depth > MOST_DEPTH) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return depth === 0 || Number.isFinite(value) ? value : undefined;
  const named = nameOf(value, walk.namedValues);
  if (named !== undefined) return named;
  if (Array.isArray(value)) return panelListOf(value, walk, depth);
  if (typeof value !== "object") return undefined;
  const prototype: unknown = Object.getPrototypeOf(value);
  // a date, a map or a class's instance is not what a link can hold, nor what JSON gives back
  return prototype === Object.prototype || prototype === null ? panelObjectOf(value, walk, depth) : undefined;
};

/**
 * A story's own args as the panel can show them: plain data as it is, a named value by its name at any depth; an arg
 * with anything else in it (an element, a function, a date) is left out whole.
 *
 * @param args - the story's args.
 * @param namedValues - the source's named values; none by default.
 */
export const panelArgsOf = (
  args: Readonly<Record<string, unknown>>,
  namedValues: NamedValues = {}
): PanelArgs =>
  Object.fromEntries(
    Object.entries(args).flatMap(([name, value]): [string, ArgValue][] => {
      const shown = panelValueOf(value, { namedValues, parts: MOST_PARTS }, 0);
      // a name no value may hold (`constructor`) would have the shell refuse the frame's whole message
      return shown === undefined || !isArgValue(shown) ? [] : [[name, shown]];
    })
  );

/**
 * A panel's value as the story takes it: each name turned back into its value, at any depth; a name the source no longer
 * offers is none.
 *
 * @param value - the value.
 * @param namedValues - the source's named values.
 */
const storyValueOf = (value: ArgValue, namedValues: NamedValues): unknown => {
  if (isNamedArg(value)) return namedValueOf(namedValues, value.of, value.named);
  if (isArgList(value))
    return value.map((item) => storyValueOf(item, namedValues)).filter((item) => item !== undefined);
  if (!isArgObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, each]): [string, unknown][] => {
      const known = storyValueOf(each, namedValues);
      return known === undefined ? [] : [[name, known]];
    })
  );
};

/**
 * The panel's values as the story takes them: a name turned back into its value, a name the source no longer offers
 * left out so the story keeps its own, and the panel's "no value" as `undefined` over the story's own.
 *
 * @param args - the panel's values.
 * @param namedValues - the source's named values; none by default.
 */
export const storyArgsOf = (
  args: PanelArgs,
  namedValues: NamedValues = {}
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(args).flatMap(([name, value]): [string, unknown][] => {
      if (isUnsetArg(value)) return [[name, undefined]];
      const known = storyValueOf(value, namedValues);
      return known === undefined ? [] : [[name, known]];
    })
  );
