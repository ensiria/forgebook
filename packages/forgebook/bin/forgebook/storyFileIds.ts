/**
 * The ids of the stories a catalogue lists for some story files: `forgebook new --repair` checks the file it just
 * wrote, whose ids no caller knows yet.
 *
 * @module
 */
import type { StoriesDocument } from "../../src/vite/agent.types.ts";
import { VITE_PATHS } from "../../src/vite/vitePaths.ts";

/**
 * The ids of the listed stories of some story files.
 *
 * @param document - the catalogue's stories.
 * @param dir - the catalogue's folder, which the document's files are relative to.
 * @param files - the files, absolute.
 */
export const idsOfFiles = (document: StoriesDocument, dir: string, files: readonly string[]): string[] => {
  const wanted = new Set(files.map((file) => VITE_PATHS.normalize(file)));
  return document.components.flatMap((component) =>
    component.stories
      .filter((story) => story.file !== undefined && wanted.has(VITE_PATHS.resolve(dir, story.file)))
      .map((story) => story.id)
  );
};
