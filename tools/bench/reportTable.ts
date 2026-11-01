/**
 * The report as a person reads it, and the medians two reports are compared on.
 *
 * @module
 */
import { formatBytes } from "@ensiria/cli-kit/format";

import type { BenchReport, MetricResult, ToolName } from "./bench.types.ts";

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
 * The report's rows: a metric, then a cell per tool.
 *
 * @param report - the report.
 */
export const reportRows = (
  report: BenchReport
): { readonly tools: ToolName[]; readonly rows: string[][] } => {
  const tools = Object.keys(report.tools).filter((name): name is ToolName => name in report.tools);
  const metrics = [...new Set(tools.flatMap((tool) => Object.keys(report.tools[tool]?.metrics ?? {})))];
  return {
    tools,
    rows: metrics.map((metric) => [metric, ...tools.map((tool) => cell(report.tools[tool]?.metrics[metric]))])
  };
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
