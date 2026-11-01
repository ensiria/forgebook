/**
 * What a metric's samples come to, and whether two runs agree.
 *
 * @module
 */
import type { Summary } from "./bench.types.ts";

/** Below this many samples a p95 is only the largest sample, so none is given. */
const MIN_SAMPLES_FOR_P95 = 20;

/** The share of samples a p95 keeps below it. */
const P95 = 0.95;

/** A metric that moved between two runs. */
export type MovedMetric = {
  /** The metric's name. */
  readonly metric: string;
  /** Its median in the first run. */
  readonly first: number;
  /** Its median in the second run. */
  readonly second: number;
  /** The change, relative to the first run (0.2 for 20 %); 1 for a metric the second run lost. */
  readonly change: number;
};

/**
 * Sums up a metric's samples.
 *
 * @param values - the samples, in any order.
 * @throws when there are none: no median exists, and a zero would read as a measurement.
 */
export const summary = (values: readonly number[]): Summary => {
  const sorted = values.toSorted((first, second) => first - second);
  const count = sorted.length;
  const middle = Math.floor(count / 2);
  const low = sorted[0];
  const high = sorted[count - 1];
  const upper = sorted[middle];
  if (low === undefined || high === undefined || upper === undefined) throw new Error("no samples");
  const median = count % 2 === 1 ? upper : (upper + (sorted[middle - 1] ?? upper)) / 2;
  const base = { median, min: low, max: high, samples: count };
  if (count < MIN_SAMPLES_FOR_P95) return base;
  return { ...base, p95: sorted[Math.ceil(count * P95) - 1] ?? high };
};

/**
 * The metrics that moved more than a tolerance between two runs, or that the second lost, for the "reproducible within
 * 10 %" check.
 *
 * @param first - the first run's medians, by metric.
 * @param second - the second run's.
 * @param tolerance - the change allowed, as a share (0.1 for 10 %).
 */
export const comparedMedians = (
  first: Readonly<Record<string, number>>,
  second: Readonly<Record<string, number>>,
  tolerance: number
): MovedMetric[] =>
  Object.entries(first).flatMap(([metric, before]) => {
    const after = second[metric];
    // a metric that disappeared is no agreement: a check that skipped it would pass by losing the numbers
    if (after === undefined) return [{ metric, first: before, second: 0, change: 1 }];
    const change = Math.abs(after - before) / before;
    return change > tolerance ? [{ metric, first: before, second: after, change }] : [];
  });
