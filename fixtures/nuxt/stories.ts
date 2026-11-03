/**
 * The Nuxt fixture's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "./app/components/*.stories.ts?forgebook-files";
import en from "./locales/en.json";
import it from "./locales/it.json";

/** The Nuxt fixture's stories. */
export const source: StorySource = {
  id: "nuxt",
  name: "Nuxt fixture",
  files: [files],
  texts: { en, it },
  sheets: { required: [], theme: [], restyled: [] }
};
