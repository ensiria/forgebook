/**
 * A toggle with runes.
 *
 * @module
 */

/**
 * A value that flips.
 *
 * @param initial - where it starts.
 */
export const createToggle = (initial = false): { readonly current: boolean; flip: () => void } => {
  let current = $state(initial);
  return {
    get current(): boolean {
      return current;
    },
    flip: (): void => {
      current = !current;
    }
  };
};
