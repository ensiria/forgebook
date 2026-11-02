/**
 * A function a story about logic documents.
 *
 * @module
 */

/**
 * Writes a count for a person.
 *
 * @param count - how many.
 * @returns the count in words up to three, in digits after.
 */
export const formatCount = (count: number): string => ["none", "one", "two", "three"][count] ?? String(count);
