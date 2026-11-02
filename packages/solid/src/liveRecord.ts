/**
 * A record whose every value is a signal of its own: what the Solid renderer hands a story as its args and its
 * `globals`, so new values reach the places that read them and nothing else runs again.
 *
 * @remarks
 * Solid's store would do the same, but it wraps every plain object and array inside as a store too: an option a story
 * passes (`value: OPTIONS[0]`) would no longer be the object the component compares it with. Here the values are kept
 * as they are, only one level deep. The record carries Solid's `$PROXY` mark, so `mergeProps` and `splitProps` (what
 * `<Button {...args} />` compiles to) read it lazily as they read a store, and a value set later, or a key added or
 * removed, still reaches a spread.
 *
 * @module
 */
import { $PROXY, type Accessor, batch, createSignal, type Setter } from "solid-js";

/** A record followed value by value, and how to set it. */
export type LiveRecord<TValue> = {
  /** The record: reading a value inside a reactive scope follows it. */
  readonly record: Readonly<Record<string, TValue>>;
  /**
   * Makes the record equal to new values: a value that did not change notifies no one.
   *
   * @param next - the new values.
   */
  readonly assign: (next: Readonly<Record<string, TValue>>) => void;
};

/** Two lists of keys hold the same names in the same order. */
const isSameKeys = (current: readonly string[], next: readonly string[]): boolean =>
  current.length === next.length && current.every((key, index) => key === next[index]);

/**
 * A record followed value by value.
 *
 * @param initial - its first values.
 */
export const liveRecord = <TValue>(initial: Readonly<Record<string, TValue>>): LiveRecord<TValue> => {
  const values = new Map<string, readonly [Accessor<TValue | undefined>, Setter<TValue | undefined>]>();
  const [keys, setKeys] = createSignal<readonly string[]>(Object.keys(initial), { equals: isSameKeys });
  /** The signal of a key, made the first time it is read or set. */
  const signalOf = (key: string): readonly [Accessor<TValue | undefined>, Setter<TValue | undefined>] => {
    const existing = values.get(key);
    if (existing !== undefined) return existing;
    const made = createSignal<TValue | undefined>(initial[key]);
    values.set(key, made);
    return made;
  };
  const record: Readonly<Record<string, TValue>> = new Proxy<Record<string, TValue>>(
    {},
    {
      get: (_target: Record<string, TValue>, key: string | symbol): unknown => {
        if (key === $PROXY) return record;
        if (typeof key !== "string") return undefined;
        return signalOf(key)[0]();
      },
      has: (_target: Record<string, TValue>, key: string | symbol): boolean =>
        key === $PROXY || (typeof key === "string" && keys().includes(key)),
      ownKeys: (): string[] => [...keys()],
      getOwnPropertyDescriptor: (
        _target: Record<string, TValue>,
        key: string | symbol
      ): PropertyDescriptor | undefined =>
        typeof key === "string" && keys().includes(key)
          ? { configurable: true, enumerable: true, value: signalOf(key)[0]() }
          : undefined,
      set: (): boolean => false,
      deleteProperty: (): boolean => false
    }
  );
  const assign = (next: Readonly<Record<string, TValue>>): void => {
    // one update for every value: what reads two args runs once
    batch(() => {
      for (const key of keys()) if (!(key in next)) signalOf(key)[1](undefined);
      // a function is a value here (an event's handler), not an update of the old one
      for (const [key, value] of Object.entries(next)) signalOf(key)[1](() => value);
      setKeys(Object.keys(next));
    });
  };
  return { record, assign };
};
