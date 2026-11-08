/**
 * What `forgebook init` answers: the document `--json` prints when it wrote a catalogue's files, the one it prints when
 * it refused, and the named steps left to the person or the agent.
 *
 * @module
 */

import type { AgentSteps } from "../agentSetup/initAgentSteps.ts";
import type { AppBuildPlan } from "../appBuild/appBuild.ts";
import type { ImportedFramework } from "../importers/storybookFrameworks.ts";

/** The way a catalogue's files were made: from the project's dependencies, or from its Storybook. */
export type InitRoute = "new-project" | "storybook";

/** The package managers `forgebook init` writes commands for. */
export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

/** What kind of thing a next step is about, so an agent can tell them apart without reading the sentence. */
export type NextStepKind =
  | "style-sheet"
  | "provider"
  | "portal"
  | "head"
  | "font"
  | "postcss"
  | "setup"
  | "version"
  | "storybook";

/** Something `forgebook init` could not do alone, named so it is not found later as a story that looks wrong. */
export type NextStep = {
  /** What it is about. */
  readonly kind: NextStepKind;
  /** The project's file it was read from; none when it comes from no one file. */
  readonly file: string | undefined;
  /** What to do, one sentence. */
  readonly message: string;
};

/** The state of the packages the written configuration needs. */
export type InitInstall = {
  /** The packages the project declares nowhere and cannot load. */
  readonly missing: readonly string[];
  /** The command that gets them; none when everything is there. */
  readonly command: string | undefined;
  /** Whether nothing is needed, the command is left to run, `--install` ran it, or it failed. */
  readonly status: "not-needed" | "to-run" | "ran" | "failed";
  /** Why it failed; none unless it did. */
  readonly error: string | undefined;
};

/** A command to run next, with what it is for. */
export type InitCommand = {
  /** The command, as the project's package manager runs it. */
  readonly command: string;
  /** What it does. */
  readonly description: string;
  /** The placeholder in the command to fill before running it (`<component file>`); none when it runs as it is. */
  readonly placeholder: string | undefined;
};

/**
 * What `forgebook init --json` prints when it wrote the files. The exit code is 0, or 1 with `install.status` `"failed"`,
 * `browser.status` `"failed"` or a `draw.status` other than `"drawn"`: the files are written either way.
 */
export type InitDocument = {
  /** The document's version. */
  readonly schema: 1;
  /** How the files were made. */
  readonly route: InitRoute;
  /** The framework the stories are written for. */
  readonly framework: ImportedFramework;
  /** The package manager the commands are for. */
  readonly packageManager: {
    /** Its name. */
    readonly name: PackageManagerName;
    /** The file that says so; none when no file does and npm was assumed. */
    readonly detectedFrom: string | undefined;
  };
  /** The files written, from the project's folder. */
  readonly written: readonly string[];
  /** Those of them that replaced a file, with `--force`. */
  readonly replaced: readonly string[];
  /** The story globs written; none when a catalogue already there was kept (`--agents`). */
  readonly stories: readonly string[];
  /** What the configuration needs installed. */
  readonly install: InitInstall;
  /** What the catalogue will read of the app's build when it starts; `init` itself runs none of it. */
  readonly appBuild: AppBuildPlan;
  /** What was left to do, each named. */
  readonly nextSteps: readonly NextStep[];
  /** The commands to run next, in order. */
  readonly commands: readonly InitCommand[];
} & AgentSteps;

/** Why `forgebook init` wrote nothing. */
export type InitRefusalCode =
  | "no-package"
  | "unreadable-package"
  | "unknown-framework"
  | "ambiguous-framework"
  | "existing-files"
  | "symlink"
  | "versions"
  | "storybook-found"
  | "storybook"
  | "failed";

/**
 * What `forgebook init --json` prints when it stopped, with exit code 1: nothing was written, unless `refused` is
 * `"failed"`, an error while reading or writing. A wrong command line is exit code 2, with no document.
 */
export type InitRefusal = {
  /** The document's version. */
  readonly schema: 1;
  /** Why. */
  readonly refused: InitRefusalCode;
  /** The reason, one sentence. */
  readonly message: string;
  /** What to do about it; none when there is nothing to add. */
  readonly hint: string | undefined;
  /** The frameworks `--framework` takes; none when the framework is not the reason. */
  readonly supported: readonly ImportedFramework[] | undefined;
  /** The files or packages concerned; none when no one of them is. */
  readonly concerned: readonly string[] | undefined;
};
