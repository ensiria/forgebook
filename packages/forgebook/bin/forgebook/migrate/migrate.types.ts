/**
 * The shapes of `forgebook migrate`: a codemod, what it does to one file, and the document the command answers.
 *
 * @module
 */

/** A file a codemod may read: the catalogue's configuration, or another module given by path (a library's preset). */
export type MigratedFileKind = "config" | "module";

/** One change to a file's text: the characters from `start` to `end` replaced by `insert`. */
export type TextEdit = {
  /** Where the replaced text starts, as an offset in the file's text. */
  readonly start: number;
  /** Where it ends, exclusive. */
  readonly end: number;
  /** What takes its place; empty to delete. */
  readonly insert: string;
};

/** What a codemod makes of one file. */
export type CodemodResult = {
  /** The edits, none overlapping; none when the file holds nothing to rewrite. */
  readonly edits: readonly TextEdit[];
  /** What it could not rewrite and a person has to, each a sentence; none when it could do everything. */
  readonly manual: readonly string[];
};

/**
 * Whether a codemod rewrites what no longer works (`rewrite`: a key or a string gone), so it is safe to run on any
 * project, or writes what keeps an old behaviour a project may not want (`keep`), so it runs only when `--from` says the
 * project is coming from before the change.
 */
export type CodemodKind = "rewrite" | "keep";

/** A breaking change's mechanical rewrite. */
export type Codemod = {
  /** Its stable id, as `--only` takes it. */
  readonly id: string;
  /** The first version of `forgebook` with the breaking change. */
  readonly breaksIn: string;
  /** Whether it rewrites what no longer works or keeps an old behaviour. */
  readonly kind: CodemodKind;
  /** The kinds of file it reads. */
  readonly files: readonly MigratedFileKind[];
  /** What it changes and why, in a sentence or two. */
  readonly summary: string;
  /**
   * Its edits to one file. Pure and idempotent: a file it has rewritten gives no edit the second time.
   *
   * @param text - the file's text.
   * @param path - the file's path, for its extension (TypeScript, JSX or plain JavaScript).
   */
  readonly run: (text: string, path: string) => CodemodResult;
};

/** A breaking change with no mechanical rewrite: what to do by hand. */
export type MigrationNote = {
  /** Its stable id. */
  readonly id: string;
  /** The first version of `forgebook` with the change. */
  readonly breaksIn: string;
  /** What changed and what to do, in a sentence or two. */
  readonly text: string;
};

/** One change `forgebook migrate` makes, or would make, to a file. */
export type MigrateChange = {
  /** The file, from the folder the command ran in. */
  readonly file: string;
  /** The codemod's id. */
  readonly codemod: string;
  /** The text removed, trimmed; empty for an addition. */
  readonly removed: string;
  /** The text added, trimmed; empty for a removal. */
  readonly added: string;
};

/** What a codemod left to a person. */
export type MigrateManual = {
  /** The file, from the folder the command ran in. */
  readonly file: string;
  /** The codemod's id. */
  readonly codemod: string;
  /** What to do. */
  readonly text: string;
};

/** A codemod that did not run, and why. */
export type MigrateSkipped = {
  /** The codemod's id. */
  readonly codemod: string;
  /** Why it did not run. */
  readonly reason: string;
};

/** What `forgebook migrate --json` answers. */
export type MigrateDocument = {
  /** The document's shape, raised when a field changes meaning. */
  readonly schema: 1;
  /** The version given with `--from`; none when every rewrite ran. */
  readonly from?: string;
  /** Whether the changes were written (`--write`), or only listed. */
  readonly isWritten: boolean;
  /** The files read, from the folder the command ran in. */
  readonly files: readonly string[];
  /** The changes, made or to make. */
  readonly changes: readonly MigrateChange[];
  /** What the codemods could not do. */
  readonly manual: readonly MigrateManual[];
  /** The codemods that did not run. */
  readonly skipped: readonly MigrateSkipped[];
  /** The breaking changes with no codemod, for the versions migrated across: to read and act on by hand. */
  readonly notes: readonly MigrationNote[];
  /** One sentence. */
  readonly summary: string;
};
