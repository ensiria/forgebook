/**
 * A value that flips between on and off.
 *
 * @module
 */
import { useState } from "preact/hooks";

/**
 * A toggle.
 *
 * @param initial - whether it starts on.
 * @returns whether it is on, and what flips it.
 */
export const useToggle = (initial = false): readonly [boolean, () => void] => {
  const [isOn, setOn] = useState(initial);
  return [isOn, () => setOn(!isOn)];
};
