/**
 * Seeded randomness: the runs' order, the judges' pairs and the bootstrap draw from it, so a seed gives the same result
 * on any machine and a published result can be recomputed.
 *
 * @module
 */

/** A source of numbers in `[0, 1)`. */
export type Random = () => number;

/**
 * A seeded generator (mulberry32): small, fast and good enough to shuffle and to resample, not for secrets.
 *
 * @param seed - any whole number.
 */
export const seeded = (seed: number): Random => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/**
 * A shuffled copy of a list (Fisher–Yates).
 *
 * @param items - the list, left as it is.
 * @param random - the generator.
 */
export const shuffled = <TItem>(items: readonly TItem[], random: Random): TItem[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index];
    const swapped = copy[other];
    if (held === undefined || swapped === undefined) continue;
    copy[index] = swapped;
    copy[other] = held;
  }
  return copy;
};

/**
 * A short code that names something without saying what: a run to the judges, a pair.
 *
 * @param random - the generator.
 * @param length - how many characters.
 */
export const code = (random: Random, length = 6): string => {
  // no 0, 1, l, o: a judge copies these by hand into a sheet
  const alphabet = "23456789abcdefghijkmnpqrstuvwxyz";
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)] ?? "x").join("");
};
