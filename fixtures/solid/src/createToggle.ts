/**
 * A value that flips between on and off.
 *
 * @module
 */
import { type Accessor, createSignal } from "solid-js";

/**
 * A toggle.
 *
 * @param initial - whether it starts on.
 * @returns whether it is on, and what flips it.
 */
export const createToggle = (initial = false): readonly [Accessor<boolean>, () => void] => {
  const [isOn, setOn] = createSignal(initial);
  return [isOn, () => setOn(!isOn())];
};
