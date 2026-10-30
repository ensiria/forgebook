/**
 * The TypeScript programs the extractor reads: one per `tsconfig.json`, created on TypeScript 6's compiler API and
 * kept until a source file changes (`markSourcesChanged`), then renewed on the next read, reusing what did not change.
 *
 * @remarks
 * The repo type-checks with TypeScript 7, whose native compiler has no JavaScript API; TypeScript 6 (the version
 * typescript-eslint uses too) reads the same configurations (D-58).
 *
 * @module
 */
import { dirname } from "node:path";

import ts from "typescript-6";

/** A program and its type checker. */
export type DocsProgram = {
  /** The program. */
  readonly program: ts.Program;
  /** Its type checker. */
  readonly checker: ts.TypeChecker;
};

/** The last program of each configuration, reused by the next read. */
const programs = new Map<string, ts.Program>();

/**
 * The configurations whose program may hold an edited file: renewed on their next read. A program read again without
 * a change answers at once, its type checker kept; renewing it on every read cost seconds a read.
 */
const outdated = new Set<string>();

/** Marks every program as maybe holding an edited file: each is renewed on its next read. */
export const markSourcesChanged = (): void => {
  for (const configPath of programs.keys()) outdated.add(configPath);
};

/**
 * The program that holds a file: the one of the nearest `tsconfig.json` up its folders.
 *
 * @param file - an absolute path to a source file.
 * @returns the program, or a message when no configuration holds the file.
 */
export const programFor = (file: string): DocsProgram | string => {
  const configPath = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) return `No tsconfig.json above ${file}`;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined
    }
  );
  if (parsed === undefined) return `${configPath} could not be read`;
  const oldProgram = programs.get(configPath);
  if (oldProgram !== undefined && !outdated.has(configPath)) {
    if (oldProgram.getSourceFile(file) === undefined) return `${configPath} does not include ${file}`;
    return { program: oldProgram, checker: oldProgram.getTypeChecker() };
  }
  outdated.delete(configPath);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    ...(oldProgram === undefined ? {} : { oldProgram })
  });
  programs.set(configPath, program);
  if (program.getSourceFile(file) === undefined) return `${configPath} does not include ${file}`;
  return { program, checker: program.getTypeChecker() };
};

/**
 * The first paragraph of a symbol's TSDoc.
 *
 * @param symbol - a declared symbol.
 * @param checker - the program's type checker.
 */
export const summaryOf = (symbol: ts.Symbol, checker: ts.TypeChecker): string =>
  (ts.displayPartsToString(symbol.getDocumentationComment(checker)).split(/\n\s*\n/)[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The first paragraph of a file's leading comment, its `@module` TSDoc: what the file holds, in a sentence. A
 * component's own TSDoc is often a bare name ("A button."); its file's comment says what it is and does.
 *
 * @param sourceFile - the file.
 * @returns the paragraph on one line, or an empty text when the file does not open with a `@module` comment.
 */
export const moduleSummaryOf = (sourceFile: ts.SourceFile): string => {
  const text = sourceFile.getFullText();
  const [range] = ts.getLeadingCommentRanges(text, 0) ?? [];
  if (range === undefined) return "";
  const comment = text.slice(range.pos, range.end);
  if (!comment.startsWith("/**") || !comment.includes("@module")) return "";
  const lines = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd());
  const start = lines.findIndex((line) => line !== "");
  const paragraph: string[] = [];
  for (const line of lines.slice(Math.max(start, 0))) {
    if (line === "" || line.startsWith("@")) break;
    paragraph.push(line);
  }
  return paragraph.join(" ").replace(/\s+/g, " ").trim();
};

/**
 * A TSDoc tag's text, without the backticks it is often written in.
 *
 * @param symbol - a declared symbol.
 * @param checker - the program's type checker.
 * @param name - the tag (`defaultValue`).
 */
export const tagOf = (symbol: ts.Symbol, checker: ts.TypeChecker, name: string): string | undefined => {
  const tag = symbol.getJsDocTags(checker).find((candidate) => candidate.name === name);
  if (tag === undefined) return undefined;
  return ts
    .displayPartsToString(tag.text)
    .trim()
    .replace(/^`(.*)`$/, "$1");
};
