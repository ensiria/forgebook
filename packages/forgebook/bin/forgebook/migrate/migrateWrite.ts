/**
 * How `forgebook migrate --write` puts its files on disk: each written whole beside its target and renamed over it, so a
 * file is either as it was or as migrated, never half written.
 *
 * @remarks
 * Every new text is written to its temporary file first, and only then are they renamed, one after the other: a disk that
 * is full or a folder that cannot be written stops the run before any file is replaced. A rename can still fail midway
 * (a file locked on Windows), so the error names the files already replaced. A link is followed to the file it points at,
 * which is what gets replaced, and the link stays a link.
 *
 * @module
 */
import { realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";

/** A file to write: where, and its new text. */
export type MigratedWrite = {
  /** The file's path, absolute. */
  readonly path: string;
  /** Its new text. */
  readonly text: string;
};

/** A write that stopped: which files were replaced before it did, by their names in the document. */
export class MigrateWriteError extends Error {
  /** The files replaced before the error, as the document names them. */
  readonly written: readonly string[];

  /**
   * The error.
   *
   * @param message - what failed.
   * @param written - the files replaced before it.
   */
  constructor(message: string, written: readonly string[]) {
    super(message);
    this.name = "MigrateWriteError";
    this.written = written;
  }
}

/**
 * The temporary file beside a target: in its folder, so that the rename stays on one disk and is atomic.
 *
 * @param target - the target's real path.
 */
const temporaryOf = (target: string): string => `${target}.forgebook-migrate-${process.pid}.tmp`;

/**
 * Writes the migrated files, each through a temporary file renamed over it.
 *
 * @param files - the files whose text changed.
 * @param nameOf - a file's name in the document, for the error.
 * @throws a `MigrateWriteError` naming the files already replaced, the temporary files removed.
 */
export const writeMigrated = (files: readonly MigratedWrite[], nameOf: (path: string) => string): void => {
  const staged: { readonly path: string; readonly target: string; readonly temporary: string }[] = [];
  const written: string[] = [];
  try {
    for (const { path, text } of files) {
      const target = realpathSync(path);
      const temporary = temporaryOf(target);
      // listed before it is written, so that a write that fails halfway is removed too
      staged.push({ path, target, temporary });
      writeFileSync(temporary, text, { mode: statSync(target).mode });
    }
    for (const { path, target, temporary } of staged) {
      renameSync(temporary, target);
      written.push(nameOf(path));
    }
  } catch (error) {
    for (const { temporary } of staged) rmSync(temporary, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    const done = written.length === 0 ? "no file was changed" : `already written: ${written.join(", ")}`;
    throw new MigrateWriteError(`Could not write the migrated files (${reason}); ${done}`, written);
  }
};
