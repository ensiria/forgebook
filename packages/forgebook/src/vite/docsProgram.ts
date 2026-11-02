/**
 * The TypeScript programs the extractor reads: one per `tsconfig.json`, created on TypeScript 6's compiler API and
 * kept until a source file changes (`markSourcesChanged`), then renewed on the next read, reusing what did not change.
 *
 * @remarks
 * The repo type-checks with TypeScript 7, whose native compiler has no JavaScript API; TypeScript 6 (the version
 * typescript-eslint uses too) reads the same configurations.
 *
 * A program is the largest thing the dev server holds, so three things keep it small. A dev server's programs hold the
 * files that were asked for (`readAskedFilesOnly`), not every file of the configuration. Each configuration keeps its
 * parsed files between programs, since a renewed program reuses a file only when its host hands back the same object;
 * without that every renewal parses everything again. And the standard library is parsed without its documentation,
 * most of `lib.dom.d.ts`, which no component's docs read: a component's own props never come from it.
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

/**
 * How many programs are kept. A program holds all its package reaches, hundreds of megabytes in a monorepo whose
 * `tsconfig` paths lead to every package's sources, and one is made per `tsconfig.json`: kept without a limit they fill
 * the worker's heap, it stops, and every story still waiting gets that error instead of its docs. Making one again
 * takes a second or so, which is the cheaper of the two.
 */
export const KEPT_PROGRAMS = 4;

/** The last program of each configuration, the one read last at the end: reused by the next read. */
const programs = new Map<string, ts.Program>();

/**
 * Keeps a program as the one read last, and lets the oldest go past the limit.
 *
 * @param key - the program's key.
 * @param program - the program.
 */
const keepProgram = (key: string, program: ts.Program): void => {
  programs.delete(key);
  programs.set(key, program);
  for (const oldest of programs.keys()) {
    if (programs.size <= KEPT_PROGRAMS) break;
    programs.delete(oldest);
    parsedFiles.delete(oldest);
    outdated.delete(oldest);
  }
};

/**
 * The configurations whose program may hold an edited file: renewed on their next read. A program read again without
 * a change answers at once, its type checker kept; renewing it on every read cost seconds a read.
 */
const outdated = new Set<string>();

/** The parsed files of each program's key, by file name, with the file's time when it was parsed. */
const parsedFiles = new Map<
  string,
  Map<string, { readonly time: number | undefined; readonly file: ts.SourceFile | undefined }>
>();

/** The files asked for, by configuration; none while every program holds all its configuration's files. */
let askedFiles: Map<string, Set<string>> | undefined;

/**
 * From now on a program holds what was asked for and what that imports, not its whole configuration: a dev server shows
 * one component at a time. Reads of all of it stay as they were (`programFor`'s `isWhole`).
 */
export const readAskedFilesOnly = (): void => {
  askedFiles ??= new Map();
};

/**
 * Each configuration as read, until a source changes. Reading one lists every file of its project, so reading it again
 * for each story file is quadratic in the library's size: minutes of `readdir` on thousands of stories.
 */
const parsedConfigs = new Map<string, ts.ParsedCommandLine | undefined>();

/** Marks every program as maybe holding an edited file: each is renewed on its next read. */
export const markSourcesChanged = (): void => {
  for (const configPath of programs.keys()) outdated.add(configPath);
  parsedConfigs.clear();
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
 * Whether a file is a dependency's declarations: the standard library's, or a `.d.ts` in `node_modules`.
 *
 * @param fileName - the file.
 * @param libraryFolder - the standard library's folder.
 */
const isDependencyTypes = (fileName: string, libraryFolder: string): boolean =>
  dirname(fileName) === libraryFolder || (fileName.endsWith(".d.ts") && fileName.includes("/node_modules/"));

/**
 * A compiler host that keeps the files it parsed: handing back the same object is what lets a new program reuse a file.
 *
 * @param key - the program's key.
 * @param options - its compiler options.
 * @param isOwnOnly - whether a dependency's declarations are left empty (`usageProgramFor`).
 */
const keepingHost = (key: string, options: ts.CompilerOptions, isOwnOnly: boolean): ts.CompilerHost => {
  const host = ts.createCompilerHost(options);
  const parse = host.getSourceFile;
  const libraryFolder = dirname(ts.getDefaultLibFilePath(options));
  const kept = parsedFiles.get(key) ?? new Map();
  parsedFiles.set(key, kept);
  host.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreate?: boolean
  ): ts.SourceFile | undefined => {
    const time = ts.sys.getModifiedTime?.(fileName)?.getTime();
    const known = kept.get(fileName);
    if (known !== undefined && known.time === time && shouldCreate !== true) return known.file;
    const version = typeof languageVersion === "object" ? languageVersion : { languageVersion };
    if (isOwnOnly && isDependencyTypes(fileName, libraryFolder))
      return ts.createSourceFile(fileName, "", version);
    const file = parse(
      fileName,
      dirname(fileName) === libraryFolder
        ? { ...version, jsDocParsingMode: ts.JSDocParsingMode.ParseNone }
        : version,
      onError,
      shouldCreate
    );
    kept.set(fileName, { time, file });
    return file;
  };
  return host;
};

/**
 * A program from its root files, the one kept under the same key reused while no source changed.
 *
 * @param key - the program's key: its configuration file, or what the files no configuration holds share.
 * @param rootNames - its root files.
 * @param options - its compiler options.
 * @param isOwnOnly - whether a dependency's declarations are left empty.
 */
const keptProgram = (
  key: string,
  rootNames: readonly string[],
  options: ts.CompilerOptions,
  isOwnOnly = false
): ts.Program => {
  const oldProgram = programs.get(key);
  const isSameRoots = oldProgram?.getRootFileNames().length === rootNames.length;
  if (oldProgram !== undefined && isSameRoots && !outdated.has(key)) {
    keepProgram(key, oldProgram);
    return oldProgram;
  }
  outdated.delete(key);
  const program = ts.createProgram({
    rootNames,
    options,
    host: keepingHost(key, options, isOwnOnly),
    ...(oldProgram === undefined ? {} : { oldProgram })
  });
  keepProgram(key, program);
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
      : kept.getRootFileNames();
  const program = keptProgram(key, files.includes(file) ? files : [...files, file], merged);
  return { program, checker: program.getTypeChecker() };
};

/**
 * The files asked for before a program takes all its configuration's files: each new root makes a new type checker,
 * so a session that walks a whole library would pay more than the whole program costs at once.
 */
const MOST_ASKED = 16;

/**
 * The root files of a configuration's program: all of them, or, once only what is asked for is read, its ambient
 * declarations (what they declare holds without an import) and the files asked for so far.
 *
 * @param configPath - the configuration.
 * @param fileNames - its files.
 * @param file - the file asked for.
 * @param isWhole - whether the reader needs every file.
 */
const rootsOf = (
  configPath: string,
  fileNames: readonly string[],
  file: string,
  isWhole: boolean
): readonly string[] => {
  if (askedFiles === undefined) return fileNames;
  const asked = askedFiles.get(configPath) ?? new Set(fileNames.filter((name) => name.endsWith(".d.ts")));
  askedFiles.set(configPath, asked);
  if (isWhole || asked.size >= MOST_ASKED) for (const name of fileNames) asked.add(name);
  // a file the kept program reaches through an import needs no root of its own
  const isHeld = programs.get(configPath)?.getSourceFile(file) !== undefined;
  if (!isHeld && fileNames.includes(file)) asked.add(file);
  return [...asked];
};

/**
 * A configuration as read, once until a source changes.
 *
 * @param configPath - the `tsconfig.json`.
 */
const parsedConfig = (configPath: string): ts.ParsedCommandLine | undefined => {
  if (parsedConfigs.has(configPath)) return parsedConfigs.get(configPath);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  );
  parsedConfigs.set(configPath, parsed);
  return parsed;
};

/**
 * The program that holds a file: the one of the nearest `tsconfig.json` up its folders, or, when none holds it, the one
 * the files no configuration holds share (`FALLBACK_OPTIONS`, or the configuration's with JavaScript allowed).
 *
 * @param file - an absolute path to a source file.
 * @param isWhole - whether the reader needs every file of the configuration, not only what this one reaches.
 * @returns the program, or a message when the configuration above it cannot be read.
 */
export const programFor = (file: string, isWhole = false): DocsProgram | string => {
  const configPath = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) return looseProgram(file, FALLBACK_OPTIONS);
  const parsed = parsedConfig(configPath);
  if (parsed === undefined) return `${configPath} could not be read`;
  const program = keptProgram(
    configPath,
    rootsOf(configPath, parsed.fileNames, file, isWhole),
    parsed.options
  );
  if (program.getSourceFile(file) === undefined) return looseProgram(file, parsed.options);
  return { program, checker: program.getTypeChecker() };
};

/** The key mark of a program made for "Used in". */
const USAGE_KEY = "#usage";

/**
 * The program "Used in" reads a file with: every file of its configuration, with the dependencies' declarations and the
 * standard library left empty. What a story renders is a component of the project, found through its own imports, so
 * the checker never needs a dependency's types, and those are most of a program's memory: enough, in a large
 * monorepo, to stop the worker. Dropped once read (`dropUsagePrograms`).
 *
 * @param file - an absolute path to a story file.
 * @returns the program, or a message when the configuration above it cannot be read.
 */
export const usageProgramFor = (file: string): DocsProgram | string => {
  const configPath = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) return programFor(file, true);
  const parsed = parsedConfig(configPath);
  if (parsed === undefined) return `${configPath} could not be read`;
  const options = { ...parsed.options, noLib: true, types: [] };
  const program = keptProgram(`${configPath}${USAGE_KEY}`, parsed.fileNames, options, true);
  if (program.getSourceFile(file) === undefined) return programFor(file, true);
  return { program, checker: program.getTypeChecker() };
};

/**
 * Lets every program go, the files they parsed with them: "Used in" reads a whole configuration, and holding the docs'
 * programs beside it would add the two. A later read makes its program again, and the docs on disk answer meanwhile.
 */
export const dropPrograms = (): void => {
  programs.clear();
  parsedFiles.clear();
  outdated.clear();
};

/** Lets the programs "Used in" read go: a group's usage is read once, and they would hold the worker's memory. */
export const dropUsagePrograms = (): void => {
  for (const key of [...programs.keys()].filter((each) => each.endsWith(USAGE_KEY))) {
    programs.delete(key);
    parsedFiles.delete(key);
    outdated.delete(key);
  }
};

/** The files a package's manager rewrites when it installs: every type in `node_modules` hangs on one of them. */
const LOCK_FILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock"];

/**
 * The files of its package a program's answer about a file can depend on, besides what the file imports: the nearest
 * configuration, those it extends, the ambient declarations and the lock file.
 *
 * @param file - the file read.
 * @param program - its program.
 */
export const programDependencies = (file: string, program: ts.Program): string[] => {
  const folder = dirname(file);
  const configPath = ts.findConfigFile(folder, ts.sys.fileExists, "tsconfig.json");
  const configFile = program.getCompilerOptions()["configFile"];
  const extended =
    typeof configFile === "object" && configFile !== null && "extendedSourceFiles" in configFile
      ? (configFile.extendedSourceFiles ?? [])
      : [];
  return [
    ...(configPath === undefined ? [] : [configPath]),
    ...extended,
    ...program.getRootFileNames().filter((name) => name.endsWith(".d.ts")),
    ...LOCK_FILES.flatMap((name) => ts.findConfigFile(folder, ts.sys.fileExists, name) ?? [])
  ];
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
