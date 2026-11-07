/**
 * An arg's condition, `argTypes.<name>.if` (Storybook's): whether the panel shows the arg, from another arg's or a
 * global's value of the moment. Read in the frame, tested in the shell. Pure.
 *
 * @remarks
 * `{ arg: "kind", eq: "link" }` shows the arg while `kind` is `link`, and `{ global: "theme", neq: "dark" }` reads the
 * view's switch instead. `truthy`, `exists`, `eq` and `neq` test the value, one at a time; none tests that it is truthy. A
 * condition hides an arg's control and nothing else: a value the address or the story sets still reaches the story, as in
 * Storybook. Only what crosses between the documents is kept: a condition comparing with an object or a function, or
 * that names neither an arg nor a global, is not one, and shows the arg.
 *
 * @module
 */

/** What a condition can compare a value with. */
export type ConditionValue = string | number | boolean | null | readonly (string | number)[];

/** An arg's condition: what it reads, and how it tests it. */
export type ArgCondition = {
  /** The arg it reads; none when it reads a global. */
  readonly arg?: string;
  /** The global it reads: a switch's id; none when it reads an arg. */
  readonly global?: string;
  /** Whether the value should be truthy (`true`, the default test) or falsy. */
  readonly truthy?: boolean;
  /** Whether the value should be set, or not set. */
  readonly exists?: boolean;
  /** What the value should be. */
  readonly eq?: ConditionValue;
  /** What the value should not be. */
  readonly neq?: ConditionValue;
};

/** Whether a value can be compared with: it crosses between the documents, and compares as its JSON. */
const isConditionValue = (value: unknown): value is ConditionValue =>
  value === null ||
  ["string", "number", "boolean"].includes(typeof value) ||
  (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number"));

/**
 * An `if` as it crosses between the documents: only the fields it reads, since anything else may be a function, which
 * cannot be sent and would stop the frame from reporting at all.
 *
 * @param value - the entry's `if`.
 * @returns the condition; none when it is not one.
 */
export const argConditionOf = (value: unknown): ArgCondition | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const arg: unknown = Reflect.get(value, "arg");
  const global: unknown = Reflect.get(value, "global");
  const truthy: unknown = Reflect.get(value, "truthy");
  const exists: unknown = Reflect.get(value, "exists");
  const eq: unknown = Reflect.get(value, "eq");
  const neq: unknown = Reflect.get(value, "neq");
  if ((typeof arg === "string") === (typeof global === "string")) return undefined;
  if (eq !== undefined && !isConditionValue(eq)) return undefined;
  if (neq !== undefined && !isConditionValue(neq)) return undefined;
  return {
    ...(typeof arg === "string" ? { arg } : {}),
    ...(typeof global === "string" ? { global } : {}),
    ...(typeof truthy === "boolean" ? { truthy } : {}),
    ...(typeof exists === "boolean" ? { exists } : {}),
    ...(eq === undefined ? {} : { eq }),
    ...(neq === undefined ? {} : { neq })
  };
};

/**
 * Whether a value received from a frame is an arg's condition.
 *
 * @param value - any value.
 */
export const isArgCondition = (value: unknown): value is ArgCondition => argConditionOf(value) !== undefined;

/**
 * Whether two values are the same, a list by its items.
 *
 * @param first - one value.
 * @param second - the other.
 */
const isSameValue = (first: unknown, second: unknown): boolean =>
  JSON.stringify(first) === JSON.stringify(second);

/**
 * Whether the panel shows an arg with a condition.
 *
 * @param condition - its condition; none shows it.
 * @param args - the values of the moment, by arg.
 * @param globals - the values of the switches, by id.
 */
export const isArgShown = (
  condition: ArgCondition | undefined,
  args: Readonly<Record<string, unknown>>,
  globals: Readonly<Record<string, unknown>>
): boolean => {
  if (condition === undefined) return true;
  const value = condition.arg === undefined ? globals[condition.global ?? ""] : args[condition.arg];
  if (condition.eq !== undefined) return isSameValue(value, condition.eq);
  if (condition.neq !== undefined) return !isSameValue(value, condition.neq);
  if (condition.exists !== undefined) return condition.exists === (value !== undefined);
  return (condition.truthy ?? true) === Boolean(value);
};
