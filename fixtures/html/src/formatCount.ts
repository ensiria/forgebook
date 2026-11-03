/**
 * Writes a count for a person.
 *
 * @module
 */

/**
 * A count as words: "none", "one", or the number.
 *
 * @param count - how many.
 * @returns the count written out.
 */
export const formatCount = (count: number): string => {
  if (count === 0) return "none";
  return count === 1 ? "one" : String(count);
};
