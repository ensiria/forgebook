/**
 * A speed in knots, written for Flow as React Native's own files are: its types stripped before the browser reads it.
 *
 * @flow
 * @module
 */

/** A speed's unit, as a crew member reads it. */
export type SpeedUnit = "kn" | "km/h";

/**
 * A speed, from knots, in the unit asked for, rounded to one decimal.
 *
 * @param knots - the speed in knots.
 * @param unit - the unit to write it in.
 */
export const speedText = (knots: number, unit: SpeedUnit): string =>
  unit === "kn" ? `${knots.toFixed(1)} kn` : `${(knots * 1.852).toFixed(1)} km/h`;
