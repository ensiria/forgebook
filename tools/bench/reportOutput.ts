/**
 * What the `bench` command writes when a run ends: the report with its problems, to its file and to stdout.
 *
 * @remarks
 * A run that found problems still measured everything else, and a reader of `--json` needs those numbers as much as
 * the list of what went wrong. So the report is written whole whatever went wrong; only the exit code says there were
 * problems.
 *
 * @module
 */
import { formatJson } from "@ensiria/cli-kit/files";

import type { BenchReport } from "./bench.types.ts";
import { reportMarkdown } from "./reportTable.ts";

/** How the report is printed on stdout: its JSON, a Markdown table, or a table for a terminal. */
export type ReportFormat = "json" | "markdown" | "table";

/**
 * How stdout carries the report: `--json` wins, since a program reads it, then `--markdown`.
 *
 * @param isJson - whether `--json` was given.
 * @param isMarkdown - whether `--markdown` was given.
 */
export const reportFormat = (isJson: boolean, isMarkdown: boolean): ReportFormat => {
  if (isJson) return "json";
  return isMarkdown ? "markdown" : "table";
};

/**
 * The report as written: the run's results with the problems the checks found.
 *
 * @param report - what `runBench` returned.
 * @param problems - what went wrong, one line each; empty for a clean run.
 */
export const finishedReport = (report: BenchReport, problems: readonly string[]): BenchReport => ({
  ...report,
  problems
});

/**
 * The text stdout carries: the report itself with `--json`, otherwise a table, problems or not.
 *
 * @param report - the finished report.
 * @param format - how to print it.
 * @param table - the terminal table, made by the caller, which knows the output style.
 */
export const reportOutput = (
  report: BenchReport,
  format: ReportFormat,
  table: (report: BenchReport) => string
): string => {
  if (format === "json") return formatJson(report);
  if (format === "markdown") return `${reportMarkdown(report)}\n`;
  return `${table(report)}\n`;
};
