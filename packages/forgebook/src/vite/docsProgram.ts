/**
 * The TypeScript programs the extractor reads: one per `tsconfig.json`, created on TypeScript 6's compiler API and
 * kept until a source file changes (`markSourcesChanged`), then renewed on the next read, reusing what did not change.
 *
 * @remarks
 * The repo type-checks with TypeScript 7, whose native compiler has no JavaScript API; TypeScript 6 (the version
 * typescript-eslint uses too) reads the same configurations.
 *
 * A file is read with the configuration an editor reads it with: the nearest `tsconfig.json` up its folders that holds
 * it, or a project it references. A monorepo's package often holds only its sources while the root's configuration
 * holds the stories too, with the paths that lead a package's name to its sources: reading a story with the package's
 * configuration would leave its component's type unknown.
 *
 * A framework whose components are not TypeScript (Svelte's `.svelte`) hands the text TypeScript reads in a component's
 * place (`ProgramSources`): its programs are kept apart from the plain ones, under the same configuration.
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

/**
 * What TypeScript reads in place of files it cannot read itself: a framework's components, each written as the
 * TypeScript it amounts to, under a name beside the component (`Badge.svelte.ts` for `Badge.svelte`), so an import of the
 * component resolves to it as TypeScript resolves any import.
 */
export type ProgramSources = {
  /** The sources' name, which keeps their programs apart from the plain ones (`svelte`). */
  readonly name: string;
  /**
   * The text of a file that is not on disk.
   *
   * @param fileName - the file TypeScript asks for.
   * @returns its text, or none for a file read from disk.
   */
  readonly textOf: (fileName: string) => string | undefined;
  /** The declarations every program holds besides its sources, which the written text refers to. */
  readonly roots: readonly string[];
  /** Compiler options over the configuration's (JavaScript allowed, for components written without TypeScript). */
  readonly options: ts.CompilerOptions;
};

/**
 * A compiler host that reads the sources' files as if they were on disk.
 *
 * @param options - the program's compiler options.
 * @param sources - the files to read in place.
 */
const sourcesHost = (options: ts.CompilerOptions, sources: ProgramSources): ts.CompilerHost => {
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  return {
    ...host,
    fileExists: (fileName: string): boolean => sources.textOf(fileName) !== undefined || fileExists(fileName),
    readFile: (fileName: string): string | undefined => sources.textOf(fileName) ?? readFile(fileName),
    getSourceFile: (
      fileName: string,
      languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions,
      onError?: (message: string) => void,
      shouldCreate?: boolean
    ): ts.SourceFile | undefined => {
      const text = sources.textOf(fileName);
      return text === undefined
        ? getSourceFile(fileName, languageVersion, onError, shouldCreate)
        : ts.createSourceFile(fileName, text, languageVersion, true);
    }
  };
};

/** The last program of each configuration, reused by the next read. */
const programs = new Map<string, ts.Program>();

/**
 * The configurations whose program may hold an edited file: renewed on their next read. A program read again without
 * a change answers at once, its type checker kept; renewing it on every read cost seconds a read.
 */
const outdated = new Set<string>();

/** Each configuration read, with the files it holds, kept until a source changes; `undefined` when it cannot be read. */
const configurations = new Map<string, ReadConfiguration | undefined>();

/** A configuration read: its options and files, and the files as a set to look one up. */
type ReadConfiguration = {
  /** What TypeScript read. */
  readonly parsed: ts.ParsedCommandLine;
  /** Its files, in TypeScript's form (forward slashes). */
  readonly fileSet: ReadonlySet<string>;
};

/**
 * The files read since the configurations were last read that none of them lists: they are not read again for each,
 * which a project whose stories no configuration holds would otherwise pay on every read.
 */
const unlisted = new Set<string>();

/** Marks every program as maybe holding an edited file: each is renewed on its next read. */
export const markSourcesChanged = (): void => {
  for (const configPath of programs.keys()) outdated.add(configPath);
  // an edited configuration may hold other files, or have other options
  configurations.clear();
  unlisted.clear();
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
 * @param sources - the files read in place of a framework's components; none for a plain program.
 */
const keptProgram = (
  key: string,
  rootNames: readonly string[],
  options: ts.CompilerOptions,
  sources: ProgramSources | undefined
): ts.Program => {
  const oldProgram = programs.get(key);
  if (oldProgram !== undefined && !outdated.has(key)) return oldProgram;
  outdated.delete(key);
  const program = ts.createProgram({
    rootNames: sources === undefined ? rootNames : [...rootNames, ...sources.roots],
    options,
    ...(sources === undefined ? {} : { host: sourcesHost(options, sources) }),
    ...(oldProgram === undefined ? {} : { oldProgram })
  });
  programs.set(key, program);
  return program;
};

/** What a program's key adds for the sources it reads: nothing for a plain program. */
const sourcesKey = (sources: ProgramSources | undefined): string =>
  sources === undefined ? "" : `#${sources.name}`;

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
 * @param sources - the files read in place of a framework's components; none for a plain program.
 */
const looseProgram = (
  file: string,
  options: ts.CompilerOptions,
  sources: ProgramSources | undefined
): DocsProgram => {
  const merged = { ...options, ...sources?.options, allowJs: true, noEmit: true };
  const folder = projectFolder(file);
  const key = `${folder}#loose#${sourcesKey(sources)}${JSON.stringify(merged)}`;
  const kept = programs.get(key);
  // a file the program does not hold is new: reading the folder again finds it, and whatever else came with it
  if (kept !== undefined && kept.getSourceFile(file) === undefined) outdated.add(key);
  const files =
    kept === undefined || outdated.has(key)
      ? ts.sys.readDirectory(folder, SOURCE_EXTENSIONS, NOT_SOURCES)
      : [];
  const program = keptProgram(key, files.includes(file) ? files : [...files, file], merged, sources);
  return { program, checker: program.getTypeChecker() };
};

/**
 * A configuration, read once until a source changes.
 *
 * @param configPath - the `tsconfig.json`.
 * @returns it with its files, or `undefined` when it cannot be read.
 */
const readConfiguration = (configPath: string): ReadConfiguration | undefined => {
  if (configurations.has(configPath)) return configurations.get(configPath);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined
    }
  );
  const read = parsed === undefined ? undefined : { parsed, fileSet: new Set(parsed.fileNames) };
  configurations.set(configPath, read);
  return read;
};

/**
 * The configuration a config file stands for, then the projects it references (a root's `tsconfig.json` that only
 * lists its packages' projects), in an editor's order.
 *
 * @param configPath - the `tsconfig.json`.
 */
const withReferences = (configPath: string): string[] => [
  configPath,
  ...(readConfiguration(configPath)?.parsed.projectReferences ?? []).map((reference) =>
    ts.resolveProjectReferencePath(reference)
  )
];

/**
 * The first configuration up a file's folders (or a project one references) that lists it, as an editor finds it.
 * Each is read only when the ones below it do not list the file, so a configuration far above (a home folder's) is
 * read only for a file nothing closer holds.
 *
 * @param file - an absolute path to a source file.
 */
const holdingConfiguration = (file: string): string | undefined => {
  const name = file.replaceAll("\\", "/");
  let folder = dirname(file);
  for (;;) {
    const configPath = ts.findConfigFile(folder, ts.sys.fileExists, "tsconfig.json");
    if (configPath === undefined) return undefined;
    const holding = withReferences(configPath).find(
      (candidate) => readConfiguration(candidate)?.fileSet.has(name) === true
    );
    if (holding !== undefined) return holding;
    const parent = dirname(dirname(configPath));
    if (parent === dirname(configPath)) return undefined;
    folder = parent;
  }
};

/**
 * A configuration's program, renewed when it lacks a file the configuration lists: a story file added since the
 * program was made.
 *
 * @param configPath - the `tsconfig.json`.
 * @param read - the configuration, read.
 * @param file - the file the program is for.
 * @param sources - the files read in place of a framework's components; none for a plain program.
 */
const configurationProgram = (
  configPath: string,
  read: ReadConfiguration,
  file: string,
  sources: ProgramSources | undefined
): DocsProgram => {
  const key = `${configPath}${sourcesKey(sources)}`;
  const kept = programs.get(key);
  if (kept !== undefined && kept.getSourceFile(file) === undefined) outdated.add(key);
  const options = { ...read.parsed.options, ...sources?.options };
  const program = keptProgram(key, read.parsed.fileNames, options, sources);
  return { program, checker: program.getTypeChecker() };
};

/**
 * The program that holds a file: the one of the first configuration up its folders (or a project it references) that
 * lists it; else the nearest one's, when the file reaches it through an import; else the one the files no
 * configuration holds share (`FALLBACK_OPTIONS`, or the nearest configuration's with JavaScript allowed).
 *
 * @param file - an absolute path to a source file, or to a file the sources write.
 * @param sources - the files read in place of a framework's components; none for a plain program.
 * @returns the program, or a message when the configuration above it cannot be read.
 */
export const programFor = (file: string, sources?: ProgramSources): DocsProgram | string => {
  const nearest = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  if (nearest === undefined) return looseProgram(file, FALLBACK_OPTIONS, sources);
  // a file the sources write is on no configuration's list, so reading them again would not find it
  const isWritten = sources?.textOf(file) !== undefined;
  // a file added since the configurations were read is in none of their lists: they are read again, once per file
  let holding = holdingConfiguration(file);
  if (holding === undefined && !isWritten && !unlisted.has(file)) {
    configurations.clear();
    unlisted.clear();
    holding = holdingConfiguration(file);
  }
  if (holding === undefined) unlisted.add(file);
  const holdingRead = holding === undefined ? undefined : readConfiguration(holding);
  if (holding !== undefined && holdingRead !== undefined)
    return configurationProgram(holding, holdingRead, file, sources);
  const read = readConfiguration(nearest);
  if (read === undefined) return `${nearest} could not be read`;
  const options = { ...read.parsed.options, ...sources?.options };
  const program = keptProgram(`${nearest}${sourcesKey(sources)}`, read.parsed.fileNames, options, sources);
  if (program.getSourceFile(file) === undefined) return looseProgram(file, read.parsed.options, sources);
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

/**
 * The component asked for among a file's: the one named, or the only one.
 *
 * @param components - the names of the components the file exports.
 * @param exportName - the export asked for; the file's only component when none.
 * @param file - the file, for the message.
 * @returns the name, or a message naming the components when there is none or several.
 */
export const chosenExport = (
  components: readonly string[],
  exportName: string | undefined,
  file: string
): string | { readonly problem: string } => {
  const chosen = exportName === undefined ? components : components.filter((each) => each === exportName);
  const [only] = chosen;
  if (only !== undefined && chosen.length === 1) return only;
  const names = components.join(", ") || "none";
  return {
    problem:
      exportName === undefined
        ? `${file} exports ${components.length === 0 ? "no component" : `several components (${names})`}: name one`
        : `${file} exports no component ${exportName} (its components: ${names})`
  };
};
