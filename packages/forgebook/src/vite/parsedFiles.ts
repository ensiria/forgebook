/**
 * The files the docs' TypeScript programs parse, kept between programs and shared by every configuration that parses
 * alike, as TypeScript's language service groups them.
 *
 * @remarks
 * A renewed program reuses a file only when its compiler host hands back the same object, so without a kept parse
 * every renewal parses everything again; and in a monorepo whose paths lead every package to every other's sources,
 * each package's program holds the same thousands of files. A kept parse is reused while the file is unchanged, told by
 * its change time and size (`stampOf`), which a write moves even when it keeps the modification time. A build, which
 * changes no file, skips that check until something says files may change (`checkFileChanges`).
 *
 * The standard library's declarations and `@types` packages are parsed without their documentation: most of what
 * `lib.dom.d.ts` and a framework's types weigh, which no component's docs read. Other declarations in `node_modules`
 * keep theirs, since a catalogue may document an installed library.
 *
 * @module
 */
import { statSync } from "node:fs";
import { dirname } from "node:path";

import ts from "typescript-6";

/** A parsed file, with the stamp of the file it was parsed from. */
type ParsedFile = { readonly stamp: string | undefined; readonly file: ts.SourceFile | undefined };

/** What tells which configurations parse a file alike, as TypeScript's language service groups them. */
const DOCUMENT_REGISTRY = ts.createDocumentRegistry();

/** The parsed files of each way of parsing, by file name and version. */
const parsedFiles = new Map<string, Map<string, ParsedFile>>();

/** Whether files may change while they are kept: a dev server's, or any reader told of an edit. */
let mayChange = false;

/** From now on a kept parse is checked against its file before it is reused. */
export const checkFileChanges = (): void => {
  mayChange = true;
};

/**
 * A file's stamp: its change time, in nanoseconds, and its size; none for a file that is not there.
 *
 * @param fileName - the file.
 */
const stampOf = (fileName: string): string | undefined => {
  const stats = statSync(fileName, { bigint: true, throwIfNoEntry: false });
  return stats === undefined ? undefined : `${stats.ctimeNs}:${stats.size}`;
};

/**
 * Whether a file's documentation is left out of its parse: the standard library's, or an `@types` package's.
 *
 * @param fileName - the file, as TypeScript names it (forward slashes).
 * @param libraryFolder - the standard library's folder, the same way.
 */
const isUndocumented = (fileName: string, libraryFolder: string): boolean =>
  dirname(fileName) === libraryFolder || fileName.includes("/node_modules/@types/");

/**
 * The function a compiler host parses files with, keeping what it parsed for the next program that parses alike.
 *
 * @param options - the program's compiler options.
 * @param parse - the host's own parse.
 */
export const keptParse = (
  options: ts.CompilerOptions,
  parse: ts.CompilerHost["getSourceFile"]
): ts.CompilerHost["getSourceFile"] => {
  const libraryFolder = dirname(ts.getDefaultLibFilePath(options)).replaceAll("\\", "/");
  const shared = DOCUMENT_REGISTRY.getKeyForCompilationSettings(options);
  const kept = parsedFiles.get(shared) ?? new Map<string, ParsedFile>();
  parsedFiles.set(shared, kept);
  return (
    fileName: string,
    languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreate?: boolean
  ): ts.SourceFile | undefined => {
    const stamp = mayChange ? stampOf(fileName) : undefined;
    const version = typeof languageVersion === "object" ? languageVersion : { languageVersion };
    const entry = `${fileName}|${version.languageVersion}|${version.impliedNodeFormat ?? ""}`;
    const known = kept.get(entry);
    if (known !== undefined && known.stamp === stamp && shouldCreate !== true) return known.file;
    const file = parse(
      fileName,
      isUndocumented(fileName, libraryFolder)
        ? { ...version, jsDocParsingMode: ts.JSDocParsingMode.ParseNone }
        : version,
      onError,
      shouldCreate
    );
    kept.set(entry, { stamp, file });
    return file;
  };
};

/**
 * Lets go every kept parse no program still holds: the limit on programs then bounds the parsed files too.
 *
 * @param programs - the programs kept.
 */
export const keepParsesOf = (programs: Iterable<ts.Program>): void => {
  const held = new Set<ts.SourceFile>();
  for (const program of programs) for (const file of program.getSourceFiles()) held.add(file);
  for (const [shared, kept] of parsedFiles) {
    for (const [entry, parsed] of kept)
      if (parsed.file === undefined || !held.has(parsed.file)) kept.delete(entry);
    if (kept.size === 0) parsedFiles.delete(shared);
  }
};
