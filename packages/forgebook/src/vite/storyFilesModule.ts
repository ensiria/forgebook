/**
 * The module that answers a `?forgebook-files` import: every story file a pattern matches, as one module with each
 * file's index (read from its source, never run) and the loaders of its module, its component's docs and its code.
 *
 * @remarks
 * One module per pattern, instead of an import per file: in development the browser fetched every index module one by
 * one, a few hundred requests per frame (D-438). The keys are the files' paths relative to the declaring module
 * (`../src/x.stories.tsx`), the same keys `storyFileKeys` gives the tests that read the files from the disk.
 *
 * @module
 */
import { globSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import type { StoryFileIndex } from "@ensiria/story-format/source";

import { indexStoryFile } from "./indexStoryFile.ts";

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

/** An object literal of a key per file, each value written by `value`. */
const objectOf = (keys: readonly string[], value: (key: string) => string): string =>
  `{${keys.map((key) => `${JSON.stringify(key)}: ${value(key)}`).join(",\n")}}`;

/**
 * The code of the module for one pattern.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern before `?forgebook-files`.
 * @param watch - adds a file whose edit renews the module (each story file: its index is in the module).
 * @returns the module's code, or a message saying which file cannot be indexed.
 */
export const storyFilesModule = (root: string, pattern: string, watch: (file: string) => void): string => {
  const keys = storyFileKeys(root, [pattern]);
  const index: Record<string, StoryFileIndex> = {};
  for (const key of keys) {
    const file = resolve(root, key);
    watch(file);
    const entry = indexStoryFile(file, readFileSync(file, "utf8"));
    if (typeof entry === "string") throw new Error(entry);
    index[key] = entry;
  }
  // absolute paths: the module has no folder of its own; Vite serves them under /@fs/ in development
  const path = (key: string): string => JSON.stringify(resolve(root, key));
  const query = (key: string, name: string): string => JSON.stringify(`${resolve(root, key)}?${name}`);
  return [
    "export default {",
    `index: ${JSON.stringify(index)},`,
    `stories: ${objectOf(keys, (key) => `() => import(${path(key)})`)},`,
    `docs: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-docs")}).then((module) => module.default)`)},`,
    `code: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-code")}).then((module) => module.default)`)},`,
    `pages: ${objectOf(keys, (key) => `() => import(${query(key, "forgebook-page")}).then((module) => module.default)`)}`,
    "};"
  ].join("\n");
};
