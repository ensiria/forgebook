/**
 * A package's story files and their index, read from the disk: what a test runner that does not go through Vite
 * (Playwright) needs to declare one test per story.
 *
 * @remarks
 * A `StorySource` names its files with `?forgebook-files` imports, which only the catalogue's Vite plugin answers; this
 * reads the same files from the same patterns, with the plugin's static index. A package keeps the two lists equal with
 * `storyFilesMismatch`, run in Vitest, which goes through Vite.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StoryFileIndex, StorySource } from "@ensiria/story-format/source";

import { sourceFiles } from "../sourceFiles";
import { indexStoryFile } from "../vite/indexStoryFile";
import { storyFileKeys } from "../vite/storyFilesModule";

/** Where a package's story files are. */
export type StoryFilesOptions = {
  /** The source's id, as its `StorySource` gives it (story ids start with it). */
  readonly sourceId: string;
  /** The source's name. */
  readonly name: string;
  /** The folder the patterns are relative to: the folder of the module that declares the source. */
  readonly root: string;
  /** The same patterns as the source's `?forgebook-files` imports, relative to `root` (`../src/**\/*.stories.tsx`). */
  readonly patterns: readonly string[];
};

/**
 * The story files the patterns match, as the source's keys (`./x` or `../x`, relative to `root`), sorted.
 *
 * @param options - where the files are.
 */
export const storyFiles = (options: StoryFilesOptions): string[] =>
  storyFileKeys(options.root, options.patterns);

/**
 * A source with its index read from the disk and no loaders: enough for the story tree, the ids and the tests.
 *
 * @param options - where the files are.
 * @throws When a story file cannot be indexed.
 */
export const indexedSource = (options: StoryFilesOptions): StorySource => {
  const index: Record<string, StoryFileIndex> = {};
  for (const file of storyFiles(options)) {
    const entry = indexStoryFile(file, readFileSync(join(options.root, file), "utf8"));
    if (typeof entry === "string") throw new Error(entry);
    index[file] = entry;
  }
  return {
    id: options.sourceId,
    name: options.name,
    files: [{ index, stories: {}, docs: {}, code: {}, pages: {} }],
    sheets: { required: [], theme: [], restyled: [] }
  };
};

/**
 * Whether the patterns match exactly the files of the source's `?forgebook-files` imports.
 *
 * @param options - the patterns.
 * @param source - the source, loaded through Vite (in Vitest).
 * @returns the files only one side lists; empty when they match.
 */
export const storyFilesMismatch = (options: StoryFilesOptions, source: StorySource): string[] => {
  const fromPatterns = new Set(storyFiles(options));
  const fromSource = new Set(Object.keys(sourceFiles(source).stories));
  return [
    ...[...fromPatterns]
      .filter((file) => !fromSource.has(file))
      .map((file) => `only in the patterns: ${file}`),
    ...[...fromSource].filter((file) => !fromPatterns.has(file)).map((file) => `only in the source: ${file}`)
  ];
};
