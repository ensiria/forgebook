/**
 * The tags a preview gives every story (`tags` in `forgebook.preview.ts`), read from its text as a story file's are, so
 * the list of stories needs no preview run.
 *
 * @remarks
 * CSF puts them under a meta's and a story's, whose `!name` takes one away. The story index is kept between starts per
 * file, so they join each story when the group's module is written, not in the kept index. Only tags written plainly
 * count, as in a story file. Pure, but for reading the files.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import { objectFields, stringListOf } from "./indexFields.ts";
import { combinedTags, storyFileMeta } from "./indexStoryFile.ts";
import type { IndexedStoryFile } from "./storyFilesModule.ts";
import { parseStoryFile } from "./storyParse.ts";

/**
 * The tags a preview's text writes: none when it writes none, or none plainly.
 *
 * @param file - the preview's path, for the parser's language.
 * @param text - its text.
 */
export const tagsOfPreviewText = (file: string, text: string): readonly string[] => {
  const meta = storyFileMeta(parseStoryFile(file, text).program);
  const tags = meta === undefined ? undefined : stringListOf(objectFields(meta), "tags");
  return tags === undefined || tags instanceof Error ? [] : tags;
};

/**
 * The tags of a catalogue's previews, the first preview's under the next's.
 *
 * @param config - the catalogue, with its previews' paths, the presets' first; none has no previews.
 * @param watch - adds a file whose edit renews the module that reads them.
 */
export const previewTagsOf = (
  config: { readonly previews: readonly string[] } | undefined,
  watch: (file: string) => void
): readonly string[] =>
  combinedTags(
    (config?.previews ?? []).map((file) => {
      watch(file);
      return tagsOfPreviewText(file, readFileSync(file, "utf8"));
    })
  );

/**
 * Story files with a preview's tags under each story's own.
 *
 * @param files - the story files, indexed.
 * @param tags - the previews' tags.
 */
export const withPreviewTags = (
  files: readonly IndexedStoryFile[],
  tags: readonly string[]
): readonly IndexedStoryFile[] =>
  tags.length === 0
    ? files
    : files.map((file) => ({
        ...file,
        index: {
          ...file.index,
          stories: file.index.stories.map((story) => ({
            ...story,
            tags: combinedTags([tags, story.tags])
          }))
        }
      }));
