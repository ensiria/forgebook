/**
 * The statistics the evaluation reports, written out so a reader can check them: means, a percentile interval from a
 * bootstrap, Krippendorff's alpha, Wilson's interval, a sign-flip test, and the number of pairs a result needs.
 *
 * @remarks
 * Pure and seeded: the same sheets and seed give the same numbers on any machine. Nothing here assumes a distribution
 * the data may not have, except the sample size, which is a plan and says so.
 *
 * @module
 */
import type { Random } from "./random.ts";

/** An estimate with its 95 % interval. */
export type Estimate = {
  /** The estimate. */
  readonly value: number;
  /** The interval's low end. */
  readonly low: number;
  /** The interval's high end. */
  readonly high: number;
};

/**
 * The mean of a list; `NaN` for an empty one.
 *
 * @param values - the numbers.
 */
export const mean = (values: readonly number[]): number =>
  values.length === 0 ? Number.NaN : values.reduce((sum, each) => sum + each, 0) / values.length;

/**
 * A quantile of a list, by linear interpolation between the closest ranks.
 *
 * @param values - the numbers.
 * @param share - the quantile, from 0 to 1.
 */
export const quantile = (values: readonly number[], share: number): number => {
  const sorted = [...values].sort((first, second) => first - second);
  if (sorted.length === 0) return Number.NaN;
  const at = (sorted.length - 1) * share;
  const low = sorted[Math.floor(at)] ?? Number.NaN;
  const high = sorted[Math.ceil(at)] ?? Number.NaN;
  return low + (high - low) * (at - Math.floor(at));
};

/**
 * A list drawn from another with replacement, as long as it.
 *
 * @param items - the list.
 * @param random - the generator.
 */
export const resampled = <TItem>(items: readonly TItem[], random: Random): TItem[] =>
  Array.from({ length: items.length }, () => items[Math.floor(random() * items.length)]).filter(
    (item): item is TItem => item !== undefined
  );

/**
 * A crossed bootstrap: the tasks and the judges each drawn again with replacement, the statistic recomputed, and the
 * 2.5th and 97.5th percentiles taken. Drawing tasks, not pairs, keeps a task's repeats together, since they are not
 * independent; drawing judges carries the judges' own spread into the interval.
 *
 * @param tasks - the tasks.
 * @param judges - the judges.
 * @param statistic - the statistic on a draw; `NaN` when the draw has nothing to compute it on.
 * @param random - the generator.
 * @param draws - how many draws.
 */
export const crossedBootstrap = (
  tasks: readonly string[],
  judges: readonly string[],
  statistic: (tasks: readonly string[], judges: readonly string[]) => number,
  random: Random,
  draws = 10_000
): Estimate => {
  const values: number[] = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const value = statistic(resampled(tasks, random), resampled(judges, random));
    if (!Number.isNaN(value)) values.push(value);
  }
  return { value: statistic(tasks, judges), low: quantile(values, 0.025), high: quantile(values, 0.975) };
};

/**
 * A two-sided sign-flip test at the level of tasks: under no effect, which side is better is chance, so each task's
 * scores are flipped together at random and the mean compared with the one observed.
 *
 * @param byTask - each task's scores, oriented so a positive one favours the arm with Forgebook.
 * @param random - the generator.
 * @param draws - how many draws.
 * @returns the share of draws at least as far from zero as the observed mean.
 */
export const signFlipP = (byTask: readonly (readonly number[])[], random: Random, draws = 10_000): number => {
  const observed = Math.abs(mean(byTask.flat()));
  let extreme = 0;
  for (let draw = 0; draw < draws; draw += 1) {
    const flipped = byTask.flatMap((scores) => {
      const sign = random() < 0.5 ? -1 : 1;
      return scores.map((score) => score * sign);
    });
    if (Math.abs(mean(flipped)) >= observed - 1e-12) extreme += 1;
  }
  return (extreme + 1) / (draws + 1);
};

/** The sum of the squared differences of every ordered pair of distinct places in a list. */
const squaredDifferences = (values: readonly number[]): number => {
  let sum = 0;
  for (const [index, first] of values.entries()) {
    for (const second of values.slice(index + 1)) sum += 2 * (first - second) ** 2;
  }
  return sum;
};

/**
 * Krippendorff's alpha with the interval distance: 1 is perfect agreement between judges, 0 the agreement of chance.
 *
 * @param units - each unit's values, one per judge who scored it; a unit with fewer than two is left out.
 */
export const krippendorffAlpha = (units: readonly (readonly number[])[]): number => {
  const pairable = units.filter((values) => values.length >= 2);
  const all = pairable.flat();
  const total = all.length;
  if (total < 2) return Number.NaN;
  const observed =
    pairable.reduce((sum, values) => sum + squaredDifferences(values) / (values.length - 1), 0) / total;
  const expected = squaredDifferences(all) / (total * (total - 1));
  return expected === 0 ? 1 : 1 - observed / expected;
};

/**
 * Wilson's 95 % interval for a share.
 *
 * @param successes - how many succeeded.
 * @param trials - how many tried.
 */
export const wilson = (successes: number, trials: number): Estimate => {
  if (trials === 0) return { value: Number.NaN, low: Number.NaN, high: Number.NaN };
  const z = 1.959_964;
  const share = successes / trials;
  const centre = (share + (z * z) / (2 * trials)) / (1 + (z * z) / trials);
  const half =
    (z * Math.sqrt((share * (1 - share)) / trials + (z * z) / (4 * trials * trials))) /
    (1 + (z * z) / trials);
  return { value: share, low: centre - half, high: centre + half };
};

/**
 * The standard normal distribution's quantile (Acklam's approximation, good to about 1e-9).
 *
 * @param share - the probability, strictly between 0 and 1.
 */
export const normalQuantile = (share: number): number => {
  const a = [
    -39.696_830_286_653_76, 220.946_098_424_520_5, -275.928_510_446_968_7, 138.357_751_867_269,
    -30.664_798_066_147_16, 2.506_628_277_459_239
  ];
  const b = [
    -54.476_098_798_224_06, 161.585_836_858_040_9, -155.698_979_859_886_6, 66.801_311_887_719_72,
    -13.280_681_552_885_72
  ];
  const c = [
    -0.007_784_894_002_430_293, -0.322_396_458_041_136_4, -2.400_758_277_161_838, -2.549_732_539_343_734,
    4.374_664_141_464_968, 2.938_163_982_698_783
  ];
  const d = [
    0.007_784_695_709_041_462, 0.322_467_129_070_039_8, 2.445_134_137_142_996, 3.754_408_661_907_416
  ];
  const poly = (coefficients: readonly number[], x: number): number =>
    coefficients.reduce((sum, coefficient) => sum * x + coefficient, 0);
  const low = 0.024_25;
  if (share < low) {
    const q = Math.sqrt(-2 * Math.log(share));
    return poly(c, q) / (poly(d, q) * q + 1);
  }
  if (share > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - share));
    return -poly(c, q) / (poly(d, q) * q + 1);
  }
  const q = share - 0.5;
  const r = q * q;
  return (poly(a, r) * q) / (poly(b, r) * r + 1);
};

/** What a sample size is planned for. */
export type PlanRequest = {
  /** The share of judgements expected to favour the arm with Forgebook, ties counted half: 0.5 is no effect. */
  readonly winRate: number;
  /** The test's level, two-sided. */
  readonly alpha: number;
  /** The chance of seeing the effect if it is real. */
  readonly power: number;
  /** How alike two repeats of one task are (the intraclass correlation), from 0 (independent) to 1 (identical). */
  readonly icc: number;
  /** How many times each task runs in each arm. */
  readonly repeats: number;
};

/** A planned sample. */
export type Plan = {
  /** Independent pairs a one-sample test of the win rate needs. */
  readonly independentPairs: number;
  /** The pairs needed once repeats of a task are counted as the partly alike samples they are. */
  readonly pairs: number;
  /** The tasks that makes. */
  readonly tasks: number;
};

/**
 * The pairs and tasks a win rate needs to be told from 0.5 (normal approximation to the binomial, inflated by the
 * design effect `1 + (repeats - 1) × icc`).
 *
 * @param request - the effect expected and the test.
 */
export const plannedSample = (request: PlanRequest): Plan => {
  const { winRate, alpha, power, icc, repeats } = request;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zPower = normalQuantile(power);
  const independentPairs = Math.ceil(
    ((zAlpha * 0.5 + zPower * Math.sqrt(winRate * (1 - winRate))) / (winRate - 0.5)) ** 2
  );
  const pairs = Math.ceil(independentPairs * (1 + (repeats - 1) * icc));
  return { independentPairs, pairs, tasks: Math.ceil(pairs / repeats) };
};
