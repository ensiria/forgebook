/**
 * The TypeScript programs the extractor reads: one per `tsconfig.json`, created on TypeScript 6's compiler API and
 * kept until a source file changes (`markSourcesChanged`), then renewed on the next read, reusing what did not change.
 *
 * @remarks
 * The repo type-checks with TypeScript 7, whose native compiler has no JavaScript API; TypeScript 6 (the version
 * typescript-eslint uses too) reads the same configurations.
 *
 * @module
 */
import { dirname } from "node:path";

import ts from "typescript-6";

import { moduleSummaryOfText } from "./moduleSummary.ts";

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
 * What a story file is read with when no `tsconfig.json` holds it (a JavaScript project, a `.jsx` story in a project
 * that does not allow JavaScript): its imports resolved as Vite resolves them, JavaScript and JSX allowed.
 */
const FALLBACK_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  skipLibCheck: true,
  noEmit: true
};

/**
 * A program from its root files, the one kept under the same key reused while no source changed.
 *
 * @param key - the program's key: its configuration file, or what the files no configuration holds share.
 * @param rootNames - its root files.
 * @param options - its compiler options.
 */
const keptProgram = (key: string, rootNames: readonly string[], options: ts.CompilerOptions): ts.Program => {
  const oldProgram = programs.get(key);
  if (oldProgram !== undefined && !outdated.has(key)) return oldProgram;
  outdated.delete(key);
  const program = ts.createProgram({
    rootNames,
    options,
    ...(oldProgram === undefined ? {} : { oldProgram })
  });
  programs.set(key, program);
  return program;
};

/** The extensions a project's sources have. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** The folders that hold no sources of the project. */
const NOT_SOURCES = ["**/node_modules", "**/dist", "**/build"];

/** The folder a file's project sits in: its nearest `package.json`'s, or its own. */
const projectFolder = (file: string): string => {
  const manifest = ts.findConfigFile(dirname(file), ts.sys.fileExists, "package.json");
  return manifest === undefined ? dirname(file) : dirname(manifest);
};

/**
 * The program of files no configuration holds, from which their imports reach the component: every source of the
 * project at once, as a `tsconfig.json` would list them. A program holds the standard library's types and all that its
 * files import, so one per file, or one rebuilt for each new file, filled the heap with what the last rebuild left:
 * gigabytes in a project of a hundred stories with no `tsconfig.json`, up to Node's limit.
 *
 * @param file - the story file.
 * @param options - the options of the configuration above it, when there is one; JavaScript is allowed on top.
 */
const looseProgram = (file: string, options: ts.CompilerOptions): DocsProgram => {
  const merged = { ...options, allowJs: true, noEmit: true };
  const folder = projectFolder(file);
  const key = `${folder}#loose#${JSON.stringify(merged)}`;
  const kept = programs.get(key);
  // a file the program does not hold is new: reading the folder again finds it, and whatever else came with it
  if (kept !== undefined && kept.getSourceFile(file) === undefined) outdated.add(key);
  const files =
    kept === undefined || outdated.has(key)
      ? ts.sys.readDirectory(folder, SOURCE_EXTENSIONS, NOT_SOURCES)
      : [];
  const program = keptProgram(key, files.includes(file) ? files : [...files, file], merged);
  return { program, checker: program.getTypeChecker() };
};

/**
 * The program that holds a file: the one of the nearest `tsconfig.json` up its folders, or, when none holds it, the one
 * the files no configuration holds share (`FALLBACK_OPTIONS`, or the configuration's with JavaScript allowed).
 *
 * @param file - an absolute path to a source file.
 * @returns the program, or a message when the configuration above it cannot be read.
 */
export const programFor = (file: string): DocsProgram | string => {
  const configPath = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) return looseProgram(file, FALLBACK_OPTIONS);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined
    }
  );
  if (parsed === undefined) return `${configPath} could not be read`;
  const program = keptProgram(configPath, parsed.fileNames, parsed.options);
  if (program.getSourceFile(file) === undefined) return looseProgram(file, parsed.options);
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
 * The first paragraph of a parsed file's leading `@module` comment (`moduleSummary.ts`).
 *
 * @param sourceFile - the file.
 */
export const moduleSummaryOf = (sourceFile: ts.SourceFile): string =>
  moduleSummaryOfText(sourceFile.getFullText());

/**
 * Each of a TSDoc tag's texts, for a tag that can be written more than once.
 *
 * @param symbol - a declared symbol.
 * @param checker - the program's type checker.
 * @param name - the tag (`useWhen`).
 */
export const tagsOf = (symbol: ts.Symbol, checker: ts.TypeChecker, name: string): string[] =>
  symbol
    .getJsDocTags(checker)
    .filter((candidate) => candidate.name === name)
    .map((tag) => ts.displayPartsToString(tag.text).trim())
    .filter((text) => text !== "");

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
