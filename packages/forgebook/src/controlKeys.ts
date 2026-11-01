/**
 * The keys that cycle the toolbar's controls: one character per control, pressed without a modifier (Shift goes the
 * other way), ignored while typing, as `/` and `[` `]` are; a letter, never one of the shell's own keys.
 *
 * @remarks
 * The catalogue sets the key of any control, its switches and Forgebook's own alike (`keys` in its configuration, by
 * control id; `false` takes one away); the ready-made switches have one by default. A reader changes or removes one
 * for themself (kept in their browser), over the catalogue's. A key is one letter (the shell's own keys are not letters),
 * never one another control has. Pure: keys and a view in, keys or a view out.
 *
 * @module
 */
import type { ViewSwitch } from "./switches.ts";

/** The ready-made switches' keys, by switch id: given only where the catalogue has that switch. */
export const DEFAULT_KEYS: Readonly<Record<string, string>> = {
  theme: "t",
  contrast: "c",
  lang: "l",
  dir: "d"
};

/** The keys of the controls, by control id. */
export type ControlKeys = Readonly<Record<string, string>>;

/** A reader's own keys, by control id: a key, or `null` for one they took away. */
export type ReaderKeys = Readonly<Record<string, string | null>>;

/**
 * A key as the shell keeps it: one letter, lower case; none when the text is not one.
 *
 * @param text - the key as written or pressed.
 */
export const keyOf = (text: string): string | undefined => {
  const key = text.toLowerCase();
  // a letter only: Shift turns a digit or a sign into another character, and the cycle could not go back
  return /^\p{L}$/u.test(key) ? key : undefined;
};

/**
 * Why a key cannot be given to a control, or none.
 *
 * @param key - the key.
 * @param id - the control's id.
 * @param keys - the other controls' keys.
 */
const keyProblem = (key: string, id: string, keys: ControlKeys): string | undefined => {
  if (keyOf(key) !== key) return `"${key}" is not one letter in lower case`;
  const holder = Object.entries(keys).find(([other, held]) => other !== id && held === key)?.[0];
  return holder === undefined ? undefined : `"${key}" is ${holder}'s already`;
};

/**
 * The catalogue's keys: the ready-made switches' defaults where it has them, then the keys it sets.
 *
 * @param controlIds - the ids of the catalogue's controls.
 * @param set - the keys its configuration sets, by control id; `false` takes a key away.
 * @returns the keys, or why they cannot be used.
 */
export const catalogueKeys = (
  controlIds: readonly string[],
  set: Readonly<Record<string, string | false>> = {}
): ControlKeys | string => {
  const unknown = Object.keys(set).find((id) => !controlIds.includes(id));
  if (unknown !== undefined) return `The keys name "${unknown}", which is no control of the catalogue`;
  const keys: Record<string, string> = {};
  // the keys the catalogue sets first, each checked against the others; then a default where its key is still free
  for (const id of controlIds) {
    const key = set[id];
    if (key === false || key === undefined) continue;
    const problem = keyProblem(key, id, keys);
    if (problem !== undefined) return `The key of ${id}: ${problem}`;
    keys[id] = key;
  }
  for (const id of controlIds) {
    const key = DEFAULT_KEYS[id];
    if (set[id] !== undefined || key === undefined || keyProblem(key, id, keys) !== undefined) continue;
    keys[id] = key;
  }
  return keys;
};

/**
 * The keys in use: the catalogue's, with the reader's own over them.
 *
 * @param catalogue - the catalogue's keys.
 * @param reader - the reader's own.
 */
export const shownKeys = (catalogue: ControlKeys, reader: ReaderKeys): ControlKeys =>
  Object.fromEntries([
    ...Object.entries(catalogue).filter(([id]) => !(id in reader)),
    ...Object.entries(reader).filter((entry): entry is [string, string] => entry[1] !== null)
  ]);

/**
 * The reader's keys with one control's key changed or taken away.
 *
 * @param catalogue - the catalogue's keys.
 * @param reader - the reader's own.
 * @param id - the control's id.
 * @param key - its new key; `null` takes it away.
 * @returns the reader's keys, or why the key cannot be given.
 */
export const withReaderKey = (
  catalogue: ControlKeys,
  reader: ReaderKeys,
  id: string,
  key: string | null
): ReaderKeys | string => {
  if (key !== null) {
    const problem = keyProblem(key, id, shownKeys(catalogue, reader));
    if (problem !== undefined) return problem;
  }
  // a key back to the catalogue's is no change of the reader's
  const { [id]: _previous, ...others } = reader;
  return (catalogue[id] ?? null) === key ? others : { ...others, [id]: key };
};

/** A key press, as the shell reads it. */
export type KeyPress = {
  /** The key's text. */
  readonly key: string;
  /** Whether Shift is held: the cycle goes the other way. */
  readonly shiftKey: boolean;
  /** Whether another modifier is held: the press is not a control's. */
  readonly hasModifier: boolean;
};

/**
 * The control a press asks to cycle, and which way.
 *
 * @param keys - the keys in use.
 * @param press - the press.
 * @returns the control's id and the step (1 forward, -1 back); none for a press no control has.
 */
export const pressedControl = (
  keys: ControlKeys,
  press: KeyPress
): { readonly id: string; readonly step: 1 | -1 } | undefined => {
  if (press.hasModifier) return undefined;
  const key = keyOf(press.key);
  const id = Object.entries(keys).find(([, held]) => held === key)?.[0];
  return id === undefined ? undefined : { id, step: press.shiftKey ? -1 : 1 };
};

/**
 * The value after another in a list of values, going round.
 *
 * @param values - the values, in order.
 * @param current - the value now.
 * @param step - 1 forward, -1 back.
 */
export const cycledValue = <TValue>(values: readonly TValue[], current: TValue, step: 1 | -1): TValue => {
  const index = values.indexOf(current);
  const next = (Math.max(index, 0) + step + values.length) % values.length;
  return values[next] ?? current;
};

/**
 * A switch's values in order, for its cycle.
 *
 * @param each - the switch.
 */
export const switchValues = (each: ViewSwitch): string[] => each.values.map((value) => value.value);
