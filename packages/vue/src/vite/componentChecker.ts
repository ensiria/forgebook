/**
 * The checkers `vue-component-meta` reads components with: one per TypeScript configuration, each a language service
 * that holds what TypeScript alone cannot read, single-file components. Kept between reads, and reloaded on the next
 * read after a source file changed.
 *
 * @remarks
 * A checker is made here rather than with the package's `createChecker`, because that one loads `typescript`, which a
 * project on TypeScript 7 answers with a package that has no compiler API. Its own part takes TypeScript as a parameter,
 * so it gets the same TypeScript 6 as the core (`forgebook/vite/docs-program`).
 *
 * A project made by `create-vue` has a `tsconfig.json` that only lists references, so the configuration that holds a
 * file is looked for through them. A file no configuration holds is added to the nearest checker, and a project with no
 * configuration is read with the options Vite's own defaults amount to.
 *
 * @module
 */
import { dirname } from "node:path";

import * as vueLanguage from "@vue/language-core";
import ts from "typescript-6";
import { createCheckerBase } from "vue-component-meta/lib/checker.js";

/** A checker. */
export type ComponentChecker = ReturnType<typeof createCheckerBase>;

/** A project's sources with no configuration. */
const LOOSE_CONFIG = {
  compilerOptions: {
    allowJs: true,
    jsx: "preserve",
    module: "esnext",
    moduleResolution: "bundler",
    target: "es2022",
    skipLibCheck: true,
    noEmit: true
  },
  include: ["**/*"],
  exclude: ["**/node_modules", "**/dist", "**/build"]
} as const;

/** The kept checkers, by their configuration file, or by their folder for one with none. */
const checkers = new Map<string, ComponentChecker>();

/** The checkers that may hold an edited file: reloaded on their next read. */
const outdated = new Set<string>();

/** Marks every checker as maybe holding an edited file. */
export const markCheckersChanged = (): void => {
  for (const key of checkers.keys()) outdated.add(key);
};

/**
 * A path as the checker writes it.
 *
 * @param path - an absolute path.
 */
const posixPath = (path: string): string => path.split("\\").join("/");

/** The folder a file's project sits in: its nearest `package.json`'s, or its own. */
const projectFolder = (file: string): string => {
  const manifest = ts.findConfigFile(dirname(file), ts.sys.fileExists, "package.json");
  return posixPath(dirname(manifest ?? file));
};

/**
 * The extensions a configuration's files also have, for TypeScript to list them.
 *
 * @param vueOptions - the configuration's Vue options.
 */
const extraExtensions = (vueOptions: vueLanguage.VueCompilerOptions): ts.FileExtensionInfo[] =>
  vueLanguage.getAllExtensions(vueOptions).map((extension) => ({
    extension: extension.slice(1),
    isMixedContent: true,
    scriptKind: ts.ScriptKind.Deferred
  }));

/**
 * What a configuration holds, in the shape a checker asks for.
 *
 * @param configPath - the configuration file.
 */
const configContents = (configPath: string): [vueLanguage.ParsedCommandLine, string[]] => {
  const commandLine = vueLanguage.createParsedCommandLine(ts, ts.sys, configPath);
  const { fileNames } = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, ts.sys.readFile),
    ts.sys,
    dirname(configPath),
    {},
    configPath,
    undefined,
    extraExtensions(commandLine.vueOptions)
  );
  return [commandLine, fileNames];
};

/**
 * What a project with no configuration holds, in the shape a checker asks for.
 *
 * @param folder - the project's folder.
 */
const looseContents = (folder: string): [vueLanguage.ParsedCommandLine, string[]] => {
  const commandLine = vueLanguage.createParsedCommandLineByJson(ts, ts.sys, folder, LOOSE_CONFIG);
  const { fileNames } = ts.parseJsonConfigFileContent(
    LOOSE_CONFIG,
    ts.sys,
    folder,
    {},
    undefined,
    undefined,
    extraExtensions(commandLine.vueOptions)
  );
  return [commandLine, fileNames];
};

/**
 * The configuration that holds a file: this one, or one it references.
 *
 * @param configPath - the configuration file.
 * @param file - the file, with the checker's slashes.
 * @param seen - the configurations already read, so references that loop end.
 * @returns the configuration, or none when neither holds the file.
 */
const holdingConfig = (configPath: string, file: string, seen: Set<string>): string | undefined => {
  if (seen.has(configPath) || !ts.sys.fileExists(configPath)) return undefined;
  seen.add(configPath);
  const [commandLine, fileNames] = configContents(configPath);
  if (fileNames.some((name) => posixPath(name) === file)) return configPath;
  for (const reference of commandLine.projectReferences ?? []) {
    const held = holdingConfig(posixPath(ts.resolveProjectReferencePath(reference)), file, seen);
    if (held !== undefined) return held;
  }
  return undefined;
};

/**
 * The kept checker of a key, made when there is none and reloaded when a source changed.
 *
 * @param key - the checker's key.
 * @param folder - its root folder.
 * @param contents - reads what it holds.
 */
const keptChecker = (
  key: string,
  folder: string,
  contents: () => [vueLanguage.ParsedCommandLine, string[]]
): ComponentChecker => {
  const kept = checkers.get(key);
  if (kept !== undefined) {
    if (outdated.delete(key)) kept.reload();
    return kept;
  }
  const checker = createCheckerBase(ts, contents, {}, folder);
  checkers.set(key, checker);
  return checker;
};

/**
 * The checker that holds a file: of the configuration that holds it, or of the nearest one, with the file added. The
 * checker holds what the file imports too, so a story file's checker reads its components.
 *
 * @param file - an absolute path to a source file.
 */
export const checkerFor = (file: string): ComponentChecker => {
  const path = posixPath(file);
  const nearest = ts.findConfigFile(dirname(path), ts.sys.fileExists, "tsconfig.json");
  if (nearest === undefined) {
    const folder = projectFolder(path);
    return keptChecker(folder, folder, () => looseContents(folder));
  }
  const configPath = posixPath(nearest);
  const holder = holdingConfig(configPath, path, new Set()) ?? configPath;
  const checker = keptChecker(holder, posixPath(dirname(holder)), () => configContents(holder));
  const text = ts.sys.readFile(path);
  if (text !== undefined && checker.getProgram()?.getSourceFile(path) === undefined) {
    checker.updateFile(path, text);
  }
  return checker;
};
