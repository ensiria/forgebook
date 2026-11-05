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
import type { StorySource } from "@forgebook/story-format/source";
import { sourceFiles } from "forgebook/source-files";
import { indexedStoryFiles, storyFileKeys } from "forgebook/vite/story-files-module";

/** Where a package's story files are. */
export type StoryFilesOptions = {
  /** The source's id, as its `StorySource` gives it (story ids start with it). */
  readonly sourceId: string;
  /** The source's name. */
  readonly name: string;
  /** The folder the patterns are relative to: the folder of the module that declares the source. */
  readonly root: string;
  /**
   * The same patterns as the source's `?forgebook-files` imports, relative to `root` (`../src/**\/*.stories.tsx`), or
   * the catalogue's `stories`: a `!` pattern leaves out what it matches from what the others list.
   */
  readonly patterns: readonly string[];
};

/**
 * The story files the patterns list, as the source's keys (`./x` or `../x`, relative to `root`), each once, sorted.
 *
 * @param options - where the files are.
 * @throws When every pattern is a `!` one: they leave files out, and nothing lists any.
 */
export const storyFiles = (options: StoryFilesOptions): string[] =>
  storyFileKeys(options.root, options.patterns);

/**
 * A source with its index read from the disk and no loaders: enough for the story tree, the ids and the tests.
 *
 * @param options - where the files are.
 * @throws When a story file cannot be indexed, or every pattern is a `!` one.
 */
export const indexedSource = (options: StoryFilesOptions): StorySource => {
  // indexed as the plugin indexes them: a file's title from the first pattern that lists it
  const files = indexedStoryFiles(options.root, options.patterns, (): void => undefined);
  const index = Object.fromEntries(files.map((file) => [file.key, file.index]));
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
