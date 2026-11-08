/**
 * The SvelteKit 2 fixture's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import en from "./locales/en.json";
import files from "./src/**/*.stories.ts?forgebook-files";

/** The SvelteKit 2 fixture's stories. */
export const source: StorySource = {
  id: "sveltekit2",
  name: "SvelteKit 2 fixture",
  files: [files],
  texts: { en },
  sheets: { required: [], theme: [], restyled: [] }
};
