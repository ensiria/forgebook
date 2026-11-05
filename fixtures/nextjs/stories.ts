/**
 * The Next.js fixture's stories, as a package hands them to a catalogue, for its server tests.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "./components/*.stories.tsx?forgebook-files";

/** The Next.js fixture's stories. */
export const source: StorySource = {
  id: "nextjs",
  name: "Next.js fixture",
  files: [files],
  sheets: { required: [], theme: [], restyled: [] }
};
