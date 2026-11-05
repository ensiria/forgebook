/**
 * The report as a person reads it, and the medians two reports are compared on.
 *
 * @module
 */
import { formatBytes } from "@ensiria/cli-kit/format";

import type { BenchReport, MetricResult, ToolName } from "./bench.types.ts";
import { comparedMedians } from "./benchStats.ts";

/** A metric's cell. */
const cell = (result: MetricResult | undefined): string => {
  if (result === undefined) return "–";
  if (result.kind === "absent") return "n/a";
  if (result.kind === "failed") return "failed";
  const { median, min, max, p95, samples } = result.summary;
  if (result.unit === "bytes") return formatBytes(median);
  if (result.unit === "count") return String(median);
  const spread = samples > 1 ? ` (${Math.round(min)}–${Math.round(max)})` : "";
  return `${Math.round(median)} ms${spread}${p95 === undefined ? "" : ` p95 ${Math.round(p95)}`}`;
};

/**
 * A tool's column heading: its name, and for Forgebook at parity with Ladle, that it ran so, since its column then
 * stands beside one of its defaults.
 *
 * @param report - the report.
 * @param tool - the tool.
 */
const toolHeading = (report: BenchReport, tool: ToolName): string =>
  tool === "forgebook" && report.features === "parity" ? "forgebook at parity" : tool;

/**
 * The report's rows: a metric, then a cell per tool; with each tool's column heading.
 *
 * @param report - the report.
 */
export const reportRows = (
  report: BenchReport
): { readonly tools: ToolName[]; readonly headings: string[]; readonly rows: string[][] } => {
  const tools = Object.keys(report.tools).filter((name): name is ToolName => name in report.tools);
  const metrics = [...new Set(tools.flatMap((tool) => Object.keys(report.tools[tool]?.metrics ?? {})))];
  return {
    tools,
    headings: tools.map((tool) => toolHeading(report, tool)),
    rows: metrics.map((metric) => [metric, ...tools.map((tool) => cell(report.tools[tool]?.metrics[metric]))])
  };
};

/**
 * The report as a Markdown table, for a file or a job summary: nothing cut, whatever the width.
 *
 * @param report - the report.
 */
export const reportMarkdown = (report: BenchReport): string => {
  const { headings, rows } = reportRows(report);
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  return [line(["metric", ...headings]), line(["---", ...headings.map(() => "---")]), ...rows.map(line)].join(
    "\n"
  );
};

/** Whether a parsed value is a report of the shape this benchmark writes. */
const isReport = (value: unknown): value is BenchReport =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === 1 &&
  "tools" in value;

/**
 * Reads a report written by an earlier run.
 *
 * @param text - the file's text.
 * @throws when it is not a report of this version.
 */
export const parseReport = (text: string): BenchReport => {
  const value: unknown = JSON.parse(text);
  if (!isReport(value)) throw new Error("not a benchmark report of this version");
  return value;
};

/**
 * What makes two reports not comparable, empty when they are.
 *
 * @param first - the earlier report.
 * @param second - the later one.
 */
export const reportMismatches = (first: BenchReport, second: BenchReport): string[] => {
  const differs = (name: string, a: unknown, b: unknown): string[] =>
    JSON.stringify(a) === JSON.stringify(b) ? [] : [`${name} differs`];
  return [
    ...differs("corpus", first.corpus, second.corpus),
    ...differs("throttle", first.throttle, second.throttle),
    ...differs("frames", first.frames, second.frames),
    // a report from before the choice ran the defaults
    ...differs("features", first.features ?? "default", second.features ?? "default"),
    ...differs("machine", first.machine, second.machine),
    ...differs("forgebook", first.forgebook, second.forgebook),
    ...differs("startedAt", first.startedAt === second.startedAt ? "same run" : "", "")
  ];
};

/**
 * Every timing's median, as `tool metric` → milliseconds; sizes are left out, since they are exact.
 *
 * @param report - the report.
 */
export const timeMedians = (report: BenchReport): Record<string, number> => {
  const medians: Record<string, number> = {};
  for (const [tool, result] of Object.entries(report.tools)) {
    for (const [metric, value] of Object.entries(result.metrics)) {
      if (value.kind === "measured" && value.unit === "ms")
        medians[`${tool} ${metric}`] = value.summary.median;
    }
  }
  return medians;
};

/**
 * Everything wrong with a finished run: metrics that failed, a comparison that cannot be made, medians that moved.
 *
 * @param report - the run's report.
 * @param earlier - the report it is compared with, if any.
 * @param tolerance - the change allowed in a median, as a share.
 * @returns one line per problem, empty for a clean run.
 */
export const reportProblems = (
  report: BenchReport,
  earlier: BenchReport | undefined,
  tolerance: number
): string[] => {
  const failures = Object.entries(report.tools).flatMap(([tool, result]) =>
    Object.entries(result.metrics).flatMap(([metric, value]) =>
      value.kind === "failed" ? [`${tool} ${metric} failed: ${value.reason}`] : []
    )
  );
  if (earlier === undefined) return failures;
  const mismatches = reportMismatches(earlier, report);
  if (mismatches.length > 0) return [...failures, ...mismatches.map((each) => `not comparable: ${each}`)];
  const moved = comparedMedians(timeMedians(earlier), timeMedians(report), tolerance);
  return [...failures, ...moved.map((each) => `${each.metric}: ${each.first} → ${each.second} ms`)];
};
