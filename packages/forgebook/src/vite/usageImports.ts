/**
 * The edges of the import graph: what a module takes from the package's own modules, what a style sheet or a single-file
 * component names in its text.
 *
 * @remarks
 * An import counts for the file that declares each name it takes, not for the module it is written against: a barrel
 * lists every component, so following it would make a story of one component reach all of them, and a new component
 * would look verified for being exported. A name only an ambient declaration knows (a `.vue` shim) counts for the file its
 * last re-export names, and a name from a dependency for nothing. A barrel is followed only for a namespace import or a
 * side effect, and what it imports for its side effects (a global sheet) still runs when a name is taken through it. A
 * module's own `export … from` stays an edge, for those cases. A relative import that resolves to nothing is kept as an edge to where it points: the file may
 * have just been deleted, and the stories behind the edge are the ones that break. TypeScript does not resolve a style
 * sheet or a single-file component, so their names are read from the text; an Angular component's `templateUrl` and
 * `styleUrls` are found the same way.
 *
 * @module
 */
import ts from "typescript-6";

import { assetImports, sheetImports } from "./textImports.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A dynamic import of a path written out: a lazy component is drawn as any other. */
const DYNAMIC_IMPORT = /\bimport\(\s*["'`]([^"'`\n$]+)["'`]\s*\)/g;

/** A static import in the script of a single-file component, whose text no program holds. */
const STATIC_IMPORT = /^[ \t]*(?:import|export)\s+(?:[^"';]{0,2000}?\sfrom\s+)?["']([^"']+)["']/gm;

/** A file whose imports are read from its text. */
const SINGLE_FILE_COMPONENT = /\.(?:vue|svelte|astro)$/;

/** A style sheet. */
const STYLE_SHEET = /\.(?:css|scss|sass|less)$/;

/** What resolves a specifier. */
type Resolver = (specifier: string, containing: string) => string | undefined;

/** The file system as each resolution cache's resolutions read it, remembered for the cache's life. */
const HOSTS = new WeakMap<ts.ModuleResolutionCache, ts.ModuleResolutionHost>();

/**
 * The file system a resolution reads, with what it asked remembered as long as its cache lives: resolving every import
 * of a library asks again and again whether the same candidate files and folders exist, each time a call to the disk.
 *
 * @param cache - the resolution cache, made for one graph.
 */
const hostOf = (cache: ts.ModuleResolutionCache): ts.ModuleResolutionHost => {
  const known = HOSTS.get(cache);
  if (known !== undefined) return known;
  const remembered = <TValue>(read: (path: string) => TValue): ((path: string) => TValue) => {
    const answers = new Map<string, { readonly value: TValue }>();
    return (path: string): TValue => {
      const answer = answers.get(path) ?? { value: read(path) };
      answers.set(path, answer);
      return answer.value;
    };
  };
  const host: ts.ModuleResolutionHost = {
    fileExists: remembered((path: string) => ts.sys.fileExists(path)),
    readFile: remembered((path: string) => ts.sys.readFile(path)),
    directoryExists: remembered((path: string) => ts.sys.directoryExists(path)),
    realpath: remembered((path: string) => (ts.sys.realpath === undefined ? path : ts.sys.realpath(path))),
    getCurrentDirectory: (): string => ts.sys.getCurrentDirectory(),
    getDirectories: (path: string): string[] => ts.sys.getDirectories(path)
  };
  HOSTS.set(cache, host);
  return host;
};

/** Resolves a specifier as a program does, leaving out a dependency's files. */
const resolverOf = (program: ts.Program, cache: ts.ModuleResolutionCache): Resolver => {
  return (specifier: string, containing: string): string | undefined => {
    const resolved = ts.resolveModuleName(
      specifier,
      containing,
      program.getCompilerOptions(),
      hostOf(cache),
      cache
    ).resolvedModule;
    return resolved === undefined || resolved.isExternalLibraryImport ? undefined : resolved.resolvedFileName;
  };
};

/** Where a path alias of the program's configuration sends a name TypeScript cannot resolve: a sheet, a `.vue` file. */
const aliased = (specifier: string, options: ts.CompilerOptions): string | undefined => {
  const configFile = options["configFilePath"];
  const base =
    options.baseUrl ?? (typeof configFile === "string" ? VITE_PATHS.dirname(configFile) : undefined);
  if (base === undefined) return undefined;
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const [prefix = "", suffix] = pattern.split("*");
    const [target] = targets;
    if (target === undefined || suffix === undefined) continue;
    if (specifier.startsWith(prefix) && specifier.endsWith(suffix))
      return VITE_PATHS.resolve(
        base,
        target.split("*").join(specifier.slice(prefix.length, specifier.length - suffix.length))
      );
  }
  return undefined;
};

/** A specifier that resolves to nothing, as a path: where an alias sends it, or where a relative one points. */
const unresolvedTarget = (
  specifier: string,
  file: string,
  options: ts.CompilerOptions
): string | undefined => {
  const name = specifier.split("?")[0] ?? specifier;
  if (name.startsWith(".")) return VITE_PATHS.join(VITE_PATHS.dirname(file), name);
  return aliased(name, options);
};

/** The specifiers matched in a text, resolved; a relative one that resolves to nothing kept as where it points. */
const specifierTargets = (
  file: string,
  text: string,
  pattern: RegExp,
  program: ts.Program | undefined,
  cache: ts.ModuleResolutionCache | undefined
): string[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const specifier = match[1] ?? "";
    const resolved =
      program === undefined || cache === undefined ? undefined : resolverOf(program, cache)(specifier, file);
    if (resolved !== undefined) return [resolved];
    return [unresolvedTarget(specifier, file, program?.getCompilerOptions() ?? {}) ?? []].flat();
  });

/**
 * The edges of a file no program holds, read from its text; a file that cannot be read has none.
 *
 * @param file - the file, absolute.
 * @param program - a program whose rules resolve its imports.
 * @param cache - that program's resolution cache.
 */
export const textImportsOf = (
  file: string,
  program: ts.Program | undefined,
  cache: ts.ModuleResolutionCache | undefined
): string[] => {
  const text = ts.sys.readFile(file);
  if (text === undefined) return [];
  if (STYLE_SHEET.test(file)) return sheetImports(file, text);
  if (!SINGLE_FILE_COMPONENT.test(file)) return [];
  return [
    ...new Set([
      ...assetImports(file, text),
      ...specifierTargets(file, text, STATIC_IMPORT, program, cache),
      ...specifierTargets(file, text, DYNAMIC_IMPORT, program, cache)
    ])
  ];
};

/**
 * Whether an import or an export takes types only (`import type`, `export type`, `import { type A }`).
 *
 * @param statement - the statement.
 */
const isTypeOnly = (statement: ts.Statement): boolean => {
  if (ts.isExportDeclaration(statement)) return statement.isTypeOnly;
  if (!ts.isImportDeclaration(statement)) return false;
  const clause = statement.importClause;
  if (clause === undefined) return false;
  if (clause.isTypeOnly) return true;
  // `import { type A, type B }`: every name a type, and no default
  const bindings = clause.namedBindings;
  return (
    clause.name === undefined &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
};

/** The import or export statement a declaration of a name belongs to, with its module's name. */
const moduleOfDeclaration = (declaration: ts.Node | undefined): ts.StringLiteral | undefined => {
  let node = declaration;
  while (node !== undefined && !ts.isSourceFile(node)) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      return node.moduleSpecifier;
    node = node.parent;
  }
  return undefined;
};

/**
 * The file an ambiently declared name comes from: the module named by the last import or re-export on its way, which is
 * the only place that says which `.vue` file it is.
 *
 * @param name - the imported name.
 * @param checker - its program's checker.
 * @param options - its program's options.
 */
const ambientOrigin = (
  name: ts.Identifier,
  checker: ts.TypeChecker,
  options: ts.CompilerOptions
): string | undefined => {
  let symbol = checker.getSymbolAtLocation(name);
  let origin: string | undefined;
  while (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const literal = moduleOfDeclaration(symbol.declarations?.[0]);
    if (literal !== undefined)
      origin = unresolvedTarget(literal.text, literal.getSourceFile().fileName, options) ?? origin;
    symbol = checker.getImmediateAliasedSymbol(symbol);
  }
  return origin;
};

/**
 * Where an imported name comes from: the file that declares it, nothing for a dependency's, or none when it cannot be told.
 *
 * @param name - the imported name.
 * @param program - its program.
 */
const nameOrigin = (name: ts.Identifier, program: ts.Program): string | null | undefined => {
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(name);
  const target =
    symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  const declaring = target?.declarations?.[0]?.getSourceFile();
  if (declaring !== undefined && program.isSourceFileFromExternalLibrary(declaring)) return null;
  if (declaring !== undefined && !declaring.isDeclarationFile) return declaring.fileName;
  return ambientOrigin(name, checker, program.getCompilerOptions());
};

/**
 * The files that declare the names an import takes, or none when that cannot be told: a side effect, a namespace, a name
 * with no known origin.
 *
 * @param statement - the import.
 * @param program - its program.
 */
const declaringFiles = (statement: ts.Statement, program: ts.Program): readonly string[] | undefined => {
  if (!ts.isImportDeclaration(statement)) return undefined;
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  if (clause === undefined || (bindings !== undefined && ts.isNamespaceImport(bindings))) return undefined;
  const names = [
    ...(clause.name === undefined ? [] : [clause.name]),
    ...(bindings === undefined || !ts.isNamedImports(bindings)
      ? []
      : bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name))
  ];
  const found = names.map((name) => nameOrigin(name, program));
  return found.includes(undefined) ? undefined : found.flatMap((file) => file ?? []);
};

/** The module a statement names, when it is an import or a re-export that takes more than types. */
const moduleNamed = (statement: ts.Statement): string | undefined => {
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return undefined;
  const literal = statement.moduleSpecifier;
  // a type renders nothing: a file that only takes types from another does not use its components
  if (literal === undefined || !ts.isStringLiteral(literal) || isTypeOnly(statement)) return undefined;
  return literal.text;
};

/** What a program needs to follow a statement. */
type Reading = {
  /** The module. */
  readonly source: ts.SourceFile;
  /** Its program. */
  readonly program: ts.Program;
  /** The program's resolution cache. */
  readonly cache: ts.ModuleResolutionCache;
};

/**
 * What a module imports for its side effects alone: it runs whichever name is taken through it.
 *
 * @param file - the module, absolute.
 * @param reading - its program.
 */
const sideEffectTargets = (file: string, { program, cache }: Reading): readonly string[] => {
  const source = program.getSourceFile(file);
  if (source === undefined) return [];
  return source.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) && statement.importClause === undefined
      ? statementTargets(statement, { source, program, cache })
      : []
  );
};

/**
 * The files a statement of a module takes.
 *
 * @param statement - the statement.
 * @param reading - its module and program.
 */
const statementTargets = (statement: ts.Statement, reading: Reading): readonly string[] => {
  const { source, program, cache } = reading;
  const specifier = moduleNamed(statement);
  if (specifier === undefined) return [];
  const options = program.getCompilerOptions();
  const resolved = ts.resolveModuleName(
    specifier,
    source.fileName,
    options,
    hostOf(cache),
    cache
  ).resolvedModule;
  if (resolved === undefined) return [unresolvedTarget(specifier, source.fileName, options) ?? []].flat();
  if (resolved.isExternalLibraryImport) return [];
  const declaring = declaringFiles(statement, program);
  if (declaring === undefined) return [resolved.resolvedFileName];
  const through = declaring.includes(resolved.resolvedFileName)
    ? []
    : sideEffectTargets(resolved.resolvedFileName, reading);
  return [...declaring, ...through];
};

/**
 * The package's own modules a module imports or re-exports from, resolved as its program resolves them, with the assets
 * and lazy modules its text names.
 *
 * @param source - the module.
 * @param program - its program.
 * @param cache - the program's resolution cache.
 */
export const importsOf = (
  source: ts.SourceFile,
  program: ts.Program,
  cache: ts.ModuleResolutionCache
): string[] => [
  ...new Set([
    ...source.statements.flatMap((statement) => statementTargets(statement, { source, program, cache })),
    ...assetImports(source.fileName, source.text),
    ...specifierTargets(source.fileName, source.text, DYNAMIC_IMPORT, program, cache)
  ])
];
