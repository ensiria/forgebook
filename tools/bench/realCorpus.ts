/**
 * A real corpus's definition, read and checked before any work: everything here is pure.
 *
 * @remarks
 * A definition is what makes a run reproducible, so it refuses what would make it drift: a repository not on HTTPS,
 * which would ask for credentials, and a commit that is not a full hash, which could move.
 *
 * @module
 */
import { isAbsolute, join, resolve } from "node:path";

import type { CorpusEdit, CorpusPaths, RealCorpus } from "./realCorpus.types.ts";

/** The folder Forgebook runs from, in the catalogue's folder: dotted, so no story glob of the library matches it. */
export const BENCH_FOLDER = ".forgebook-bench";

/** A commit in full. */
const FULL_COMMIT = /^[0-9a-f]{40}$/;

/** A file's name in a corpus's folder. */
export const DEFINITION_FILE = "corpus.json";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a list of texts, none empty. */
const isCommand = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((word) => typeof word === "string" && word !== "");

/** The texts an object must have. */
const missingTexts = (value: unknown, fields: readonly string[], where: string): string[] => {
  if (!isRecord(value)) return [`${where} is missing`];
  return fields.flatMap((field) =>
    typeof value[field] === "string" && value[field] !== "" ? [] : [`${where}.${field} is missing`]
  );
};

/** What is wrong with an edit. */
const editProblems = (edit: unknown, where: string): string[] => {
  const problems = missingTexts(edit, ["file", "find", "replace"], where);
  if (isRecord(edit) && !String(edit["replace"]).includes("{edit}")) {
    problems.push(`${where}.replace must hold {edit}, or an edit would not show`);
  }
  return problems;
};

/** What is wrong with the `expected` numbers. */
const expectedProblems = (expected: unknown): string[] =>
  isRecord(expected) && typeof expected["files"] === "number" && typeof expected["stories"] === "number"
    ? []
    : ["expected.files and expected.stories are missing"];

/**
 * What is wrong with a parsed definition; nothing when it can be used.
 *
 * @param value - the parsed file.
 */
export const corpusProblems = (value: unknown): string[] => {
  if (!isRecord(value)) return ["a corpus is an object"];
  const problems = missingTexts(value, ["name", "repository", "commit", "licence", "folder"], "corpus");
  if (typeof value["commit"] !== "string" || !FULL_COMMIT.test(value["commit"]))
    problems.push("corpus.commit must be a full commit hash: a branch or a tag moves");
  if (typeof value["repository"] !== "string" || !value["repository"].startsWith("https://"))
    problems.push("corpus.repository must be on https, which needs no credentials");
  if (!isCommand(value["install"])) problems.push("corpus.install must be a command, as a list of words");
  problems.push(...expectedProblems(value["expected"]));
  problems.push(
    ...missingTexts(
      value["measured"],
      ["forgebookStory", "forgebookComponent", "text", "pageText", "sidebar"],
      "measured"
    )
  );
  const edits = isRecord(value["edits"]) ? value["edits"] : {};
  problems.push(...editProblems(edits["story"], "edits.story"));
  problems.push(...editProblems(edits["component"], "edits.component"));
  return problems;
};

/** Whether a parsed definition can be used. */
const isCorpus = (value: unknown): value is RealCorpus => corpusProblems(value).length === 0;

/**
 * A definition read from its file's text.
 *
 * @param text - the file's text.
 * @param file - the file, for the message.
 * @throws naming every problem, when it cannot be used.
 */
export const parseCorpus = (text: string, file: string): RealCorpus => {
  const value: unknown = JSON.parse(text);
  if (isCorpus(value)) return value;
  throw new Error(`${file}: ${corpusProblems(value).join("; ")}`);
};

/**
 * The folder of a definition: a corpus's name under `corpora/`, or a folder.
 *
 * @param argument - what `--corpus` was given.
 * @param corpora - the folder of the corpora in this repository.
 * @param cwd - the folder a relative path starts from.
 */
export const definitionFolder = (argument: string, corpora: string, cwd: string): string => {
  if (/^[a-z0-9-]+$/.test(argument)) return join(corpora, argument);
  return isAbsolute(argument) ? argument : resolve(cwd, argument);
};

/**
 * Where a corpus lives.
 *
 * @param corpus - the corpus.
 * @param definition - its definition's folder.
 * @param work - the benchmark's work folder.
 */
export const corpusPaths = (corpus: RealCorpus, definition: string, work: string): CorpusPaths => {
  const clone = join(work, "corpus", corpus.name);
  const catalogue = join(clone, corpus.folder);
  return { definition, clone, catalogue, bench: join(catalogue, BENCH_FOLDER) };
};

/**
 * A file with an edit applied.
 *
 * @param original - the file's text.
 * @param edit - the edit.
 * @param mark - the text that shows this edit.
 * @throws when the file does not hold the text, so a stale definition fails at once and does not time out.
 */
export const editedText = (original: string, edit: CorpusEdit, mark: string): string => {
  if (!original.includes(edit.find)) throw new Error(`${edit.file} no longer holds: ${edit.find}`);
  return original.replace(edit.find, edit.replace.replace("{edit}", mark));
};
