/**
 * A source's story files as one group: its `?forgebook-files` groups merged, so the tree, the frame and the panel look
 * a file up by its key wherever its pattern was declared.
 *
 * @remarks
 * The keys are paths relative to the module that declared the source, unique across its groups. The merge is kept per
 * source object, so a page that asks on every render merges once. Pure apart from that cache.
 *
 * @module
 */
import type { StoryFiles, StorySource } from "@forgebook/story-format/source";

/** The merged files of each source seen, by the source object itself. */
const MERGED = new WeakMap<StorySource, StoryFiles>();

/**
 * A source's story files, every group merged.
 *
 * @param source - the source.
 */
export const sourceFiles = (source: StorySource): StoryFiles => {
  const known = MERGED.get(source);
  if (known !== undefined) return known;
  const merged: StoryFiles = {
    index: Object.assign({}, ...source.files.map((group) => group.index)),
    stories: Object.assign({}, ...source.files.map((group) => group.stories)),
    docs: Object.assign({}, ...source.files.map((group) => group.docs)),
    code: Object.assign({}, ...source.files.map((group) => group.code)),
    pages: Object.assign({}, ...source.files.map((group) => group.pages))
  };
  MERGED.set(source, merged);
  return merged;
};
