/**
 * The values a source names for the props panel (`StorySource.namedValues`), looked up by name; `frame/panelValues.ts`
 * finds a story's own value among them and turns a name back into its value.
 *
 * @remarks
 * A component or a function cannot cross between the shell and a frame; its name can, and each side holds the same
 * source. Pure.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

/** A source's named values: by the type as the props write it, then by name. */
export type NamedValues = NonNullable<StorySource["namedValues"]>;

/**
 * Whether a record holds a key itself, not through its prototype: `{}`'s `constructor` is `Object`, whose own
 * `constructor` is `Function`.
 *
 * @param record - the record.
 * @param key - the key.
 */
const hasOwn = (record: object, key: string): boolean => Object.hasOwn(record, key);

/**
 * The value a named value stands for, from the source's own entries only: a name the panel sent, or an address wrote,
 * never reaches a value through an object's prototype, so `{ of: "constructor", named: "constructor" }` is not
 * `Function`.
 *
 * @param namedValues - the source's named values.
 * @param of - the type the value is offered for.
 * @param named - the value's name.
 * @returns the value; none when the source does not name it.
 */
export const namedValueOf = (namedValues: NamedValues, of: string, named: string): unknown => {
  if (!hasOwn(namedValues, of)) return undefined;
  const values = namedValues[of];
  return values !== undefined && hasOwn(values, named) ? values[named] : undefined;
};
