/**
 * The paths a story file's docs can change with, so a kept answer (`diskCache.ts`) is reused only while they are
 * unchanged: what the story file reaches through its imports, type imports and `import()` types included, and the
 * folders those sit in (a file added there may be what an import now finds); the files its imports name that
 * TypeScript does not read (a `.svelte` or `.vue` component), read for their own imports too; the manifest of each
 * installed package it imports, and the lock file, which every installed type hangs on; and the configurations that
 * decided how it is read.
 *
 * @remarks
 * Run in the docs' worker, after the docs were read. The imports are found as TypeScript's own pre-pass finds them
 * (`preProcessFile`), so an import only a type uses still counts, and resolved with the options the file is read with
 * (`compilerOptionsFor`), without a program of their own. A package of the workspace, which an install links into
 * `node_modules`, is followed into its sources: its real path is outside `node_modules`. A group's story files share one
 * walk, so "Used in" reads each file once.
 *
 * @module
 */
import { dirname, isAbsolute, resolve } from "node:path";

import ts from "typescript-6";

import { compilerOptionsFor, configurationFiles } from "./docsProgram.ts";

/** The files a package manager rewrites when it installs. */
const LOCK_FILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];

/** Whether a path is inside a `node_modules` folder. */
const isInstalled = (path: string): boolean => path.replaceAll("\\", "/").includes("/node_modules/");

/** The text after `*` of a `paths` pattern that matches a specifier, or none. */
const matchedStar = (pattern: string, specifier: string): string | undefined => {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === specifier ? "" : undefined;
  const [before, after] = [pattern.slice(0, star), pattern.slice(star + 1)];
  return specifier.startsWith(before) &&
    specifier.endsWith(after) &&
    specifier.length >= before.length + after.length
    ? specifier.slice(before.length, specifier.length - after.length)
    : undefined;
};

/**
 * Where a specifier TypeScript could not resolve points through the configuration's `paths` (`@/Button.vue`), as the
 * first candidate that exists: a framework's component file, which TypeScript does not read.
 *
 * @param specifier - the import's specifier.
 * @param options - the compiler options.
 */
const mappedPath = (specifier: string, options: ts.CompilerOptions): string | undefined => {
  const base = options["pathsBasePath"];
  const folder = typeof base === "string" ? base : options.baseUrl;
  if (folder === undefined) return undefined;
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const star = matchedStar(pattern, specifier);
    if (star === undefined) continue;
    for (const target of targets) {
      const candidate = resolve(folder, target.replaceAll("*", star));
      if (ts.sys.fileExists(candidate)) return candidate;
    }
  }
  return undefined;
};

/** The manifest of the installed package a file belongs to. */
const manifestOf = (file: string): string | undefined =>
  ts.findConfigFile(dirname(file), ts.sys.fileExists, "package.json");

/** What one file adds to the walk. */
type Named = {
  /** Files to read for their own imports. */
  readonly followed: readonly string[];
  /** Paths kept as they are: a missing file, an installed package's manifest. */
  readonly named: readonly string[];
};

/**
 * Where an import points: what TypeScript resolves it to, else the path a relative import names, else where the
 * configuration's `paths` lead it; none for a package TypeScript cannot find.
 *
 * @param specifier - the import's specifier.
 * @param file - the importing file.
 * @param options - the compiler options it is read with.
 * @param cache - the module resolution cache of the walk.
 */
const importTarget = (
  specifier: string,
  file: string,
  options: ts.CompilerOptions,
  cache: ts.ModuleResolutionCache
): string | undefined => {
  const resolved = ts.resolveModuleName(specifier, file, options, ts.sys, cache).resolvedModule;
  if (resolved !== undefined) return resolved.resolvedFileName;
  return specifier.startsWith(".") ? resolve(dirname(file), specifier) : mappedPath(specifier, options);
};

/**
 * What one file names: its imports resolved outside `node_modules` (followed), its installed packages' manifests, the
 * files TypeScript does not read (followed for their own imports), the missing ones as paths, and the files its
 * `/// <reference path>` names.
 *
 * @param file - the file.
 * @param options - the compiler options it is read with.
 * @param cache - the module resolution cache of the walk.
 */
const namedBy = (file: string, options: ts.CompilerOptions, cache: ts.ModuleResolutionCache): Named => {
  const text = ts.sys.readFile(file);
  if (text === undefined) return { followed: [], named: [] };
  const { importedFiles, referencedFiles } = ts.preProcessFile(text, true, true);
  const targets = importedFiles.flatMap(({ fileName }) => importTarget(fileName, file, options, cache) ?? []);
  const installed = targets.filter(isInstalled);
  const own = targets.filter((target) => !isInstalled(target));
  const references = referencedFiles
    .map(({ fileName }) => (isAbsolute(fileName) ? fileName : resolve(dirname(file), fileName)))
    .filter((path) => !isInstalled(path));
  return {
    followed: [...own.filter((target) => ts.sys.fileExists(target)), ...references],
    named: [
      ...installed.flatMap((target) => manifestOf(target) ?? []),
      ...own.filter((target) => !ts.sys.fileExists(target))
    ]
  };
};

/**
 * Adds to `paths` what one story file reaches, with the folders the reached files sit in.
 *
 * @param storyFile - the story file.
 * @param walk - the walk's options, cache, files already read and paths found.
 */
const walkFrom = (
  storyFile: string,
  walk: {
    readonly options: ts.CompilerOptions;
    readonly cache: ts.ModuleResolutionCache;
    readonly reached: Set<string>;
    readonly paths: Set<string>;
  }
): void => {
  const queue = [storyFile];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (walk.reached.has(file)) continue;
    walk.reached.add(file);
    // in the system's form, so one path read through two spellings is stamped once
    walk.paths.add(resolve(file));
    walk.paths.add(resolve(dirname(file)));
    // a framework's component file is read for its imports too, as plain text
    const { followed, named } = namedBy(file, walk.options, walk.cache);
    queue.push(...followed);
    for (const path of named) walk.paths.add(resolve(path));
  }
};

/**
 * The paths a group of story files' docs can change with, read in one walk.
 *
 * @param storyFiles - the story files.
 */
export const docsDependencies = (storyFiles: readonly string[]): string[] => {
  const paths = new Set<string>();
  const reached = new Set<string>();
  const caches = new Map<ts.CompilerOptions, ts.ModuleResolutionCache>();
  for (const storyFile of storyFiles) {
    const options = compilerOptionsFor(storyFile);
    const cache =
      caches.get(options) ?? ts.createModuleResolutionCache(dirname(storyFile), (name) => name, options);
    caches.set(options, cache);
    walkFrom(storyFile, { options, cache, reached, paths });
    for (const path of configurationFiles(storyFile)) paths.add(path);
    const locks = LOCK_FILES.flatMap(
      (name) => ts.findConfigFile(dirname(storyFile), ts.sys.fileExists, name) ?? []
    );
    for (const lock of locks) paths.add(lock);
  }
  return [...paths];
};
