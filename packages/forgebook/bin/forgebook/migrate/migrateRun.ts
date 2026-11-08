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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

import { CODEMODS, MIGRATION_NOTES } from "./codemods.ts";
import type {
  Codemod,
  MigrateAdvice,
  MigrateChange,
  MigrateDocument,
  MigratedFileKind,
  MigrateSkipped
} from "./migrate.types.ts";
import { writeMigrated } from "./migrateWrite.ts";
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

/** A version read: its numbers, and whether it is a prerelease of them. */
type ReadVersion = { readonly numbers: readonly [number, number, number]; readonly isPrerelease: boolean };

/**
 * A version read; none when it is not `major.minor.patch` (a `v` before it, a prerelease or build after it allowed).
 *
 * @param version - the version.
 */
const readVersion = (version: string): ReadVersion | undefined => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(-[^+]*)?(?:\+.*)?$/.exec(version.trim());
  return match === null
    ? undefined
    : {
        numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
        isPrerelease: match[4] !== undefined
      };
};

/**
 * Whether one version comes before another: by their numbers, and a prerelease (`0.4.0-rc.1`) before its release, since
 * a change of 0.4.0 may have landed after its prerelease was cut.
 *
 * @param version - the version.
 * @param other - the version compared with.
 */
export const isVersionBefore = (version: string, other: string): boolean => {
  const left = readVersion(version) ?? { numbers: [0, 0, 0], isPrerelease: false };
  const right = readVersion(other) ?? { numbers: [0, 0, 0], isPrerelease: false };
  for (let index = 0; index < 3; index += 1) {
    const difference = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return left.isPrerelease && !right.isPrerelease;
};

/**
 * Why a request cannot run, or none: a version that is not one, a codemod nobody wrote.
 *
 * @param request - the request.
 */
export const migrateProblem = (request: Pick<MigrateRequest, "from" | "only">): string | undefined => {
  if (request.from !== undefined && readVersion(request.from) === undefined)
    return `--from ${request.from} is not a version: write it as 0.3.3`;
  const ids = CODEMODS.map((codemod) => codemod.id);
  const unknown = (request.only ?? []).filter((id) => !ids.includes(id));
  return unknown.length === 0
    ? undefined
    : `No codemod ${unknown.join(", ")}: the codemods are ${ids.join(", ")}`;
};

/**
 * Why a module given by path is not migrated, or none: one under `node_modules` is a package's, which an install puts back,
 * and one outside the folder the command runs in is another project's. Its link is followed, so a link cannot lead out.
 *
 * @param path - the module, absolute and present.
 * @param cwd - the folder the command runs in.
 */
export const moduleProblem = (path: string, cwd: string): string | undefined => {
  const real = realpathSync(path);
  if (real.split(sep).includes("node_modules"))
    return `${path} is inside node_modules: migrate the package's own sources, not its installed copy`;
  const inside = relative(realpathSync(cwd), real);
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside))
    return `${path} is outside ${cwd}: run forgebook migrate from the project that holds it`;
  return undefined;
};

/**
 * Why a request cannot run, or none: its version or codemods (`migrateProblem`), no file at all, a file that is not
 * there, a module that is not the project's own (`moduleProblem`).
 *
 * @param request - the request.
 */
export const requestProblem = (request: MigrateRequest): string | undefined => {
  const choiceProblem = migrateProblem(request);
  if (choiceProblem !== undefined) return choiceProblem;
  if (request.config === undefined && request.modules.length === 0)
    return "No forgebook.config.ts here, and no file given: run forgebook migrate in the catalogue's folder, or give --config or the files";
  const missing = [...(request.config === undefined ? [] : [request.config]), ...request.modules].find(
    (file) => !existsSync(file)
  );
  if (missing !== undefined) return `No file ${missing}`;
  return request.modules.map((file) => moduleProblem(file, request.cwd)).find((each) => each !== undefined);
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
  /** What the codemods could not see into. */
  readonly advice: readonly MigrateAdvice[];
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
  const advice: MigrateAdvice[] = [];
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
    advice.push(...result.advice.map((each) => ({ file: name, codemod: codemod.id, text: each })));
    text = appliedEdits(text, result.edits);
  }
  return { path, original, text, changes, advice };
};

/**
 * A count with its noun, singular for one.
 *
 * @param count - the count.
 * @param noun - the noun, singular; its plural adds an s.
 */
const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The document's sentence: what changed or would, and what to check. */
const summaryOf = (
  changes: readonly MigrateChange[],
  advice: readonly MigrateAdvice[],
  isWrite: boolean
): string => {
  const files = counted(new Set(changes.map((change) => change.file)).size, "file");
  let done = "Nothing to rewrite";
  if (changes.length > 0)
    done = isWrite
      ? `${counted(changes.length, "change")} written to ${files}`
      : `${counted(changes.length, "change")} to make in ${files}: run again with --write`;
  return `${done}${advice.length === 0 ? "" : `; ${counted(advice.length, "place")} to check`}.`;
};

/**
 * Runs the codemods a request chooses on its files, and writes them when asked: every file is read and rewritten before
 * any is written, and each is written whole (`writeMigrated`).
 *
 * @param request - the request, already checked with `migrateProblem`.
 * @returns what changed or would change, what to check, and the notes for the versions crossed.
 * @throws a `MigrateWriteError` when a file cannot be written, naming those that were.
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
    writeMigrated(
      migrated.filter(({ original, text }) => text !== original),
      nameOf
    );
  const changes = migrated.flatMap((each) => each.changes);
  const advice = migrated.flatMap((each) => each.advice);
  return {
    schema: 1,
    ...(request.from === undefined ? {} : { from: request.from }),
    isWritten: request.isWrite && changes.length > 0,
    files: files.map(({ path }) => nameOf(path)),
    changes,
    advice,
    skipped,
    notes: MIGRATION_NOTES.filter(
      (note) =>
        note.package !== "forgebook" ||
        request.from === undefined ||
        isVersionBefore(request.from, note.breaksIn)
    ),
    summary: summaryOf(changes, advice, request.isWrite)
  };
};

/**
 * Whether a migration leaves work to do: changes listed and not written. Advice and notes are for a person to read, and
 * leave the exit code at 0, so that a project that went through them ends clean.
 *
 * @param document - what `runMigrate` answered.
 */
export const isMigrationPending = (document: MigrateDocument): boolean =>
  document.changes.length > 0 && !document.isWritten;
