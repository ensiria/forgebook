/**
 * The shapes of the compatibility matrix: the tools each package is tested against, the cells one run plans, and what
 * each cell found, as `docs/compatibility.json` keeps it.
 *
 * @module
 */

/** A `package.json` field that holds a range: where a package says which versions of a tool it accepts. */
export type RangeField = "peerDependencies" | "dependencies";

/**
 * Where the range of versions a package claims for a tool comes from: a field of a package's manifest (its own when
 * `folder` is left out), or a range written here, for a tool the package does not depend on by name.
 */
export type RangeSource =
  | { readonly field: RangeField; readonly folder?: string }
  | { readonly range: string; readonly why: string };

/**
 * Which prerelease of a tool is tested beside its released lines: `newest`, the newest version a dist-tag points at
 * when it is ahead of `latest`; a named dist-tag, for a tool whose prereleases carry a lower number than `latest`
 * (React's canaries); or `none`.
 */
export type PrereleasePolicy = "newest" | "none" | { readonly tag: string };

/** A tool packages are tested against: its name on the page and the npm packages one version of it is made of. */
export type HostDefinition = {
  /** The name a reader knows it by. */
  readonly label: string;
  /**
   * Its npm packages, released together: the first one's lines and dist-tags choose the version, and each other one
   * installs that version too, or its newest release of the same minor when it ships patches of its own.
   */
  readonly packages: readonly string[];
  /** Where the claimed range comes from when the package's entry does not say: the package's peer dependency. */
  readonly range?: RangeSource;
  /** Which prerelease is tested; `newest` when left out. */
  readonly prerelease?: PrereleasePolicy;
  /**
   * Packages a line of the tool needs at another version than the workspace's, by line: each package and the line of
   * it to install (`"5.9"`, its newest 5.9 release). For a line whose own peer range excludes what the fixtures pin.
   */
  readonly companions?: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

/** One tool one package is tested against. */
export type AdapterHost = {
  /** The key of the tool in the matrix's `hosts`. */
  readonly host: string;
  /** Where the claimed range comes from, over the tool's own default. */
  readonly range?: RangeSource;
  /**
   * A fixture catalogue for a line of the tool, by line, over the package's own: for a line the package's fixture is
   * not written for and the tool itself refuses (a SvelteKit 3 app run on SvelteKit 2).
   */
  readonly fixtures?: Readonly<Record<string, string>>;
};

/** A published package and the fixture catalogue that exercises it. */
export type AdapterDefinition = {
  /** The package's npm name. */
  readonly name: string;
  /** Its folder in the repository. */
  readonly folder: string;
  /** The fixture catalogue whose tests and build run with it. */
  readonly fixture: string;
  /** The tools it is tested against. */
  readonly hosts: readonly AdapterHost[];
  /** A sentence the page prints under the package's table, for what the table alone would leave wrong. */
  readonly note?: string;
};

/** The whole matrix: the tools, and the packages tested against them. */
export type CompatMatrix = {
  /** The tools, by the key the packages name them with. */
  readonly hosts: Readonly<Record<string, HostDefinition>>;
  /** The packages, in the order the page lists them. */
  readonly adapters: readonly AdapterDefinition[];
};

/** The part of a `package.json` the matrix reads. */
export type Manifest = {
  /** The package's name. */
  readonly name: string;
  /** Its scripts, by name: which of `test` and `build` a cell can run. */
  readonly scripts: Readonly<Record<string, string>>;
  /** The ranges it accepts from the project it is installed in. */
  readonly peerDependencies: Readonly<Record<string, string>>;
  /** The ranges it installs itself. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** The versions it develops with: what a fixture pins of the tools it runs on. */
  readonly devDependencies: Readonly<Record<string, string>>;
};

/** What the npm registry says of a package: every version it published and its dist-tags. */
export type RegistryPackage = {
  /** Every version it published, prereleases included. */
  readonly versions: readonly string[];
  /** Its dist-tags (`latest`, `next`, `canary`…), each the version it points at. */
  readonly distTags: Readonly<Record<string, string>>;
};

/** One cell of a run: a package, a tool, and the one version of the tool it is tested with. */
export type PlannedCell = {
  /** A name safe for an artefact: package, tool and line. */
  readonly id: string;
  /** The package's npm name. */
  readonly adapter: string;
  /** The tool's key in the matrix. */
  readonly host: string;
  /** The range the package claims for the tool. */
  readonly range: string;
  /** The line the version stands for: a major (`19`, `0.21`), or `next` for a prerelease. */
  readonly line: string;
  /** The tool's version: its first package's. */
  readonly version: string;
  /** The exact version of each of the tool's npm packages, as the cell pins them. */
  readonly packages: Readonly<Record<string, string>>;
  /** The dist-tag a prerelease came from. */
  readonly tag?: string;
};

/** What a cell found: `passed`, every command ended with 0; `failed`, one did not; `not-run`, it could not start. */
export type CellStatus = "passed" | "failed" | "not-run";

/** One command a cell ran, and how it ended. */
export type CellCommand = {
  /** The command, as a person would type it. */
  readonly command: string;
  /** Its exit code; `null` when it was stopped. */
  readonly code: number | null;
};

/** A cell and what it found. */
export type CellResult = PlannedCell & {
  /** How it ended. */
  readonly status: CellStatus;
  /** Why a cell did not run, or which command failed. */
  readonly reason?: string;
  /** The versions the install really put in place, by package: the proof the cell tested what it says. */
  readonly installed: Readonly<Record<string, string>>;
  /** The commands, in order. */
  readonly commands: readonly CellCommand[];
  /** The Node version it ran on. */
  readonly node: string;
};

/** What `docs/compatibility.json` holds: the cells of the run the table was last written from. */
export type CompatReport = {
  /** The day the run that wrote it ended, `YYYY-MM-DD`; empty before any run. */
  readonly date: string;
  /** The run's page, when it ran in GitHub Actions. */
  readonly runUrl?: string;
  /** Every cell of the run, by id. */
  readonly cells: readonly CellResult[];
};
