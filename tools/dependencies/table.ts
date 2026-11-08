/**
 * The page `docs/dependencies.md`, drawn from the report a run wrote and nothing else, and the list of what changed
 * between two reports, which a pull request names. Pure.
 *
 * @module
 */
import { codeSpan, formatTable } from "@ensiria/cli-kit/markdown";
import type { MarkdownCell } from "@ensiria/cli-kit/markdown.types";

import type { Advisory, DependencyReport, MeasuredPackage, PackageResult } from "./dependencies.types.ts";
import { SEVERITIES } from "./measure.ts";

/** The command that writes the page, named on it so nobody edits it by hand. */
export const TABLE_COMMAND = "node tools/dependencies/dependencies.mts table";

/** The only addresses an advisory links to: the text comes from npm's answer, so anything else is shown, not linked. */
const ADVISORY_PAGE = /^https:\/\/github\.com\/advisories\/GHSA(?:-[0-9a-z]{4}){3}$/;

/**
 * A text from npm's answer as Markdown that shows it and does nothing else: every ASCII punctuation mark escaped, which
 * CommonMark allows for each, so a title cannot make a link, an emphasis or an HTML tag of its own.
 */
const plainText = (text: string): string => text.replaceAll(/[!-/:-@[-`{-~]/g, "\\$&");

/** What `npm audit` found in a package, in a cell: the count of each severity, or none. */
const auditCell = (advisories: readonly Advisory[]): string => {
  if (advisories.length === 0) return "none";
  return SEVERITIES.flatMap((severity) => {
    const count = advisories.filter((advisory) => advisory.severity === severity).length;
    return count === 0 ? [] : [`${count} ${severity}`];
  }).join(", ");
};

/** An advisory as a line of the list under the table. */
const advisoryLine = (name: string, advisory: Advisory): string => {
  const title = plainText(advisory.title);
  const link = ADVISORY_PAGE.test(advisory.url) ? `[${title}](${advisory.url})` : title;
  const where = advisory.isThroughPeer ? ", through a peer dependency" : "";
  return `- ${codeSpan(name).markdown}: ${advisory.severity}, ${link}, in ${codeSpan(`${advisory.package} ${advisory.range}`).markdown}${where}.`;
};

/** The table's columns. */
type Column = "name" | "version" | "direct" | "installed" | "platformOnly" | "peers" | "audit";

/** A package's row. */
const row = (result: PackageResult): Record<Column, MarkdownCell> =>
  result.status === "unpublished"
    ? {
        name: codeSpan(result.name),
        version: "not on npm yet",
        direct: "",
        installed: "",
        platformOnly: "",
        peers: "",
        audit: ""
      }
    : {
        name: codeSpan(result.name),
        version: codeSpan(result.version),
        direct: result.direct,
        installed: result.installed,
        platformOnly: result.platformOnly,
        peers: result.peers,
        audit: auditCell(result.advisories)
      };

/** The table of every package. */
const packageTable = (packages: readonly PackageResult[]): string =>
  formatTable(
    [
      { key: "name", title: "Package" },
      { key: "version", title: "Version" },
      { key: "direct", title: "Direct", align: "right" },
      { key: "installed", title: "Installed", align: "right" },
      { key: "platformOnly", title: "Of which per platform", align: "right" },
      { key: "peers", title: "Through peers", align: "right" },
      { key: "audit", title: "npm audit" }
    ],
    packages.map(row)
  );

/** The measured packages of a report. */
const measured = (report: DependencyReport): MeasuredPackage[] =>
  report.packages.filter((result): result is MeasuredPackage => result.status === "measured");

/**
 * The page.
 *
 * @param report - the report the last run wrote.
 */
export const renderPage = (report: DependencyReport): string => {
  const advisories = measured(report).flatMap((result) =>
    result.advisories.map((advisory) => advisoryLine(result.name, advisory))
  );
  const run =
    report.date === ""
      ? "No run has written results yet."
      : `Results of ${report.date}, with npm ${report.npm}${report.runUrl === undefined ? "" : `, [the run](${report.runUrl})`}. The page changes only when a result does; every run is in the repository's Actions, under \`dependencies\`.`;
  return [
    "# Dependencies",
    "",
    `<!-- Written by \`${TABLE_COMMAND}\` from docs/dependencies.json, itself written by the dependencies workflow: edit tools/dependencies/, not this page. -->`,
    "",
    "What each published package brings into a project, and what `npm audit` says about it. Every week the `dependencies` workflow takes the version of each package npm's `latest` names, installs it alone in an empty project as `npm install <package>` would, writing only the lockfile and running no install script, counts what the lockfile holds and runs `npm audit` on it.",
    "",
    run,
    "",
    ...(report.packages.length === 0 ? [] : [packageTable(report.packages), ""]),
    "- **Direct**: the dependencies the package's own `package.json` lists.",
    "- **Installed**: every package npm adds with it, the package itself and its peers left out. Each platform's binaries count, so a machine installs fewer.",
    "- **Of which per platform**: the optional packages among them, one per operating system and processor, of which a machine installs only its own.",
    "- **Through peers**: what npm adds for its peer dependencies (React, Vite, a framework) when the project has none. A project that draws stories usually has them already.",
    "- **npm audit**: the advisories in the whole tree, peers included. A fresh install resolves the newest versions the ranges allow, so `npm audit` in your own project stays the final word for it.",
    "",
    "## Advisories",
    "",
    ...(report.date === "" ? ["No run has written results yet."] : []),
    ...(report.date !== "" && advisories.length === 0
      ? ["`npm audit` finds none in any package."]
      : advisories),
    ""
  ].join("\n");
};

/** A package's result in one line, as a pull request lists it. */
const summary = (result: PackageResult): string =>
  result.status === "unpublished"
    ? `${result.name}: not on npm yet`
    : `${result.name} ${result.version}: ${result.installed} installed (${result.platformOnly} per platform), ${result.peers} through peers, audit ${auditCell(result.advisories)}`;

/** What can tell two results of one package apart: everything but the order of their advisories. */
const resultKey = (result: PackageResult): string =>
  result.status === "unpublished"
    ? "unpublished"
    : JSON.stringify({
        ...result,
        advisories: result.advisories.map(({ url, package: name }) => `${name} ${url}`)
      });

/**
 * What changed between the report on the base and a new one, one line per package whose result differs: empty when
 * nothing did, so a run that only confirms the page opens no pull request.
 *
 * @param previous - the report on the base branch.
 * @param next - the report this run wrote.
 */
export const changedPackages = (previous: DependencyReport, next: DependencyReport): string[] => {
  const before = new Map(previous.packages.map((result) => [result.name, resultKey(result)]));
  const now = new Set(next.packages.map((result) => result.name));
  return [
    ...next.packages.filter((result) => before.get(result.name) !== resultKey(result)).map(summary),
    ...previous.packages
      .filter((result) => !now.has(result.name))
      .map((result) => `${result.name}: no longer measured`)
  ];
};
