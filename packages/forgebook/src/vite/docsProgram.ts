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
 * A program is the largest thing a dev server holds, so three things keep the programs small:
 * - a dev server's programs hold the files asked for and what they import (`readAskedFilesOnly`), with the files that
 *   hold for every file (declarations, augmentations), not every file of the configuration, until enough are asked
 *   that the whole is cheaper (`MOST_ASKED`);
 * - a build's programs hold its story files and what they import (`readStoryFilesOnly`), with the same files that hold
 *   for every file: a monorepo's root configuration lists every package, its website and its tools, and one story it
 *   holds would otherwise parse them all;
 * - parsed files are kept between programs and shared by every configuration that parses alike (`parsedFiles.ts`),
 *   the standard library's and `@types` without their documentation;
 * - only the programs read last are kept (`KEPT_PROGRAMS`), with the parses they hold.
 *
 * @module
 */
import { dirname } from "node:path";

import ts from "typescript-6";

import { checkFileChanges, keepParsesOf, keptParse, mayFilesChange } from "./parsedFiles.ts";

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
 * What the file system answered a build's programs' module resolution: in a monorepo every configuration's program
 * resolves the same thousands of imports, and asking the disk again for each one, in `stat`, `open` and `realpath`, is
 * most of a build's time. A dev server asks each time: an install, or a package's declarations built beside it, changes
 * what an import finds without a source file changing.
 */
const answered = {
  files: new Map<string, boolean>(),
  folders: new Map<string, boolean>(),
  realPaths: new Map<string, string>()
};

/**
 * An answer of the file system: asked once in a build, each time where files may change.
 *
 * @param kept - the answers kept.
 * @param path - the path asked about.
 * @param ask - asks the file system.
 */
const remembered = <TValue>(
  kept: Map<string, TValue>,
  path: string,
  ask: (path: string) => TValue
): TValue => {
  if (mayFilesChange()) return ask(path);
  const known = kept.get(path);
  if (known !== undefined) return known;
  const value = ask(path);
  kept.set(path, value);
  return value;
};

/**
 * A compiler host that parses through the kept parses (`parsedFiles.ts`), remembers the file system's answers, and
 * reads a framework's written sources as if they were on disk.
 *
 * @param options - the program's compiler options.
 * @param sources - the files read in place of a framework's components; none for a plain program.
 */
const keepingHost = (options: ts.CompilerOptions, sources: ProgramSources | undefined): ts.CompilerHost => {
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, directoryExists, realpath } = host;
  const parse = keptParse(options, host.getSourceFile);
  return {
    ...host,
    fileExists: (fileName: string): boolean =>
      sources?.textOf(fileName) !== undefined || remembered(answered.files, fileName, fileExists),
    readFile: (fileName: string): string | undefined => sources?.textOf(fileName) ?? readFile(fileName),
    ...(directoryExists === undefined
      ? {}
      : { directoryExists: (path: string): boolean => remembered(answered.folders, path, directoryExists) }),
    ...(realpath === undefined
      ? {}
      : { realpath: (path: string): string => remembered(answered.realPaths, path, realpath) }),
    getSourceFile: (
      fileName: string,
      languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions,
      onError?: (message: string) => void,
      shouldCreate?: boolean
    ): ts.SourceFile | undefined => {
      const text = sources?.textOf(fileName);
      return text === undefined
        ? parse(fileName, languageVersion, onError, shouldCreate)
        : ts.createSourceFile(fileName, text, languageVersion, true);
    }
  };
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
    outdated.delete(oldest);
  }
};

/** The files asked for, by program; none while every program holds all its configuration's files. */
let askedFiles: Map<string, Set<string>> | undefined;

/**
 * From now on a program holds what was asked for and what that imports, not its whole configuration: a dev server shows
 * one component at a time. A reader of everything asks for it (`programFor`'s `reach`).
 */
export const readAskedFilesOnly = (): void => {
  askedFiles ??= new Map();
  checkFileChanges();
};

/** A build's story files, in TypeScript's form; none until a build names them, and every file is read then. */
let storyFiles: Set<string> | undefined;

/** The files a build asked for that its story files do not reach, by program: they stay roots, or it would be rebuilt. */
const addedRoots = new Map<string, Set<string>>();

/**
 * From now on a program holds the given story files its configuration lists and what they import, not its whole
 * configuration: a build reads every story's docs and "Used in", which need nothing the stories do not reach. Each
 * program is then built once, its roots known from the start. Called again, it adds to the files.
 *
 * @param files - the story files, absolute.
 */
export const readStoryFilesOnly = (files: readonly string[]): void => {
  storyFiles ??= new Set();
  for (const file of files) storyFiles.add(file.replaceAll("\\", "/"));
};

/**
 * The files asked for before a program takes all its configuration's files: each new root makes a new type checker,
 * so a session that walks a whole library would pay more than the whole program costs at once.
 */
const MOST_ASKED = 16;

/**
 * What a program is read for: what the asked file reaches; what every story file of its configuration reaches (a
 * group's "Used in"), which is every file of it unless a build named its story files (`readStoryFilesOnly`); or every
 * file of its configuration (where an application draws a component).
 */
export type ProgramReach = "asked" | "stories" | "whole";

/** How a file's program is read. */
export type ProgramOptions = {
  /** The files read in place of a framework's components; none for a plain program. */
  readonly sources?: ProgramSources;
  /**
   * What the reader needs: what the file reaches (a component's docs, the default), what the stories reach (a group's
   * "Used in"), or every file of its configuration; a build's programs hold what its stories reach, or every file
   * when it named none.
   */
  readonly reach?: ProgramReach;
};

/** What declares types for files that do not import it: `declare global`, `declare module`. */
const AMBIENT_DECLARATION = /\bdeclare\s+(?:global\b|module\s)/;

/** The ambient files of each configuration read, found once: they are roots of every program, asked or not. */
const ambientFiles = new WeakMap<ReadConfiguration, readonly string[]>();

/**
 * A configuration's files that hold for every file without an import: its declarations, and the sources that augment a
 * module or the global scope (a theme's registry, a library's typed options), which nothing may import.
 *
 * @param read - the configuration.
 */
const ambientOf = (read: ReadConfiguration): readonly string[] => {
  const known = ambientFiles.get(read);
  if (known !== undefined) return known;
  const found = read.parsed.fileNames.filter(
    (name) => name.endsWith(".d.ts") || AMBIENT_DECLARATION.test(ts.sys.readFile(name) ?? "")
  );
  ambientFiles.set(read, found);
  return found;
};

/**
 * The root files of a build's program once it named its story files: the configuration's ambient files, the story files
 * it lists, and the files asked for that none of them reached, kept so the roots stay the same.
 *
 * @param key - the program's key.
 * @param read - its configuration.
 * @param stories - the build's story files.
 * @param asked - a file asked for that the program does not hold yet, which the configuration lists; none otherwise.
 */
const storyRootsOf = (
  key: string,
  read: ReadConfiguration,
  stories: ReadonlySet<string>,
  asked: string | undefined
): readonly string[] => {
  const added = addedRoots.get(key) ?? new Set<string>();
  addedRoots.set(key, added);
  if (asked !== undefined && !stories.has(asked)) added.add(asked);
  const listed = read.parsed.fileNames.filter((each) => stories.has(each));
  return [...new Set([...ambientOf(read), ...listed, ...added])];
};

/**
 * The root files of a configuration's program: all of them; or, once a build named its story files, its ambient files,
 * the story files it lists and a file asked for that none of them reaches; or, once only what is asked for is read, its
 * ambient files and the files asked for so far, until enough are asked that the whole is cheaper.
 *
 * @param key - the program's key.
 * @param read - its configuration.
 * @param file - the file asked for.
 * @param reach - what the reader needs.
 */
const rootsOf = (
  key: string,
  read: ReadConfiguration,
  file: string,
  reach: ProgramReach
): readonly string[] => {
  const { fileNames } = read.parsed;
  // a file the kept program reaches through an import needs no root of its own, while that program is current
  const name = file.replaceAll("\\", "/");
  const isHeld = !outdated.has(key) && programs.get(key)?.getSourceFile(name) !== undefined;
  const isOwnRoot = !isHeld && read.fileSet.has(name);
  if (askedFiles === undefined) {
    if (storyFiles === undefined || reach === "whole") return fileNames;
    return storyRootsOf(key, read, storyFiles, isOwnRoot ? name : undefined);
  }
  const asked = askedFiles.get(key) ?? new Set<string>();
  askedFiles.set(key, asked);
  // a program read whole stays whole: going back and forth would build it again each time
  if (reach !== "asked") for (const each of fileNames) asked.add(each);
  if (asked.size >= MOST_ASKED) return fileNames;
  if (isOwnRoot) asked.add(name);
  return [...new Set([...ambientOf(read), ...asked])];
};

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
  checkFileChanges();
  // a reader told of an edit from now on asks the disk each time: these answers may be out of date
  answered.files.clear();
  answered.folders.clear();
  answered.realPaths.clear();
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
  const roots = sources === undefined ? rootNames : [...rootNames, ...sources.roots];
  // a program asked for one more file is renewed: its roots grew
  const isSameRoots = oldProgram?.getRootFileNames().length === roots.length;
  if (oldProgram !== undefined && isSameRoots && !outdated.has(key)) {
    keepProgram(key, oldProgram);
    return oldProgram;
  }
  outdated.delete(key);
  const program = ts.createProgram({
    rootNames: roots,
    options,
    host: keepingHost(options, sources),
    ...(oldProgram === undefined ? {} : { oldProgram })
  });
  keepProgram(key, program);
  // the parses only the programs let go held go with them
  keepParsesOf(programs.values());
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
  // kept, its roots are read again as they were, so the program is reused
  const files =
    kept === undefined || outdated.has(key)
      ? ts.sys.readDirectory(folder, SOURCE_EXTENSIONS, NOT_SOURCES)
      : kept.getRootFileNames().filter((name) => !(sources?.roots ?? []).includes(name));
  // in TypeScript's form, as the folder's files are listed, so a listed file is not added twice
  const name = file.replaceAll("\\", "/");
  const program = keptProgram(key, files.includes(name) ? files : [...files, name], merged, sources);
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
 * The files a configuration was read from: itself and those it extends.
 *
 * @param configPath - the `tsconfig.json`.
 */
const configurationSources = (configPath: string): string[] => {
  const configFile = readConfiguration(configPath)?.parsed.options["configFile"];
  const extended =
    typeof configFile === "object" && configFile !== null && "extendedSourceFiles" in configFile
      ? (configFile.extendedSourceFiles ?? [])
      : [];
  return [configPath, ...extended];
};

/**
 * The files besides a source's own imports that what is read of it can change with: every configuration looked at to
 * find the one that holds it (up its folders, with the projects they reference) and those they extend, and the files
 * that hold for every file of that configuration (its declarations, its augmentations). Kept answers are checked
 * against them (`diskCache.ts`).
 *
 * @param file - an absolute path to a source file.
 */
export const configurationFiles = (file: string): string[] => {
  const name = file.replaceAll("\\", "/");
  const files: string[] = [];
  let folder = dirname(file);
  for (;;) {
    const configPath = ts.findConfigFile(folder, ts.sys.fileExists, "tsconfig.json");
    if (configPath === undefined) break;
    const candidates = withReferences(configPath);
    for (const candidate of candidates) files.push(...configurationSources(candidate));
    const holding = candidates.find((candidate) => readConfiguration(candidate)?.fileSet.has(name) === true);
    const read = holding === undefined ? undefined : readConfiguration(holding);
    if (read !== undefined) {
      files.push(...ambientOf(read));
      break;
    }
    const parent = dirname(dirname(configPath));
    if (parent === dirname(configPath)) break;
    folder = parent;
  }
  return [...new Set(files)];
};

/**
 * The compiler options a file is read with, as `programFor` finds its configuration, without making a program: its
 * imports resolve with them.
 *
 * @param file - an absolute path to a source file.
 */
export const compilerOptionsFor = (file: string): ts.CompilerOptions => {
  const holding = holdingConfiguration(file);
  const nearest = ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
  const configPath = holding ?? nearest;
  return (
    (configPath === undefined ? undefined : readConfiguration(configPath)?.parsed.options) ?? FALLBACK_OPTIONS
  );
};

/**
 * A configuration's program, renewed when it lacks a file the configuration lists: a story file added since the
 * program was made.
 *
 * @param configPath - the `tsconfig.json`.
 * @param read - the configuration, read.
 * @param file - the file the program is for.
 * @param sources - the files read in place of a framework's components; none for a plain program.
 * @param reach - what the reader needs: what the file reaches, or every file of the configuration.
 */
const configurationProgram = (
  configPath: string,
  read: ReadConfiguration,
  file: string,
  sources: ProgramSources | undefined,
  reach: ProgramReach
): DocsProgram => {
  const key = `${configPath}${sourcesKey(sources)}`;
  const roots = rootsOf(key, read, file, reach);
  const kept = programs.get(key);
  // a file the configuration lists that the program, with the same roots, does not hold was added since it was made
  const keptRoots = (kept?.getRootFileNames().length ?? 0) - (sources?.roots.length ?? 0);
  if (kept !== undefined && kept.getSourceFile(file) === undefined && roots.length === keptRoots)
    outdated.add(key);
  const options = { ...read.parsed.options, ...sources?.options };
  const program = keptProgram(key, roots, options, sources);
  return { program, checker: program.getTypeChecker() };
};

/**
 * The program that holds a file: the one of the first configuration up its folders (or a project it references) that
 * lists it; else the nearest one's, when the file reaches it through an import; else the one the files no
 * configuration holds share (`FALLBACK_OPTIONS`, or the nearest configuration's with JavaScript allowed).
 *
 * @param file - an absolute path to a source file, or to a file the sources write.
 * @param options - the sources a framework writes, and what the reader needs.
 * @returns the program, or a message when the configuration above it cannot be read.
 */
export const programFor = (
  file: string,
  { sources, reach = "asked" }: ProgramOptions = {}
): DocsProgram | string => {
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
    return configurationProgram(holding, holdingRead, file, sources, reach);
  const read = readConfiguration(nearest);
  if (read === undefined) return `${nearest} could not be read`;
  const options = { ...read.parsed.options, ...sources?.options };
  const key = `${nearest}${sourcesKey(sources)}`;
  const program = keptProgram(key, rootsOf(key, read, file, reach), options, sources);
  if (program.getSourceFile(file) === undefined) return looseProgram(file, read.parsed.options, sources);
  return { program, checker: program.getTypeChecker() };
};

/**
 * The configuration that holds a file, as `programFor` finds it; empty for a file none holds: what "Used in" groups a
 * library's story files by, to read one configuration at a time.
 *
 * @internal
 * @param file - an absolute path to a source file.
 */
export const configurationOf = (file: string): string => holdingConfiguration(file) ?? "";

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
