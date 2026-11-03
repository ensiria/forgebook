/**
 * A function a story about logic documents.
 *
 * @module
 */

/**
 * Writes a count for a person.
 *
 * @param count - how many.
 * @returns the count in words.
 */
export const formatCount = (count: number): string => (count === 1 ? "one" : `${count}`);
