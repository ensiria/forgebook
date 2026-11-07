/**
 * The page `docs/compatibility.md`, drawn from the report a run wrote and nothing else: a version appears only when a
 * cell ran it, and a tool the matrix names but no run reached reads "not tested yet". Pure.
 *
 * @module
 */
import { codeSpan, formatTable, markdownText } from "@ensiria/cli-kit/markdown";

import type { CellResult, CompatMatrix, CompatReport, PlannedCell } from "./compat.types.ts";
import { hostOf } from "./plan.ts";

/** The command that writes the page, named on it so nobody edits it by hand. */
export const TABLE_COMMAND = "node tools/compat/compat.mts table";

/** A cell's result in words a reader scans. */
const resultText = (cell: CellResult): string => {
  if (cell.status === "passed") return "✓ passes";
  if (cell.status === "failed") return `✗ fails (${cell.reason ?? "a command failed"})`;
  return `– not run (${cell.reason ?? "unknown"})`;
};

/** The order of a package's cells: as the matrix lists its tools, released lines before the prerelease. */
const cellOrder =
  (hosts: readonly string[]) =>
  (a: CellResult, b: CellResult): number =>
    hosts.indexOf(a.host) - hosts.indexOf(b.host) || Number(a.line === "next") - Number(b.line === "next");

/** One package's section: its table, its tools no run reached, and its note. */
const adapterSection = (matrix: CompatMatrix, report: CompatReport, name: string): string => {
  const adapter = matrix.adapters.find((entry) => entry.name === name);
  if (adapter === undefined) throw new Error(`the matrix has no package ${name}`);
  const hosts = adapter.hosts.map((entry) => entry.host);
  const cells = report.cells.filter((cell) => cell.adapter === name && hosts.includes(cell.host));
  const rows = [...cells].sort(cellOrder(hosts)).map((cell) => ({
    tool: hostOf(matrix, cell.host).label,
    range: codeSpan(cell.range),
    line: cell.line === "next" ? `next (${cell.tag ?? "prerelease"})` : cell.line,
    version: codeSpan(cell.version),
    result: resultText(cell)
  }));
  const untested = hosts.filter((host) => !cells.some((cell) => cell.host === host));
  const parts = [`## ${name}`];
  if (rows.length > 0) {
    parts.push(
      formatTable(
        [
          { key: "tool", title: "Tool" },
          { key: "range", title: "Range it claims" },
          { key: "line", title: "Line" },
          { key: "version", title: "Version tested" },
          { key: "result", title: "Result" }
        ],
        rows
      )
    );
  }
  const commands = [...new Set(cells.flatMap((cell) => cell.commands.map((command) => command.command)))];
  if (commands.length > 0)
    parts.push(`Each cell runs ${commands.map((command) => codeSpan(command).markdown).join(", ")}.`);
  if (untested.length > 0) {
    const labels = untested.map((host) => hostOf(matrix, host).label).join(", ");
    parts.push(`Not tested yet: ${labels}.`);
  }
  if (adapter.note !== undefined) parts.push(adapter.note);
  return parts.join("\n\n");
};

/** When and where the results come from, or that no run has written them yet. */
const provenance = (report: CompatReport): string => {
  if (report.cells.length === 0) return "No run has written results yet: nothing below is claimed as tested.";
  const nodes = [...new Set(report.cells.map((cell) => cell.node).filter((node) => node !== ""))].join(", ");
  const run = report.runUrl === undefined ? "" : `, ${markdownText(`[the run](${report.runUrl})`).markdown}`;
  return `Results of ${report.date}, on Node ${nodes}${run}.`;
};

/** The whole page. */
export const renderTable = (matrix: CompatMatrix, report: CompatReport): string =>
  [
    "# Compatibility",
    `<!-- Written by \`${TABLE_COMMAND}\` from docs/compatibility.json, itself written by the compat workflow: edit tools/compat/, not this page. -->`,
    "Which versions of the tools around it each package is tested with. Every week, and when a maintainer asks, the " +
      "`compat` workflow takes each line the package claims (the newest release of each major its range allows) " +
      "and the tool's next prerelease (the newest dist-tag ahead of its latest release, or for React its canary), " +
      "installs that version alone over the lockfile, and runs the package's tests (its conformance suite among " +
      "them) and its fixture catalogue's tests and static build, where each exists: every section lists the " +
      "commands its cells ran.",
    "A version this page does not list is not tested. One marked ✗ is known to break; a prerelease that breaks " +
      "is a warning of work to do, not a supported setup.",
    `${provenance(report)} The page changes only when a result does; every run is in the repository's Actions, ` +
      `under ${codeSpan("compat").markdown}.`,
    ...matrix.adapters.map((adapter) => adapterSection(matrix, report, adapter.name)),
    ""
  ].join("\n\n");

/** Why a planned cell has no result: its job ended before writing one. */
export const NO_RESULT = "the cell left no result: it timed out or crashed";

/**
 * A run's results with every planned cell that left none counted as not run, so a cell that hung reads as such
 * instead of vanishing from the table.
 */
export const withMissingCells = (
  planned: readonly PlannedCell[],
  results: readonly CellResult[]
): CellResult[] => [
  ...results,
  ...planned
    .filter((cell) => !results.some((result) => result.id === cell.id))
    .map(
      (cell): CellResult => ({
        ...cell,
        status: "not-run",
        reason: NO_RESULT,
        installed: {},
        commands: [],
        node: ""
      })
    )
];

/** A cell's key across runs: package, tool and line. */
const cellKey = (cell: CellResult): string => `${cell.adapter} ${cell.host} ${cell.line}`;

/**
 * What changed between two reports, as lines for a pull request: a cell new, gone, or with another version or result.
 * Empty when the table would say the same.
 */
export const changedCells = (previous: CompatReport, next: CompatReport): string[] => {
  const before = new Map(previous.cells.map((cell) => [cellKey(cell), cell]));
  const after = new Map(next.cells.map((cell) => [cellKey(cell), cell]));
  const lines: string[] = [];
  for (const [key, cell] of after) {
    const old = before.get(key);
    if (old === undefined) lines.push(`${key}: ${cell.version} ${cell.status} (new)`);
    else if (old.version !== cell.version || old.status !== cell.status || old.reason !== cell.reason)
      lines.push(`${key}: ${old.version} ${old.status} → ${cell.version} ${cell.status}`);
  }
  for (const key of before.keys()) if (!after.has(key)) lines.push(`${key}: no longer tested`);
  return lines;
};
