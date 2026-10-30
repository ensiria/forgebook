/**
 * A framework's docs module for the core's tests: names a story file's component after the file, so the worker and
 * the plugin are tested without any real framework.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { basename } from "node:path";

import type { StoryComponentResult } from "../../src/vite/adapter.ts";

/**
 * The component of a story file, named after it (`Select.stories.tsx` → `Select`), or why the file is missing.
 *
 * @param storyFile - the story file's absolute path.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult => {
  if (!existsSync(storyFile)) return `${storyFile} does not exist`;
  const name = basename(storyFile).replace(/\.stories\.tsx?$/, "");
  return {
    docs: { name, description: "", summary: "", props: [], parts: [], subcomponents: [] },
    file: storyFile,
    sources: [storyFile]
  };
};
