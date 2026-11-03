/**
 * The HTML fixture's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import en from "./locales/en.json";
import it from "./locales/it.json";
import scriptFiles from "./src/*.stories.js?forgebook-files";
import typedFiles from "./src/*.stories.ts?forgebook-files";

/** The HTML fixture's stories. */
export const source: StorySource = {
  id: "html",
  name: "HTML fixture",
  // the stories in TypeScript, and those in plain JavaScript
  files: [typedFiles, scriptFiles],
  texts: { en, it },
  sheets: { required: [], theme: [], restyled: [] }
};
