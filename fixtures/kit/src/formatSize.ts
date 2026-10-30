/**
 * A fixture module for the catalogue's tests.
 *
 * @module
 */

/** A size's unit. */
export type SizeUnit = "px" | "rem";

/**
 * A size written with its unit.
 *
 * @param value - the number.
 * @param unit - the unit; px by default.
 */
export const formatSize = (value: number, unit: SizeUnit = "px"): string => `${value}${unit}`;

/**
 * A size from an object: a destructured parameter, named by its `@param` tag.
 *
 * @param size - the number and its unit.
 */
export const formatSizeOf = ({ value, unit }: { readonly value: number; readonly unit: SizeUnit }): string =>
  formatSize(value, unit);

/** The sizes, in order. */
export const SIZES = [8, 16] as const;
