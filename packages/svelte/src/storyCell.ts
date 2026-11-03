/**
 * A value Svelte follows, held outside a component: what the renderer keeps of a drawn story (its args, its scene, its
 * texts), so the host's template draws again what read a value that changed, and only that.
 *
 * @remarks
 * Svelte's `$state` exists only in files its compiler reads; `createSubscriber` is its way for plain code to be followed,
 * so the renderer stays a TypeScript module, built and published as one.
 *
 * @module
 */
import { createSubscriber } from "svelte/reactivity";

/** A value Svelte follows. */
export type StoryCell<TValue> = {
  /** The value; a template, a derived value or an effect that reads it follows it. */
  readonly current: TValue;
  /**
   * Replaces the value; what read it is drawn again, unless the new value is the same.
   *
   * @param value - the new value.
   */
  readonly set: (value: TValue) => void;
};

/**
 * A value Svelte follows.
 *
 * @param initial - its first value.
 */
export const storyCell = <TValue>(initial: TValue): StoryCell<TValue> => {
  let value = initial;
  // set while something reads the value: no one is told when no one reads it
  let notify = (): void => undefined;
  const subscribe = createSubscriber((update) => {
    notify = update;
    return (): void => {
      notify = (): void => undefined;
    };
  });
  return {
    get current(): TValue {
      subscribe();
      return value;
    },
    set: (next: TValue): void => {
      if (Object.is(next, value)) return;
      value = next;
      notify();
    }
  };
};
