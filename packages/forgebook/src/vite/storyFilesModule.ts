/**
 * The module that answers a `?forgebook-files` import: every story file a pattern matches, as one module with each
 * file's index (read from its source, never run), the loaders of its module, its component's docs and its code, and
 * the group's "Used in" loader.
 *
 * @remarks
 * One module per pattern, instead of an import per file: in development the browser fetched every index module one by
 * one, a few hundred requests per frame. The keys are the files' paths relative to the declaring module
 * (`../src/x.stories.tsx`), the same keys `storyFileKeys` gives the tests that read the files from the disk.
 *
 * @module
 */
import { globSync, readFileSync } from "node:fs";

import type { StoryFileIndex } from "@forgebook/story-format/source";

import { autoTitle, patternBase } from "./autoTitle.ts";
import { indexStoryFile } from "./indexStoryFile.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A pattern of story files and the folder it is read from: the declaring module's folder, the import's pattern. */
export type StoryFilesGroup = {
  /** The declaring module's folder, absolute: the files' keys are relative to it. */
  readonly root: string;
  /** The pattern relative to it, its leading `./` dropped (`../src/**\/*.stories.tsx`). */
  readonly pattern: string;
};

/** Between a group's parts in a module's id: no path or pattern holds it. */
const GROUP_SEPARATOR = "::";

/**
 * A `?forgebook-files` group written for a module's id: the folder, how many folders the pattern climbs, and the rest
 * of the pattern. A Vite module's id is served under a URL path, whose normalisation would let a `..` remove the part
 * before it (`app::../storybook`: the folder and the separator), so the pattern's leading `../` are counted, never
 * written. The files keep their keys relative to the declaring module (`../src/x.stories.tsx`), unique in a source and
 * the testing package's too.
 *
 * @param folder - the declaring module's folder.
 * @param pattern - the pattern as the import writes it (`../src/**\/*.stories.tsx`).
 */
export const storyFilesGroupText = (folder: string, pattern: string): string => {
  const segments = pattern.split("/");
  const firstOwn = segments.findIndex((segment) => segment !== "." && segment !== "..");
  const climbed = firstOwn === -1 ? segments : segments.slice(0, firstOwn);
  const own = firstOwn === -1 ? [] : segments.slice(firstOwn);
  const up = climbed.filter((segment) => segment === "..").length;
  return [folder, String(up), own.join("/")].join(GROUP_SEPARATOR);
};

/**
 * A group read back from a module's id (`storyFilesGroupText`).
 *
 * @param text - the id's group part.
 */
export const storyFilesGroupOf = (text: string): StoryFilesGroup => {
  const [root = "", up = "0", own = ""] = text.split(GROUP_SEPARATOR);
  return { root, pattern: `${"../".repeat(Number(up))}${own}` };
};

/**
 * The story files patterns match, as paths relative to `root` starting with `./` or `../`, sorted.
 *
 * @param root - the folder the patterns are relative to: the declaring module's.
 * @param patterns - the patterns (`../src/**\/*.stories.tsx`).
 */
export const storyFileKeys = (root: string, patterns: readonly string[]): string[] =>
  patterns
    .flatMap((pattern) => globSync(pattern, { cwd: root }))
    // with forward slashes on every system, so a story file has the same key wherever the catalogue runs
    .map((file) => VITE_PATHS.relativeKey(root, file))
    .sort();

/**
 * The id prefix of a group's "Used in" module: the group follows (`storyFilesGroupText`), as in a `?forgebook-files`
 * module's id. The plugin answers it (`usageModule.ts`) only when a page asks.
 */
export const USAGE_PREFIX = "virtual:forgebook-usage:";

/** A story file a pattern matches, with its key and its index. */
export type IndexedStoryFile = {
  /** Its path relative to the declaring module (`../src/x.stories.tsx`). */
  readonly key: string;
  /** Its absolute path. */
  readonly file: string;
  /** Its index. */
  readonly index: StoryFileIndex;
};

/**
 * Every story file a pattern matches, indexed.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern.
 * @param watch - adds a file whose edit renews the module that read it.
 * @throws when a story file cannot be indexed.
 */
export const indexedStoryFiles = (
  root: string,
  pattern: string,
  watch: (file: string) => void
): IndexedStoryFile[] =>
  storyFileKeys(root, [pattern]).map((key) => {
    const file = VITE_PATHS.resolve(root, key);
    watch(file);
    const title = autoTitle(patternBase(pattern), key);
    const index = indexStoryFile(
      file,
      readFileSync(file, "utf8"),
      title === undefined ? {} : { autoTitle: title }
    );
    if (typeof index === "string") throw new Error(index);
    return { key, file, index };
  });

/** An object literal of a key per file, each value written by `value`. */
const objectOf = (keys: readonly string[], value: (key: string) => string): string =>
  `{${keys.map((key) => `${JSON.stringify(key)}: ${value(key)}`).join(",\n")}}`;

/**
 * The code of the module for one pattern.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern before `?forgebook-files`.
 * @param watch - adds a file whose edit renews the module (each story file: its index is in the module).
 * @param hasUsage - whether the group offers its "Used in" loader (the catalogue did not turn it off).
 * @returns the module's code, or a message saying which file cannot be indexed.
 */
export const storyFilesModule = (
  root: string,
  pattern: string,
  watch: (file: string) => void,
  hasUsage = true
): string => {
  const files = indexedStoryFiles(root, pattern, watch);
  const keys = files.map((file) => file.key);
  // the group's id in Vite's form, as the plugin names the declaring module's folder
  const folder = VITE_PATHS.normalize(root);
  const index: Record<string, StoryFileIndex> = Object.fromEntries(
    files.map((file) => [file.key, file.index])
  );
  const usage = JSON.stringify(`${USAGE_PREFIX}${storyFilesGroupText(folder, pattern)}`);
  // absolute paths in Vite's form: the module has no folder of its own, Vite serves them under /@fs/ in development,
  // and the queries' ids come back to the plugin as written here
  const absolute = (key: string): string => VITE_PATHS.resolve(folder, key);
  const path = (key: string): string => JSON.stringify(absolute(key));
  const query = (key: string, name: string): string => JSON.stringify(`${absolute(key)}?${name}`);
  return [
    "export default {",
    `index: ${JSON.stringify(index)},`,
    `stories: ${objectOf(keys, (key) => `() => import(${path(key)})`)},`,
    `docs: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-docs")}).then((module) => module.default)`)},`,
    `code: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-code")}).then((module) => module.default)`)},`,
    `pages: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-page")}).then((module) => module.default)`)}${hasUsage ? "," : ""}`,
    ...(hasUsage ? [`usage: () => import(${usage}).then((module) => module.default),`] : []),
    ...(hasUsage ? [`reach: () => import(${usage}).then((module) => module.reach)`] : []),
    "};"
  ].join("\n");
};
