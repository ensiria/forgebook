/**
 * How `forgebook init` refuses: its document on stdout under `--json`, the error otherwise, and what it refuses for, each
 * before the first write.
 *
 * @module
 */
import { lstatSync } from "node:fs";
import { join } from "node:path";

import { formatJson } from "@ensiria/cli-kit/files";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { projectManifest } from "./importers/storybook.ts";
import type { InitRefusal } from "./newProject/newProject.types.ts";
import { printable } from "./newProject/projectEntries.ts";
import type { PackageState } from "./newProject/projectPackages.ts";

/** Where the command prints. */
export type InitContext = {
  /** The run's streams. */
  readonly io: ScriptIo;
  /** The run's logger. */
  readonly log: Logger;
  /** Whether stdout carries JSON. */
  readonly isJson: boolean;
};

/** A refusal's document without what is always the same. */
type Refusal = Pick<InitRefusal, "refused" | "message"> & Partial<InitRefusal>;

/**
 * Stops the command: its document on stdout under `--json`, the error otherwise. Never returns.
 *
 * @param refusal - why.
 * @param context - where it prints.
 */
export const refuse = (refusal: Refusal, context: InitContext): never => {
  const message = printable(refusal.message);
  const document: InitRefusal = {
    schema: 1,
    hint: undefined,
    supported: undefined,
    concerned: undefined,
    ...refusal,
    message
  };
  if (context.isJson) context.io.stdout.write(formatJson(document));
  throw new ScriptError(message, { hint: refusal.hint, isReported: context.isJson });
};

/** Whether a path holds anything, a dangling link included. */
export const isThere = (path: string): boolean => lstatSync(path, { throwIfNoEntry: false }) !== undefined;

/**
 * Refuses a file the catalogue reads that is there already, unless asked to replace it, and a link at any time.
 *
 * @param projectDir - the project's folder.
 * @param name - the file found; none when there is none.
 * @param isForced - `--force`.
 * @param context - where a refusal prints.
 */
export const refuseExisting = (
  projectDir: string,
  name: string | undefined,
  isForced: boolean,
  context: InitContext
): void => {
  if (name === undefined) return;
  if (lstatSync(join(projectDir, name)).isSymbolicLink())
    refuse(
      {
        refused: "symlink",
        message: `${name} is a link: writing through it would change a file elsewhere`,
        hint: "Remove the link, then run forgebook init again",
        concerned: [name]
      },
      context
    );
  if (isForced) return;
  refuse(
    {
      refused: "existing-files",
      message: `${name} is already there`,
      hint: "Give --force to replace it",
      concerned: [name]
    },
    context
  );
};

/**
 * Stops on a `package.json` that cannot be parsed: everything after this reads it.
 *
 * @param projectDir - the project's folder.
 * @param context - where a refusal prints.
 */
export const refuseBrokenManifest = (projectDir: string, context: InitContext): void => {
  try {
    projectManifest(projectDir);
  } catch (error) {
    refuse(
      {
        refused: "unreadable-package",
        message: `package.json cannot be read: ${error instanceof Error ? error.message : String(error)}`
      },
      context
    );
  }
};

/** The sentence and the document's entry for packages too old, on the route that goes on regardless. */
export const tooOldText = ({ tooOld }: PackageState): string =>
  tooOld.map(({ name, found, floor }) => `${name} ${found} is below ${floor}`).join(", ");

/** Refuses what the project has too old for a new catalogue to draw. */
export const refuseTooOld = (state: PackageState, context: InitContext): void => {
  if (state.tooOld.length === 0) return;
  refuse(
    {
      refused: "versions",
      message: `Forgebook cannot draw this project yet: ${tooOldText(state)}`,
      hint: "Upgrade them, then run forgebook init again. Nothing was written",
      concerned: state.tooOld.map(({ name }) => name)
    },
    context
  );
};
