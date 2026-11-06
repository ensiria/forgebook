/**
 * Storybook's form of an address's `args`, read as Storybook's `parseArgsParam` reads it, and its values typed for the
 * props that receive them. Loaded only for a link in that form (`addressArgsParam.ts`). Pure.
 *
 * @remarks
 * `name:value` pairs split by `;`, a list as `tags[0]:a;tags[1]:b`, `tags[]:a;tags[]:b` or `tags:a;tags:b`, and the marked
 * values `!true`, `!false`, `!null`, `!hex(ff0000)`, `!rgba(1,2,3,0.5)`, `!hsl(…)`, `!date(…)`. Its unmarked values are
 * only text, whatever they look like: whether `5` is a number and `007` a text depends on the prop, which the story
 * declares later, so they stay text here and the check types them, keeping what Storybook's own reading loses (its `007`
 * becomes `7`). Storybook leaves out any text outside a few characters as unsafe; here every value meets the same check as
 * a JSON one (`addressArgs.ts`), so non-ASCII text is read.
 *
 * What cannot be held is named as unread: an object (`style.color:red`), a list with a hole (`tags[1]:b`, which patches a
 * list the story owns), `!undefined`, a date that is none.
 *
 * @module
 */
import type { ArgsParamRead } from "./addressArgsParam.ts";
import type { PanelProp } from "./argTypes.ts";
import { type ArgValue, isChoiceList, UNSET_ARG } from "./messages.ts";

/** A number as Storybook's links write it. */
const NUMBER_TEXT = /^-?[0-9]+(\.[0-9]+)?$/;

/** A colour as Storybook writes it after its `!`. */
const COLOR =
  /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i;

/** An arg's name in Storybook's form, with a list's index: `tags[1]`, `tags[]`. */
const STORYBOOK_KEY = /^([^.[\]]+)(?:\[([0-9]*)\])?$/;

/**
 * What a text of a link is for a prop, whose type it does not carry: a number for a prop that takes numbers, a toggle's
 * value, a choice's option; a text otherwise.
 *
 * @param prop - a prop the panel sets.
 * @param text - the link's text.
 */
const typedText = (prop: PanelProp, text: string): string | number | boolean => {
  const option = (prop.choices ?? []).find((choice) => String(choice) === text);
  if (option !== undefined) return option;
  const isToggle = prop.control === "boolean" || (prop.control === undefined && prop.kind === "toggle");
  if (isToggle && (text === "true" || text === "false")) return text === "true";
  const isNumeric =
    prop.control === "number" ||
    prop.control === "range" ||
    prop.control === "date" ||
    (prop.control === undefined && prop.kind === "number") ||
    // a mixed union's number (`"sm" | number`): a text it takes too stays one only when the text is no number
    (prop.shape?.kind === "union" && prop.shape.of.some((member) => member.kind === "number")) ||
    (prop.shape?.kind === "list" && prop.shape.of.kind === "number");
  return isNumeric && NUMBER_TEXT.test(text) ? Number(text) : text;
};

/**
 * What a text is with no prop to type it: a number when it writes one, as Storybook reads it before it knows the props.
 *
 * @param text - the link's text.
 */
const untypedText = (text: string): string | number => (NUMBER_TEXT.test(text) ? Number(text) : text);

/**
 * A value of a link, typed for a prop.
 *
 * @param prop - the prop that receives it; none for an arg a page knows nothing of.
 * @param value - the link's value.
 */
const typedLinkValue = (prop: PanelProp | undefined, value: ArgValue): ArgValue => {
  if (typeof value === "string") return prop === undefined ? untypedText(value) : typedText(prop, value);
  if (!isChoiceList(value)) return value;
  return value.map((item) => {
    if (prop === undefined) return typeof item === "string" ? untypedText(item) : item;
    const typed = typeof item === "string" ? typedText(prop, item) : item;
    return typeof typed === "boolean" ? String(typed) : typed;
  });
};

/**
 * A text decoded once more: Storybook's form goes through its own query parser after the address's. A `%` that starts no
 * escape is the text's own.
 *
 * @param text - the text.
 */
const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * A colour's text, as Storybook's reading writes it.
 *
 * @param marked - the value after its `!`.
 * @returns the text; none when it is no colour.
 */
const colorOf = (marked: string): string | undefined => {
  const color = COLOR.exec(marked);
  if (color === null) return undefined;
  const [, kind = "", first, second, third, alpha] = color;
  const unit = kind.toLowerCase().startsWith("hsl") ? "%" : "";
  return kind.toLowerCase().endsWith("a")
    ? `${kind}(${first}, ${second}${unit}, ${third}${unit}, ${alpha})`
    : `${kind}(${first}, ${second}${unit}, ${third}${unit})`;
};

/**
 * One of Storybook's values: its marked ones read, the others left as text.
 *
 * @param text - the value.
 * @returns the value; none when no arg can hold it.
 */
const storybookValue = (text: string): ArgValue | undefined => {
  if (!text.startsWith("!")) return text;
  if (text === "!undefined") return UNSET_ARG;
  if (text === "!null") return null;
  if (text === "!true") return true;
  if (text === "!false") return false;
  if (text.startsWith("!date(") && text.endsWith(")")) {
    const time = Date.parse(text.slice(6, -1).replaceAll(" ", "+"));
    return Number.isNaN(time) ? undefined : time;
  }
  if (text.startsWith("!hex(") && text.endsWith(")")) return `#${text.slice(5, -1)}`;
  // a mark that means nothing is the text's own, as Storybook reads it
  return colorOf(text.slice(1)) ?? text;
};

/** One `name:value` of Storybook's form: the index its key writes (`[1]`), none for `[]` or no bracket. */
type StorybookEntry = {
  /** Its index in a list, when its key writes one. */
  readonly index: number | undefined;
  /** Whether its key has a bracket: a list, even of one. */
  readonly isListed: boolean;
  /** Its value; none when no arg can hold it. */
  readonly value: ArgValue | undefined;
};

/**
 * What one arg's entries make: its value, or a list when there are several or a bracket says so, as Storybook repeats a
 * key for a list too (`tags:a;tags:b`).
 *
 * @param entries - its entries, in the address's order.
 * @returns the value; none when it cannot be held, a list with a hole among them.
 */
const valueOfEntries = (entries: readonly StorybookEntry[]): ArgValue | undefined => {
  const [only] = entries;
  if (entries.length === 1 && only !== undefined && !only.isListed) return only.value;
  const items = new Map<number, ArgValue | undefined>();
  for (const { index, value } of entries) items.set(index ?? items.size, value);
  const list = [...Array(items.size).keys()].map((index) => items.get(index));
  return isChoiceList(list) ? list : undefined;
};

/**
 * The name of an arg in a key: what comes before its first `.` or `[`.
 *
 * @param key - the key.
 */
const nameOfKey = (key: string): string => key.split(/[.[]/, 1)[0] || key;

/**
 * One `name:value` of Storybook's form, or the name to report when it is none that can be held.
 *
 * @param part - the text between two `;`.
 */
const storybookPart = (part: string): { readonly name: string; readonly entry?: StorybookEntry } => {
  const colon = part.indexOf(":");
  const key = decoded(colon === -1 ? part : part.slice(0, colon));
  const match = colon <= 0 ? null : STORYBOOK_KEY.exec(key);
  const name = match?.[1];
  if (name === undefined) return { name: key === "" ? part : nameOfKey(key) };
  const bracket = match?.[2];
  const index = bracket === undefined || bracket === "" ? undefined : Number(bracket);
  const value = storybookValue(decoded(part.slice(colon + 1)));
  return { name, entry: { index, isListed: bracket !== undefined, value } };
};

/**
 * Storybook's form, read.
 *
 * @param param - the parameter.
 */
export const readStorybookArgs = (param: string): ArgsParamRead => {
  const entries = new Map<string, StorybookEntry[]>();
  const unread = new Set<string>();
  for (const { name, entry } of param
    .split(";")
    .filter((each) => each !== "")
    .map(storybookPart)) {
    if (entry === undefined) unread.add(name);
    else {
      const ofName = entries.get(name);
      if (ofName === undefined) entries.set(name, [entry]);
      else ofName.push(entry);
    }
  }
  const read = [...entries].flatMap(([name, ofName]): [string, ArgValue][] => {
    const value = valueOfEntries(ofName);
    if (value === undefined) unread.add(name);
    return value === undefined ? [] : [[name, value]];
  });
  return {
    // an arg with an entry that cannot be read is not given in part
    args: Object.fromEntries(read.filter(([name]) => !unread.has(name))),
    link: { param, isWaiting: false, typeValue: typedLinkValue, unread: [...unread] }
  };
};
