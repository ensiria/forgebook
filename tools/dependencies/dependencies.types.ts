/**
 * The shapes behind `docs/dependencies.md`: what one published package brings into a project, the advisories `npm audit`
 * finds in it, and the report the page is drawn from.
 *
 * @module
 */

/** An advisory's severity, as `npm audit` names it. */
export type Severity = "info" | "low" | "moderate" | "high" | "critical";

/** One advisory `npm audit` found in a package's tree. */
export type Advisory = {
  /** Its address, GitHub's advisory page: the same advisory found twice is one. */
  readonly url: string;
  /** Its title. */
  readonly title: string;
  /** How serious it is. */
  readonly severity: Severity;
  /** The package it is about. */
  readonly package: string;
  /** The versions of that package it is about. */
  readonly range: string;
  /**
   * Whether the package comes only through a peer dependency: the project's own install (React, Vite…), which npm adds
   * only when the project has none.
   */
  readonly isThroughPeer: boolean;
};

/** One published package, measured. */
export type MeasuredPackage = {
  /** Its name on npm. */
  readonly name: string;
  /** Measured, as opposed to not on npm yet. */
  readonly status: "measured";
  /** The version measured: the one `latest` named. */
  readonly version: string;
  /** How many dependencies its own `package.json` lists. */
  readonly direct: number;
  /**
   * How many packages npm installs with it, itself and its peers left out, every platform's binaries counted: one entry
   * of the lockfile each, so two versions of one package count twice.
   */
  readonly installed: number;
  /** How many of those are optional: one per platform, of which a machine installs only its own. */
  readonly platformOnly: number;
  /** How many packages come only through its peer dependencies, added only when the project has none. */
  readonly peers: number;
  /** What `npm audit` finds in the whole tree, peers included, the most serious first. */
  readonly advisories: readonly Advisory[];
};

/** A package of the repository that npm does not have yet. */
export type UnpublishedPackage = {
  /** Its name. */
  readonly name: string;
  /** Not on npm: there is nothing a project could install. */
  readonly status: "unpublished";
};

/** One published package of the repository, measured or not on npm yet. */
export type PackageResult = MeasuredPackage | UnpublishedPackage;

/** The report the page is drawn from: `docs/dependencies.json`. */
export type DependencyReport = {
  /** The day of the run, `YYYY-MM-DD`; empty before any run. */
  readonly date: string;
  /** The npm that installed and audited, its version. */
  readonly npm: string;
  /** The run's page, when a workflow wrote it. */
  readonly runUrl?: string;
  /** Each package, in the order of their names. */
  readonly packages: readonly PackageResult[];
};
