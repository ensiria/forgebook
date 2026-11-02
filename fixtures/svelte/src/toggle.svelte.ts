/**
 * A value that flips, held with runes: logic a component uses, documented by its signature.
 *
 * @module
 */

/** A value that flips. */
export type Toggle = {
  /** Whether it is on. */
  readonly isOn: boolean;
  /** Flips it. */
  readonly flip: () => void;
};

/**
 * A value that flips.
 *
 * @param initial - whether it starts on.
 */
export const createToggle = (initial = false): Toggle => {
  let isOn = $state(initial);
  return {
    get isOn(): boolean {
      return isOn;
    },
    flip: (): void => {
      isOn = !isOn;
    }
  };
};
