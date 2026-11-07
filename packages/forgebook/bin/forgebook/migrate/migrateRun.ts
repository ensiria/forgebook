/**
 * What `forgebook migrate` does: picks the codemods for the versions a project crosses, runs them on its configuration and
 * the preset modules given, and writes the result only when asked.
 *
 * @remarks
 * Nothing of the project runs: each file is read as text and rewritten as text. The command imports this module when it
 * runs, so the compiler it needs loads for no other command.
 *
 * @module
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { CODEMODS, MIGRATION_NOTES } from "./codemods.ts";
import type {
  Codemod,
  MigrateChange,
  MigrateDocument,
  MigratedFileKind,
  MigrateManual,
  MigrateSkipped
} from "./migrate.types.ts";
import { appliedEdits } from "./objectEdits.ts";

/** What the command was asked. */
export type MigrateRequest = {
  /** The folder the command runs in, which the files are named from. */
  readonly cwd: string;
  /** The configuration file, absolute; none when there is none and only modules are given. */
  readonly config?: string | undefined;
  /** Other modules holding a preset or a configuration, absolute. */
  readonly modules: readonly string[];
  /** The version the project upgrades from (`0.3.3`); none to run every rewrite. */
  readonly from?: string | undefined;
  /** The codemods to run, by id; none for all that apply. */
  readonly only?: readonly string[] | undefined;
  /** Whether to write the files, or only list the changes. */
  readonly isWrite: boolean;
};

/** A file to migrate, and what kind it is. */
type MigratedFile = { readonly path: string; readonly kind: MigratedFileKind };

/**
 * A version's numbers; none when it is not `major.minor.patch` (a `v` before it and a prerelease after it allowed).
 *
 * @param version - the version.
 */
const versionNumbers = (version: string): readonly [number, number, number] | undefined => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * Whether one version comes before another, by their numbers.
 *
 * @param version - the version.
 * @param other - the version compared with.
 */
export const isVersionBefore = (version: string, other: string): boolean => {
  const left = versionNumbers(version) ?? [0, 0, 0];
  const right = versionNumbers(other) ?? [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
};

/**
 * Why a request cannot run, or none: a version that is not one, a codemod nobody wrote.
 *
 * @param request - the request.
 */
export const migrateProblem = (request: Pick<MigrateRequest, "from" | "only">): string | undefined => {
  if (request.from !== undefined && versionNumbers(request.from) === undefined)
    return `--from ${request.from} is not a version: write it as 0.3.3`;
  const ids = CODEMODS.map((codemod) => codemod.id);
  const unknown = (request.only ?? []).filter((id) => !ids.includes(id));
  return unknown.length === 0
    ? undefined
    : `No codemod ${unknown.join(", ")}: the codemods are ${ids.join(", ")}`;
};

/** The codemods a request runs, and those it does not with why. */
const chosenCodemods = (
  request: Pick<MigrateRequest, "from" | "only">
): { readonly chosen: readonly Codemod[]; readonly skipped: readonly MigrateSkipped[] } => {
  const chosen: Codemod[] = [];
  const skipped: MigrateSkipped[] = [];
  for (const codemod of CODEMODS) {
    const isNamed = request.only?.includes(codemod.id) === true;
    if (request.only !== undefined && !isNamed) {
      skipped.push({ codemod: codemod.id, reason: "not named by --only" });
    } else if (request.from !== undefined && !isVersionBefore(request.from, codemod.breaksIn)) {
      skipped.push({
        codemod: codemod.id,
        reason: `${request.from} already has the change of ${codemod.breaksIn}`
      });
    } else if (request.from === undefined && codemod.kind === "keep" && !isNamed) {
      skipped.push({
        codemod: codemod.id,
        reason: `it keeps a behaviour from before ${codemod.breaksIn}, which a project may not want: give --from with the version you upgrade from, or --only ${codemod.id}`
      });
    } else {
      chosen.push(codemod);
    }
  }
  return { chosen, skipped };
};

/** An edit's text, without the commas and spaces around it that only join it to its neighbours. */
const shown = (text: string): string => text.replace(/^[\s,]+|[\s,]+$/g, "");

/** One file once the codemods ran on it. */
type MigratedText = {
  /** The file's path, absolute. */
  readonly path: string;
  /** Its text before. */
  readonly original: string;
  /** Its text after. */
  readonly text: string;
  /** The changes, as the document lists them. */
  readonly changes: readonly MigrateChange[];
  /** What the codemods left to a person. */
  readonly manual: readonly MigrateManual[];
};

/**
 * Runs the codemods on one file, each on the text the one before it left.
 *
 * @param file - the file.
 * @param name - its name in the document.
 * @param codemods - the codemods chosen.
 */
const migratedText = (
  { path, kind }: MigratedFile,
  name: string,
  codemods: readonly Codemod[]
): MigratedText => {
  const original = readFileSync(path, "utf8");
  const changes: MigrateChange[] = [];
  const manual: MigrateManual[] = [];
  let text = original;
  for (const codemod of codemods.filter((each) => each.files.includes(kind))) {
    const result = codemod.run(text, path);
    const shownEdits = result.edits.map((edit) => ({
      file: name,
      codemod: codemod.id,
      removed: shown(text.slice(edit.start, edit.end)),
      added: shown(edit.insert)
    }));
    // an edit that only moves a comma is part of the one beside it
    changes.push(...shownEdits.filter((change) => change.removed !== "" || change.added !== ""));
    manual.push(...result.manual.map((each) => ({ file: name, codemod: codemod.id, text: each })));
    text = appliedEdits(text, result.edits);
  }
  return { path, original, text, changes, manual };
};

/** The document's sentence: what changed or would, and what is left by hand. */
const summaryOf = (
  changes: readonly MigrateChange[],
  manual: readonly MigrateManual[],
  isWrite: boolean
): string => {
  const files = new Set(changes.map((change) => change.file)).size;
  let done = "Nothing to rewrite";
  if (changes.length > 0)
    done = isWrite
      ? `${changes.length} changes written to ${files} files`
      : `${changes.length} changes to make in ${files} files: run again with --write`;
  return `${done}${manual.length === 0 ? "" : `; ${manual.length} to do by hand`}.`;
};

/**
 * Runs the codemods a request chooses on its files, and writes them when asked: every file is read and rewritten before
 * any is written, so a file that cannot be read leaves the others as they were.
 *
 * @param request - the request, already checked with `migrateProblem`.
 * @returns what changed or would change, what is left to a person, and the notes for the versions crossed.
 */
export const runMigrate = (request: MigrateRequest): MigrateDocument => {
  const { chosen, skipped } = chosenCodemods(request);
  const fileOf = (path: string, kind: MigratedFileKind): MigratedFile => ({ path, kind });
  const files: readonly MigratedFile[] = [
    ...(request.config === undefined ? [] : [fileOf(request.config, "config")]),
    ...[...new Set(request.modules)]
      .filter((path) => path !== request.config)
      .map((path) => fileOf(path, "module"))
  ];
  const nameOf = (path: string): string => relative(request.cwd, path) || path;
  const migrated = files.map((file) => migratedText(file, nameOf(file.path), chosen));
  if (request.isWrite)
    for (const { path, original, text } of migrated) if (text !== original) writeFileSync(path, text);
  const changes = migrated.flatMap((each) => each.changes);
  const manual = migrated.flatMap((each) => each.manual);
  return {
    schema: 1,
    ...(request.from === undefined ? {} : { from: request.from }),
    isWritten: request.isWrite && changes.length > 0,
    files: files.map(({ path }) => nameOf(path)),
    changes,
    manual,
    skipped,
    notes: MIGRATION_NOTES.filter(
      (note) => request.from === undefined || isVersionBefore(request.from, note.breaksIn)
    ),
    summary: summaryOf(changes, manual, request.isWrite)
  };
};

/**
 * Whether a migration leaves work to do: changes listed and not written, or something only a person can do.
 *
 * @param document - what `runMigrate` answered.
 */
export const isMigrationPending = (document: MigrateDocument): boolean =>
  (document.changes.length > 0 && !document.isWritten) || document.manual.length > 0;

/**
 * The answer as a person reads it: each file's changes, what is left by hand, the codemods skipped and the notes.
 *
 * @param document - what `runMigrate` answered.
 */
export const migrateText = (document: MigrateDocument): string => {
  const lines: string[] = [];
  for (const file of new Set(document.changes.map((change) => change.file))) {
    lines.push(file);
    for (const change of document.changes.filter((each) => each.file === file)) {
      const removed =
        change.removed === "" ? [] : change.removed.split("\n").map((line) => `  - ${line.trim()}`);
      const added = change.added === "" ? [] : change.added.split("\n").map((line) => `  + ${line.trim()}`);
      lines.push(...removed, ...added, `    (${change.codemod})`);
    }
  }
  if (document.manual.length > 0) {
    lines.push("", "By hand:");
    lines.push(...document.manual.map((each) => `  ${each.file}: ${each.text} (${each.codemod})`));
  }
  if (document.skipped.length > 0) {
    lines.push("", "Not run:");
    lines.push(...document.skipped.map((each) => `  ${each.codemod}: ${each.reason}`));
  }
  if (document.notes.length > 0) {
    lines.push("", "Breaking changes with no codemod, to check by hand:");
    lines.push(...document.notes.map((note) => `  ${note.id} (${note.breaksIn}): ${note.text}`));
  }
  lines.push("", document.summary);
  return lines.join("\n").replace(/^\n+/, "");
};
