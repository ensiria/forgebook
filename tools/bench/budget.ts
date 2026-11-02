/**
 * What a pull request may not exceed: the weight of Forgebook, read from a report against a budget file.
 *
 * @remarks
 * Pure. A budget is a limit per metric, kept in the repository so that raising one is a line in a pull request, seen and
 * argued like any other. Metrics are the report's, for Forgebook only: a budget about another tool would fail a pull
 * request for something it did not do. A metric the budget names and the run did not measure is a failure: a check that
 * passes by losing its number protects nothing.
 *
 * @module
 */
import type { BenchReport } from "./bench.types.ts";

/** A budget: the highest median each metric may have, in the metric's unit. */
export type Budget = {
  /** The corpus the limits were set on. */
  readonly corpus: { readonly components: number; readonly stories: number };
  /** The limits, by metric. */
  readonly limits: Readonly<Record<string, number>>;
};

/** A metric over its limit, or missing. */
export type BudgetProblem = {
  /** The metric. */
  readonly metric: string;
  /** Its limit. */
  readonly limit: number;
  /** What the run measured; none when it did not measure it. */
  readonly value: number | undefined;
};

/** Whether a parsed value is a budget. */
const isBudget = (value: unknown): value is Budget =>
  typeof value === "object" && value !== null && "limits" in value && "corpus" in value;

/**
 * Reads a budget file.
 *
 * @param text - the file's text.
 * @throws when it is not a budget.
 */
export const parseBudget = (text: string): Budget => {
  const value: unknown = JSON.parse(text);
  if (!isBudget(value)) throw new Error("not a budget file");
  return value;
};

/**
 * The metrics a run broke.
 *
 * @param report - the run's report.
 * @param budget - the budget.
 * @throws when the run was on another corpus, since a limit means nothing there.
 */
export const budgetProblems = (report: BenchReport, budget: Budget): BudgetProblem[] => {
  if (JSON.stringify(report.corpus) !== JSON.stringify(budget.corpus)) {
    throw new Error(
      `the budget is for ${JSON.stringify(budget.corpus)}, this run on ${JSON.stringify(report.corpus)}`
    );
  }
  const metrics = report.tools.forgebook?.metrics ?? {};
  return Object.entries(budget.limits).flatMap(([metric, limit]): BudgetProblem[] => {
    const result = metrics[metric];
    if (result?.kind !== "measured") return [{ metric, limit, value: undefined }];
    return result.summary.median > limit ? [{ metric, limit, value: result.summary.median }] : [];
  });
};

/**
 * A problem as a person reads it.
 *
 * @param problem - the problem.
 */
export const budgetLine = ({ metric, limit, value }: BudgetProblem): string =>
  value === undefined
    ? `${metric}: not measured (limit ${limit})`
    : `${metric}: ${value} over the limit of ${limit}`;

/**
 * Everything a run broke of a budget, if there is one, as a person reads it.
 *
 * @param report - the run's report.
 * @param budget - the budget, if any.
 */
export const budgetLines = (report: BenchReport, budget: Budget | undefined): string[] =>
  budget === undefined ? [] : budgetProblems(report, budget).map(budgetLine);
