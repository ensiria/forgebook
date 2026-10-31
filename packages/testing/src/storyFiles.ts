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

import type { StoryFileIndex, StorySource } from "@forgebook/story-format/source";
import { sourceFiles } from "forgebook/source-files";
import { autoTitle, patternBase } from "forgebook/vite/auto-title";
import { indexStoryFile } from "forgebook/vite/index-story-file";
import { type StoryFilesGroup, storyFileKeys, storyFilesGroup } from "forgebook/vite/story-files-module";

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
 * The groups the patterns make, each read as the catalogue's plugin reads it (`storyFilesGroup`): one per pattern.
 *
 * @param options - where the files are.
 */
const groupsOf = (options: StoryFilesOptions): StoryFilesGroup[] =>
  options.patterns.map((pattern) => storyFilesGroup(options.root, pattern));

/**
 * The story files the patterns match, as the source's keys (the plugin's: relative to each pattern's folder once its
 * leading `../` moved into it, `./src/x.stories.tsx`), sorted.
 *
 * @param options - where the files are.
 */
export const storyFiles = (options: StoryFilesOptions): string[] =>
  [...new Set(groupsOf(options).flatMap((group) => storyFileKeys(group.root, [group.pattern])))].sort();

/**
 * A source with its index read from the disk and no loaders: enough for the story tree, the ids and the tests.
 *
 * @param options - where the files are.
 * @throws When a story file cannot be indexed.
 */
export const indexedSource = (options: StoryFilesOptions): StorySource => {
  const index: Record<string, StoryFileIndex> = {};
  // as the plugin does: each pattern is one group, and a file's title comes from the first group that matches it
  for (const group of groupsOf(options)) {
    for (const file of storyFileKeys(group.root, [group.pattern])) {
      if (index[file] !== undefined) continue;
      const title = autoTitle(patternBase(group.pattern), file);
      const text = readFileSync(join(group.root, file), "utf8");
      const entry = indexStoryFile(file, text, title === undefined ? {} : { autoTitle: title });
      if (typeof entry === "string") throw new Error(entry);
      index[file] = entry;
    }
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
