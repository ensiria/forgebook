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
import { join, relative, resolve } from "node:path";

import type { StoryFileIndex } from "@forgebook/story-format/source";

import { autoTitle, patternBase } from "./autoTitle.ts";
import { indexStoryFile } from "./indexStoryFile.ts";

/** A pattern of story files and the folder it is read from. */
export type StoryFilesGroup = {
  /** The folder, absolute. */
  readonly root: string;
  /** The pattern, relative to it, without a leading `./` or `../`. */
  readonly pattern: string;
};

/**
 * The folder and the pattern a `?forgebook-files` import is read from: the pattern's leading `./` and `../` move into
 * the folder. The catalogue's plugin keys the files this way (its modules' ids hold no `..`, which a URL path would
 * collapse), and so does the testing package, so both list the same keys (`./src/x.stories.tsx`).
 *
 * @param folder - the importing module's folder.
 * @param pattern - the pattern as the import writes it (`../src/**\/*.stories.tsx`).
 */
export const storyFilesGroup = (folder: string, pattern: string): StoryFilesGroup => {
  const segments = pattern.split("/");
  const firstOwn = segments.findIndex((segment) => segment !== "." && segment !== "..");
  const climbed = firstOwn === -1 ? segments : segments.slice(0, firstOwn);
  const own = firstOwn === -1 ? [] : segments.slice(firstOwn);
  return { root: resolve(folder, ...climbed), pattern: own.join("/") };
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
    .map((file) => {
      const path = relative(root, join(root, file)).split("\\").join("/");
      return path.startsWith(".") ? path : `./${path}`;
    })
    .sort();

/**
 * The id prefix of a group's "Used in" module: the pattern's folder and the pattern follow, as in a `?forgebook-files`
 * module's id. The plugin answers it (`usageModule.ts`) only when a page asks.
 */
export const USAGE_PREFIX = "virtual:forgebook-usage:";

/** Between the folder and the pattern in a usage module's id: no path or pattern holds it. */
export const USAGE_SEPARATOR = "::";

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
    const file = resolve(root, key);
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
  const index: Record<string, StoryFileIndex> = Object.fromEntries(
    files.map((file) => [file.key, file.index])
  );
  const usage = JSON.stringify(`${USAGE_PREFIX}${root}${USAGE_SEPARATOR}${pattern}`);
  // absolute paths: the module has no folder of its own; Vite serves them under /@fs/ in development
  const path = (key: string): string => JSON.stringify(resolve(root, key));
  const query = (key: string, name: string): string => JSON.stringify(`${resolve(root, key)}?${name}`);
  return [
    "export default {",
    `index: ${JSON.stringify(index)},`,
    `stories: ${objectOf(keys, (key) => `() => import(${path(key)})`)},`,
    `docs: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-docs")}).then((module) => module.default)`)},`,
    `code: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-code")}).then((module) => module.default)`)},`,
    `pages: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-page")}).then((module) => module.default)`)}${hasUsage ? "," : ""}`,
    ...(hasUsage ? [`usage: () => import(${usage}).then((module) => module.default)`] : []),
    "};"
  ].join("\n");
};
