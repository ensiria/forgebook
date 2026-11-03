/**
 * The Svelte fixture's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import en from "./locales/en.json";
import it from "./locales/it.json";
import files from "./src/*.stories.ts?forgebook-files";

/** The Svelte fixture's stories. */
export const source: StorySource = {
  id: "svelte",
  name: "Svelte fixture",
  files: [files],
  texts: { en, it },
  sheets: { required: [], theme: [], restyled: [] }
};
