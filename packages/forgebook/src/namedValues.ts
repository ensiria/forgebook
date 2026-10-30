/**
 * The values a source names for the props panel (`StorySource.namedValues`): a story's own value found by name for
 * the panel to show, and a name the panel sent turned back into the value for the story.
 *
 * @remarks
 * A component or a function cannot cross between the shell and a frame; its name can, and each side holds the same
 * source. Pure.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

import { type ArgValue, isChoiceList, isNamedArg, type NamedArg, type PanelArgs } from "./messages.ts";

/** A source's named values: by the type as the props write it, then by name. */
export type NamedValues = NonNullable<StorySource["namedValues"]>;

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

/**
 * A story's own args as the panel can show them: texts, numbers, booleans, `null` and lists of texts and numbers (a
 * multiple choice's) as they are, a named value by its name; anything else is left out.
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
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        isChoiceList(value)
      ) {
        return [[name, value]];
      }
      const named = nameOf(value, namedValues);
      return named === undefined ? [] : [[name, named]];
    })
  );

/**
 * The panel's values as the story takes them: a name turned back into its value; a name the source no longer offers
 * is left out, so the story keeps its own.
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
      if (!isNamedArg(value)) return [[name, value]];
      const known = namedValues[value.of]?.[value.named];
      return known === undefined ? [] : [[name, known]];
    })
  );
