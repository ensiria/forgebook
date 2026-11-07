/**
 * The automatic measures, arm against arm: for each measure, its mean in each arm and the difference between the arms
 * computed task by task, with a 95 % interval from a bootstrap over tasks.
 *
 * @remarks
 * Pure. A measure a run could not take (a string in its measures) is left out of that measure's mean, never counted as
 * zero, and the count of runs it was taken on is reported beside it.
 *
 * @module
 */
import type { Arm, RunMeasures } from "./eval.types.ts";
import type { Random } from "./random.ts";
import { type Estimate, mean, quantile, resampled } from "./stats.ts";

/** Whether one of the app's checks broke: 1 when it failed, 0 when it passed, nothing when it says nothing. */
const brokenCheck = (check: RunMeasures["checks"]["test"]): number | undefined => {
  if (check.kind === "failed") return 1;
  return check.kind === "passed" ? 0 : undefined;
};

/** Whether `verify` called the change verified: 1 or 0, nothing when it did not run. */
const verified = (verify: RunMeasures["verify"]): number | undefined => {
  if (typeof verify === "string") return undefined;
  return verify.verdict === "verified" ? 1 : 0;
};

/** A measure, taken on one run: a number, or nothing when the run could not give it. */
type MeasureReader = (run: RunMeasures) => number | undefined;

/** The measures summarised, each with how it is read: shares are 0 or 1 per run. */
export const MEASURES: Readonly<Record<string, MeasureReader>> = {
  working: (run) => (run.isWorking ? 1 : 0),
  claimedButBroken: (run) => (run.outcome === "claimed-but-broken" ? 1 : 0),
  acceptancePassed: (run) =>
    run.acceptance.length === 0 ? undefined : mean(run.acceptance.map((each) => (each.isPassed ? 1 : 0))),
  testsBroken: (run) => brokenCheck(run.checks.test),
  typecheckBroken: (run) => brokenCheck(run.checks.typecheck),
  checkCodeProblems: (run) => (typeof run.checkCode === "string" ? undefined : run.checkCode.problems),
  axeViolations: (run) =>
    run.states.some((state) => state.error !== undefined)
      ? undefined
      : run.states.reduce(
          (sum, state) => sum + Object.values(state.violations).reduce((a, b) => a + b, 0),
          0
        ),
  statesUnreachable: (run) => run.states.filter((state) => state.error !== undefined).length,
  stressBroken: (run) => (typeof run.stress === "string" ? undefined : run.stress.broken),
  verifyVerified: (run) => verified(run.verify),
  productFiles: (run) => run.files.product.length,
  outsideScope: (run) => run.files.outsideScope.length,
  agentMinutes: (run) => run.agentSeconds / 60
};

/** One measure's summary. */
export type MeasureSummary = {
  /** Each arm's mean, and on how many runs it was taken. */
  readonly arms: Readonly<Record<Arm, { readonly mean: number; readonly runs: number }>>;
  /** With minus without, task by task, then averaged over tasks; its interval from a bootstrap over tasks. */
  readonly difference: Estimate;
};

/**
 * Summarises every measure.
 *
 * @param runs - every run's measures.
 * @param random - the generator for the bootstrap.
 * @param draws - how many draws.
 */
export const summariseMeasures = (
  runs: readonly RunMeasures[],
  random: Random,
  draws = 10_000
): Record<string, MeasureSummary> => {
  const tasks = [...new Set(runs.map((run) => run.task))];
  const summary: Record<string, MeasureSummary> = {};
  for (const [name, read] of Object.entries(MEASURES)) {
    const values = (arm: Arm, task?: string): number[] =>
      runs.flatMap((run) => {
        if (run.arm !== arm || (task !== undefined && run.task !== task)) return [];
        const value = read(run);
        return value === undefined || Number.isNaN(value) ? [] : [value];
      });
    const taskDifference = (task: string): number =>
      mean(values("with", task)) - mean(values("without", task));
    const differenceOf = (chosen: readonly string[]): number =>
      mean(chosen.map(taskDifference).filter((value) => !Number.isNaN(value)));
    const drawn: number[] = [];
    for (let draw = 0; draw < draws; draw += 1) {
      const value = differenceOf(resampled(tasks, random));
      if (!Number.isNaN(value)) drawn.push(value);
    }
    summary[name] = {
      arms: {
        with: { mean: mean(values("with")), runs: values("with").length },
        without: { mean: mean(values("without")), runs: values("without").length }
      },
      difference: { value: differenceOf(tasks), low: quantile(drawn, 0.025), high: quantile(drawn, 0.975) }
    };
  }
  return summary;
};
