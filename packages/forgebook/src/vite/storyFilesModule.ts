/**
 * The module that answers a group of story files: a `?forgebook-files` import's pattern, or a catalogue's `stories`
 * list (`FILES_SPECIFIER_PREFIX`). Every story file the group lists, as one module with each file's index (read from
 * its source, never run), the loaders of its module, its component's docs and its code, and the group's "Used in"
 * loader.
 *
 * @remarks
 * One module per group, instead of an import per file: in development the browser fetched every index module one by
 * one, a few hundred requests per frame. A catalogue's `stories` are one group, not one per pattern: its `!` patterns
 * leave files out of what all the others list, a file two patterns list is listed once, and "Used in" joins stories
 * across every pattern. The keys are the files' paths relative to the declaring module
 * (`../src/x.stories.tsx`), the same keys `storyFileKeys` gives the tests that read the files from the disk. A build
 * takes each file's docs, code and page from the group's texts module, written as data, instead of their loaders'
 * imports (`builtTexts.ts`).
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { StoryFileIndex } from "@forgebook/story-format/source";

import { codeLiteral } from "../codeLiteral.ts";
import { autoTitle, patternBase } from "./autoTitle.ts";
import { type DiskCache, isSettledSince, nowNs, stampPaths } from "./diskCache.ts";
import { indexStoryFile } from "./indexStoryFile.ts";
import { isNegated, listedFiles } from "./storyPatterns.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/**
 * A group of story files and the folder its patterns are read from: the declaring module's folder, the import's
 * patterns.
 */
export type StoryFilesGroup = {
  /** The declaring module's folder, absolute: the files' keys are relative to it. */
  readonly root: string;
  /**
   * The patterns relative to it, their leading `./` dropped (`../src/**\/*.stories.tsx`), and the `!` ones that leave
   * files out (`listedFiles`).
   */
  readonly patterns: readonly string[];
};

/** Between a group's parts in a module's id: no path or pattern holds it. */
export const GROUP_SEPARATOR = "::";

/** Before a pattern's count of climbed folders in a module's id, when it is a `!` pattern. */
const NEGATED_MARK = "!";

/**
 * One pattern written for a module's id: whether it leaves files out and how many folders it climbs, then the rest of
 * it. The mark goes with the count, never with the rest, which may start with an extglob's `!(…)`.
 *
 * @param pattern - the pattern as the import writes it (`../src/**\/*.stories.tsx`).
 */
const patternParts = (pattern: string): readonly [up: string, own: string] => {
  const isLeftOut = isNegated(pattern);
  const segments = (isLeftOut ? pattern.slice(1) : pattern).split("/");
  const firstOwn = segments.findIndex((segment) => segment !== "." && segment !== "..");
  const climbed = firstOwn === -1 ? segments : segments.slice(0, firstOwn);
  const own = firstOwn === -1 ? [] : segments.slice(firstOwn);
  const up = climbed.filter((segment) => segment === "..").length;
  return [`${isLeftOut ? NEGATED_MARK : ""}${up}`, own.join("/")];
};

/**
 * A group of story files written for a module's id: the folder, then for each pattern how many folders it climbs and
 * the rest of it. A Vite module's id is served under a URL path, whose normalisation would let a `..` remove the part
 * before it (`app::../storybook`: the folder and the separator), so a pattern's leading `../` are counted, never
 * written. The files keep their keys relative to the declaring module (`../src/x.stories.tsx`), unique in a source and
 * the testing package's too.
 *
 * @param folder - the declaring module's folder.
 * @param patterns - the patterns as the import or the configuration writes them (`../src/**\/*.stories.tsx`).
 */
export const storyFilesGroupText = (folder: string, patterns: readonly string[]): string =>
  [folder, ...patterns.flatMap(patternParts)].join(GROUP_SEPARATOR);

/**
 * A group read back from a module's id (`storyFilesGroupText`).
 *
 * @param text - the id's group part.
 */
export const storyFilesGroupOf = (text: string): StoryFilesGroup => {
  const [root = "", ...parts] = text.split(GROUP_SEPARATOR);
  const patterns: string[] = [];
  for (let at = 0; at < parts.length; at += 2) {
    const count = parts[at] ?? "0";
    const isLeftOut = count.startsWith(NEGATED_MARK);
    const up = Number(isLeftOut ? count.slice(NEGATED_MARK.length) : count);
    patterns.push(`${isLeftOut ? "!" : ""}${"../".repeat(up)}${parts[at + 1] ?? ""}`);
  }
  return { root, patterns };
};

/**
 * Whether a file a group lists may be read. A dev server refuses what `server.fs.deny` names (`fileAccess.ts`).
 *
 * @param file - the file, absolute in Vite's form.
 */
export type IsFileKept = (file: string) => boolean;

/** Every file a group lists: a build's, and a test's that reads the files from the disk. */
export const EVERY_FILE: IsFileKept = (): boolean => true;

/**
 * The story files patterns list, as paths relative to `root` starting with `./` or `../`, each once, sorted: the union
 * of the patterns less what the `!` ones match (`listedFiles`).
 *
 * @param root - the folder the patterns are relative to: the declaring module's.
 * @param patterns - the patterns (`../src/**\/*.stories.tsx`, `!../src/**\/legacy/*`).
 * @param isKept - whether a listed file may be read; every one by default.
 * @throws when every pattern is a `!` one.
 */
export const storyFileKeys = (
  root: string,
  patterns: readonly string[],
  isKept: IsFileKept = EVERY_FILE
): string[] =>
  listedFiles(root, patterns)
    .map((file) => file.key)
    .filter((key) => isKept(VITE_PATHS.resolve(root, key)));

/**
 * The specifier prefix of a group of story files named by its patterns, the group following (`storyFilesGroupText`):
 * how the module generated for a catalogue's `stories` imports them as one group, `!` patterns included, which a
 * `?forgebook-files` import of one pattern cannot say.
 */
export const FILES_SPECIFIER_PREFIX = "virtual:forgebook-files:";

/** The specifier prefix of a group of docs pages named by its patterns, the same way: a catalogue's `docs`. */
export const DOCS_PAGES_SPECIFIER_PREFIX = "virtual:forgebook-docs-pages:";

/**
 * The id prefix of a group's "Used in" module: the group follows (`storyFilesGroupText`), as in a `?forgebook-files`
 * module's id. The plugin answers it (`usageModule.ts`) only when a page asks.
 */
export const USAGE_PREFIX = "virtual:forgebook-usage:";

/**
 * The id prefix of a group's search index: the group follows (`storyFilesGroupText`). The plugin answers it
 * (`searchModule.ts`) only when a page asks, on the first search.
 */
export const SEARCH_PREFIX = "virtual:forgebook-search:";

/** The id prefix of a docs pages' search index, the same way: the plugin answers it only on the first search. */
export const PAGES_SEARCH_PREFIX = "virtual:forgebook-search-pages:";

/**
 * The id prefix of a group's texts module, the same way: a build's, imported by the group's module, which holds each
 * file's docs, code and page as data (`builtTexts.ts`).
 */
export const TEXTS_PREFIX = "virtual:forgebook-texts:";

/**
 * The id prefix of a group's reach module, what each story reaches, the same way: only the dev server's tools ask for
 * it, so a page that shows "Used in" never downloads it.
 */
export const REACH_PREFIX = "virtual:forgebook-reach:";

/** A story file a group lists, with its key, the pattern that lists it and its index. */
export type IndexedStoryFile = {
  /** Its path relative to the declaring module (`../src/x.stories.tsx`). */
  readonly key: string;
  /** The group's first pattern that lists it, whose static start begins its title when its meta writes none. */
  readonly pattern: string;
  /** Its absolute path. */
  readonly file: string;
  /** Its index. */
  readonly index: StoryFileIndex;
};

/** A story file a group lists whose index cannot be read: the others still draw. */
export type RefusedStoryFile = {
  /** Its path relative to the declaring module. */
  readonly key: string;
  /** The group's first pattern that lists it. */
  readonly pattern: string;
  /** Its absolute path. */
  readonly file: string;
  /** Why, naming the file (with its line and column when they are known). */
  readonly problem: string;
};

/** A group's story files read: those indexed, and those that cannot be. */
export type StoryFilesRead = {
  /** The story files indexed. */
  readonly files: readonly IndexedStoryFile[];
  /** The story files that cannot be. */
  readonly refused: readonly RefusedStoryFile[];
};

/** A group's index as it is kept between starts, by file key. */
export type KeptIndex = Readonly<Record<string, StoryFileIndex>>;

/** Whether what a cache file holds is a group's index. */
export const isKeptIndex = (value: unknown): value is KeptIndex =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * One story file a pattern lists, indexed from its text on disk, with the title its path makes when it writes none.
 *
 * @internal
 * @param root - the declaring module's folder.
 * @param pattern - the pattern that lists it.
 * @param key - the file's path relative to the declaring module.
 * @returns the index, or a message saying why the file cannot be indexed.
 */
export const storyFileIndex = (root: string, pattern: string, key: string): StoryFileIndex | string => {
  const file = VITE_PATHS.resolve(root, key);
  const title = autoTitle(patternBase(pattern), key);
  return indexStoryFile(file, readFileSync(file, "utf8"), title === undefined ? {} : { autoTitle: title });
};

/**
 * Every story file a group's patterns list, indexed, and those that cannot be. Only the former are kept between starts:
 * the stamps of the others would only say what is already known, and their next read costs one file.
 *
 * @param root - the declaring module's folder.
 * @param patterns - the patterns (`storyFileKeys`).
 * @param watch - adds a file whose edit renews the module that read it: a refused one too, as its fix must.
 * @param cache - the index kept between starts, which holds while the files it came from do; none reads them all.
 * @param isKept - whether a listed file may be read; every one by default.
 */
export const readStoryFiles = (
  root: string,
  patterns: readonly string[],
  watch: (file: string) => void,
  cache?: DiskCache<KeptIndex>,
  isKept: IsFileKept = EVERY_FILE
): StoryFilesRead => {
  const name = storyFilesGroupText(VITE_PATHS.normalize(root), patterns);
  const since = nowNs();
  const kept = cache?.read(name);
  const listed = listedFiles(root, patterns).filter(({ key }) => isKept(VITE_PATHS.resolve(root, key)));
  const files: IndexedStoryFile[] = [];
  const refused: RefusedStoryFile[] = [];
  for (const { key, pattern } of listed) {
    const file = VITE_PATHS.resolve(root, key);
    watch(file);
    const index = kept?.[key] ?? storyFileIndex(root, pattern, key);
    if (typeof index === "string") refused.push({ key, pattern, file, problem: index });
    else files.push({ key, pattern, file, index });
  }
  // kept again when anything was read anew: a file added, or the kept index out of date
  if (cache !== undefined && files.some(({ key }) => kept?.[key] === undefined)) {
    const stamps = stampPaths(files.map((each) => each.file));
    const index = Object.fromEntries(files.map((each) => [each.key, each.index]));
    if (isSettledSince(stamps, since)) cache.write(name, index, stamps);
  }
  return { files, refused };
};

/**
 * What fails a module that cannot go on without its files: every file refused, a line each.
 *
 * @param refused - the files, at least one.
 */
export const refusalError = (refused: readonly RefusedStoryFile[]): Error =>
  new Error(refused.map(({ problem }) => problem).join("\n"));

/**
 * Every story file a group's patterns list, indexed, for those who cannot go on without one: a build, a test.
 *
 * @param root - the declaring module's folder.
 * @param patterns - the patterns (`storyFileKeys`).
 * @param watch - adds a file whose edit renews the module that read it.
 * @param cache - the index kept between starts, which holds while the files it came from do; none reads them all.
 * @param isKept - whether a listed file may be read; every one by default.
 * @throws when a story file cannot be indexed, naming every one that cannot.
 */
export const indexedStoryFiles = (
  root: string,
  patterns: readonly string[],
  watch: (file: string) => void,
  cache?: DiskCache<KeptIndex>,
  isKept: IsFileKept = EVERY_FILE
): IndexedStoryFile[] => {
  const { files, refused } = readStoryFiles(root, patterns, watch, cache, isKept);
  if (refused.length > 0) throw refusalError(refused);
  return [...files];
};

/** The loaders a group offers besides its story files'. */
export type GroupLoaders = {
  /** Whether it offers each story file's component docs (the catalogue reads them); `true` by default. */
  readonly hasDocs?: boolean;
  /** Whether it offers its "Used in" (the catalogue did not turn it off). */
  readonly hasUsage: boolean;
  /** Whether it offers what each story reaches: only on a dev server, for its tools. */
  readonly hasReach: boolean;
};

/**
 * The code of the module for one group.
 *
 * @param root - the declaring module's folder.
 * @param patterns - the group's patterns.
 * @param watch - adds a file whose edit renews the module (each story file: its index is in the module).
 * @param loaders - the group's loaders besides its story files'; all of them by default.
 * @param cache - the index kept between starts.
 * @returns the module's code, or a message saying which file cannot be indexed.
 */
export const storyFilesModule = (
  root: string,
  patterns: readonly string[],
  watch: (file: string) => void,
  loaders: GroupLoaders = { hasUsage: true, hasReach: true },
  cache?: DiskCache<KeptIndex>
): string => storyFilesCode(root, patterns, indexedStoryFiles(root, patterns, watch, cache), loaders);

/** The function the generated module rebuilds each file's stories with, from their rows. */
const STORY_TABLE = "storyTable";

/**
 * The keys of a group's stories, each once, in the order the first story to have each writes it.
 *
 * @param files - the group's story files, indexed.
 */
const storyKeysOf = (files: readonly IndexedStoryFile[]): readonly string[] => [
  ...new Set(
    files.flatMap(({ index }) =>
      index.stories.flatMap((story) =>
        Object.keys(story).filter((key) => Reflect.get(story, key) !== undefined)
      )
    )
  )
];

/**
 * A story file's index as code: its stories as rows of values in the group's key order, which the module turns back
 * into the same objects (`STORY_TABLE`).
 *
 * @remarks
 * A catalogue's first load fetches every group's index, and an object per story writes its keys again for every
 * story: on a library of 500 stories, a quarter of the index was the words `exportName` and `description`. A row
 * writes each value once and leaves a key a story does not have as a hole, which the module leaves out of its object
 * as the literal did.
 *
 * @param index - the file's index.
 * @param keys - the group's keys (`storyKeysOf`).
 */
const indexCode = (index: StoryFileIndex, keys: readonly string[]): string => {
  const rows = index.stories.map((story) => {
    const values = keys.map((key) => {
      const value: unknown = Reflect.get(story, key);
      return value === undefined ? "" : codeLiteral(value);
    });
    // a story's last keys it does not have are left out: a row ends with its last value, never with a hole
    while (values.at(-1) === "") values.pop();
    return `[${values.join(",")}]`;
  });
  const fields = Object.entries(index)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      key === "stories"
        ? `${codeLiteral(key)}:${STORY_TABLE}([${rows.join(",")}])`
        : `${codeLiteral(key)}:${codeLiteral(value)}`
    );
  return `{${fields.join(",")}}`;
};

/**
 * The code of the module for one group, from its story files indexed.
 *
 * @internal
 * @param root - the declaring module's folder.
 * @param patterns - the group's patterns.
 * @param files - the story files it lists, indexed.
 * @param loaders - the group's loaders besides its story files'.
 * @param hasTexts - a build's: whether each file's docs, code and page come from the group's texts module, in the
 * rows' order (`TEXTS_PREFIX`), and not each from its query.
 * @param refused - the story files it lists that cannot be indexed, which the catalogue names among its problems.
 * @param scriptProblems - the project's other scripts that do not parse, named among them too.
 */
export const storyFilesCode = (
  root: string,
  patterns: readonly string[],
  files: readonly IndexedStoryFile[],
  loaders: GroupLoaders,
  hasTexts = false,
  refused: readonly RefusedStoryFile[] = [],
  scriptProblems: readonly string[] = []
): string => {
  const { hasDocs = true, hasUsage, hasReach } = loaders;
  // the group's id in Vite's form, as the plugin names the declaring module's folder
  const folder = VITE_PATHS.normalize(root);
  const usage = codeLiteral(`${USAGE_PREFIX}${storyFilesGroupText(folder, patterns)}`);
  const search = codeLiteral(`${SEARCH_PREFIX}${storyFilesGroupText(folder, patterns)}`);
  const reach = codeLiteral(`${REACH_PREFIX}${storyFilesGroupText(folder, patterns)}`);
  const texts = codeLiteral(`${TEXTS_PREFIX}${storyFilesGroupText(folder, patterns)}`);
  // absolute paths in Vite's form: the module has no folder of its own, Vite serves them under /@fs/ in development,
  // and the queries' ids come back to the plugin as written here
  const absolute = (key: string): string => VITE_PATHS.resolve(folder, key);
  const path = (key: string): string => codeLiteral(absolute(key));
  const query = (key: string, name: string): string =>
    `() => import(${codeLiteral(`${absolute(key)}?${name}`)}).then((module) => module.default)`;
  const textLoaders = (key: string): readonly string[] =>
    hasTexts
      ? []
      : // the docs' place is kept without them, so every row's columns stay where the module reads them
        [
          hasDocs ? query(key, "forgebook-docs") : "null",
          query(key, "forgebook-code"),
          query(key, "forgebook-page")
        ];
  // a row per file, its name written once and not once per column (its index, each loader): a large catalogue's
  // names are a tenth of its index
  const keys = storyKeysOf(files);
  const rows = files.map(({ key, index }) =>
    [codeLiteral(key), indexCode(index, keys), `() => import(${path(key)})`, ...textLoaders(key)].join(", ")
  );
  const written = `[${rows.map((row) => `[${row}]`).join(",\n")}]`;
  return [
    ...(hasTexts ? [`import texts from ${texts};`] : []),
    `const storyKeys = ${codeLiteral(keys)};`,
    `const ${STORY_TABLE} = (rows) => rows.map((row) => {`,
    "  const story = {};",
    "  row.forEach((value, at) => {",
    "    story[storyKeys[at]] = value;",
    "  });",
    "  return story;",
    "});",
    // a build's texts are their module's rows, in the same order: each joins its file's
    `const rows = ${hasTexts ? `${written}.map((row, at) => row.concat(texts[at]))` : written};`,
    "const column = (at) => Object.fromEntries(rows.map((row) => [row[0], row[at]]));",
    "export default {",
    "index: column(1),",
    "stories: column(2),",
    hasDocs ? "docs: column(3)," : "docs: {},",
    "code: column(4),",
    "pages: column(5),",
    ...(refused.length === 0 && scriptProblems.length === 0
      ? []
      : [`problems: ${codeLiteral([...refused.map(({ problem }) => problem), ...scriptProblems])},`]),
    `search: () => import(${search}).then((module) => module.default),`,
    ...(hasUsage ? [`usage: () => import(${usage}).then((module) => module.default),`] : []),
    ...(hasReach ? [`reach: () => import(${reach}).then((module) => module.default),`] : []),
    "};"
  ].join("\n");
};
