/**
 * The fixture package's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import docs from "./docs/**/*.md?forgebook-docs-pages";
import en from "./locales/en.json";
import it from "./locales/it.json";
import logoUrl from "./logo.svg?url";
import files from "./src/*.stories.tsx?forgebook-files";

/** The fixture package's stories. */
export const source: StorySource = {
  id: "kit",
  name: "Fixture kit",
  logo: logoUrl,
  // invented colours, so the tests can see a story's box wait on its page colour
  background: { light: "#fafafa", dark: "#111111" },
  files: [files],
  docs: [docs],
  texts: { en, it },
  sheets: { required: [], theme: [], restyled: [] },
  home: () => import("./home.md?forgebook-markdown")
};
