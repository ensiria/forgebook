/**
 * Whether a story file writes a `play` for a story, read without running it: the story's own field, one assigned to it
 * (`Story.play = …`), or one it takes from a story of the file it spreads (`{ ...Other, args }`).
 *
 * @remarks
 * Among an object's fields the last one written wins, as when it runs. A `play` spread from another file, or written
 * by code the index cannot follow, is not seen. Pure.
 *
 * @module
 */
import type { ESTree } from "vite";

/** What the file's top level holds, by local name. */
export type StoryValues = {
  /** Each constant's value. */
  readonly values: ReadonlyMap<string, ESTree.Expression>;
  /** The properties assigned to each name after its declaration. */
  readonly assigned: ReadonlyMap<string, ReadonlyMap<string, ESTree.Expression>>;
};

/**
 * Whether an expression is a `play`: `undefined` written out takes one away.
 *
 * @param value - the field's value; none when there is no such field.
 */
const isPlay = (value: ESTree.Expression | undefined): boolean =>
  value !== undefined && !(value.type === "Identifier" && value.name === "undefined");

/**
 * What an object says of `play`, its last word first; none when it says nothing.
 *
 * @param object - the object.
 * @param top - the file's top level, for what it spreads.
 * @param seen - the names followed so far, so stories spreading each other end.
 */
const objectPlay = (
  object: ESTree.ObjectExpression,
  top: StoryValues,
  seen: ReadonlySet<string>
): boolean | undefined => {
  for (const property of object.properties.toReversed()) {
    if (property.type === "SpreadElement") {
      const spread = property.argument;
      const said = spread.type === "Identifier" ? namedPlay(spread.name, top, seen) : undefined;
      if (said !== undefined) return said;
    } else if (!property.computed && property.key.type === "Identifier" && property.key.name === "play") {
      return isPlay(property.value);
    }
  }
  return undefined;
};

/**
 * What a local name says of `play`: an assignment outranks its object's fields, since it runs after them.
 *
 * @param name - the local name.
 * @param top - the file's top level.
 * @param seen - the names followed so far.
 */
const namedPlay = (name: string, top: StoryValues, seen: ReadonlySet<string>): boolean | undefined => {
  if (seen.has(name)) return undefined;
  const assigned = top.assigned.get(name)?.get("play");
  if (assigned !== undefined) return isPlay(assigned);
  const value = top.values.get(name);
  return value?.type === "ObjectExpression" ? objectPlay(value, top, new Set([...seen, name])) : undefined;
};

/**
 * The index's field for a `play`: set when the story has one of its own or the meta does, which runs for every story
 * of the file; left out otherwise.
 *
 * @param local - the story's local name.
 * @param top - the file's top level.
 * @param metaPlay - the meta's `play`; none when it writes none.
 */
export const playField = (
  local: string,
  top: StoryValues,
  metaPlay: ESTree.Expression | undefined
): { readonly hasPlay?: true } =>
  namedPlay(local, top, new Set()) === true || isPlay(metaPlay) ? { hasPlay: true } : {};
