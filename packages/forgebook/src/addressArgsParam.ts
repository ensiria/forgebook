/**
 * The `args` parameter of an address, in either form it comes in: Forgebook's own JSON (`{"label":"Hi","count":5}`), or
 * Storybook's (`label:Hi;count:5`), which a link from before a move to Forgebook carries. Pure.
 *
 * @remarks
 * The two are told apart by their first character: JSON's is `{`, and in Storybook's form a parameter starts with an
 * arg's name, which cannot hold one. Only JSON is read here: such a link is rare, so its reader (`storybookArgs.ts`) loads
 * when one is opened, and until then the address's values are none.
 *
 * A value that cannot be held is named in `unread`, never lost silently. Nor is one bad entry a reason to lose the others:
 * each is read on its own.
 *
 * @module
 */
import type { PanelProp } from "./argTypes.ts";
import { type ArgValue, isArgValue, type PanelArgs } from "./messages.ts";

/**
 * What an address's `args` still has to say once read, when it is not plain JSON of readable values. Kept until the
 * person changes a value, since the address must go on saying the same: Storybook's unmarked values have no JSON form
 * until they are typed.
 */
export type AddressLink = {
  /** The parameter as the address writes it. */
  readonly param: string;
  /** Whether it is Storybook's form and its reader has not loaded yet: its values are still to come. */
  readonly isWaiting: boolean;
  /**
   * Types one of its values for the prop that receives it, or for none where a page knows of no such prop, for a form
   * that does not say; none for JSON, which does.
   */
  readonly typeValue?: (prop: PanelProp | undefined, value: ArgValue) => ArgValue;
  /** The names of the values that could not be read; `args` for a parameter that could not be read at all. */
  readonly unread: readonly string[];
};

/** An address's `args` once read. */
export type ArgsParamRead = {
  /** The values read: as they will be checked, none of them yet known to be the story's. */
  readonly args: PanelArgs;
  /** What else the address says; none for plain JSON, or no parameter. */
  readonly link: AddressLink | undefined;
};

/** The name of a parameter that could not be read at all. */
const WHOLE_PARAMETER = "args";

/**
 * Forgebook's own form, read entry by entry.
 *
 * @param param - the parameter.
 */
const readJsonArgs = (param: string): ArgsParamRead => {
  let value: unknown;
  try {
    value = JSON.parse(param);
  } catch {
    return { args: {}, link: { param, isWaiting: false, unread: [WHOLE_PARAMETER] } };
  }
  const entries = typeof value === "object" && value !== null ? Object.entries(value) : [];
  const unread = entries.filter(([, each]) => !isArgValue(each)).map(([name]) => name);
  const read = entries.flatMap(([name, each]): [string, ArgValue][] =>
    isArgValue(each) ? [[name, each]] : []
  );
  return {
    args: Object.fromEntries(read),
    link: unread.length === 0 ? undefined : { param, isWaiting: false, unread }
  };
};

/**
 * What an address's `args` names, as far as the first screen reads it.
 *
 * @param param - the `args` parameter, decoded as `URLSearchParams` gives it.
 */
export const readArgsParam = (param: string | null): ArgsParamRead => {
  if (param === null || param === "") return { args: {}, link: undefined };
  return param.trimStart().startsWith("{")
    ? readJsonArgs(param)
    : { args: {}, link: { param, isWaiting: true, unread: [] } };
};

/**
 * What a link waiting for Storybook's reader names, once it has loaded.
 *
 * @param param - the parameter.
 * @param read - turns it into values: the reader's own, or one that types them for a page with no declaration.
 * @returns what it names; the whole parameter unread when the reader cannot load.
 */
export const readStorybookLink = async (
  param: string,
  read: (module: typeof import("./storybookArgs.ts"), param: string) => ArgsParamRead
): Promise<ArgsParamRead> => {
  try {
    return read(await import("./storybookArgs.ts"), param);
  } catch {
    return { args: {}, link: { param, isWaiting: false, unread: [WHOLE_PARAMETER] } };
  }
};
