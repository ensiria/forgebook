/**
 * The fixture package's stories, as a package hands them to a catalogue.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import docs from "./docs/**/*.md?forgebook-docs-pages";
import logoUrl from "./logo.svg?url";
import files from "./src/*.stories.tsx?forgebook-files";

/** The fixture package's stories. */
export const source: StorySource = {
  id: "kit",
  name: "Fixture kit",
  logo: logoUrl,
  // invented colours, so the tests can see a story's box wait on its page colour
  // a catalogue's look named `night` has a page of its own colour (`fixtures/app/themes`)
  background: { light: "#fafafa", dark: "#111111", bySwitch: { look: { night: { dark: "#0b1020" } } } },
  files: [files],
  docs: [docs],
  // loaded as a frame shows them: the catalogue's page never carries them
  texts: { en: () => import("./locales/en.json"), it: () => import("./locales/it.json") },
  sheets: { required: [], theme: [], restyled: [] },
  // invented tokens, so the tools and CATALOG.md see a library's tokens reach them
  tokens: ["tokens.json", { file: "dark.tokens.json", mode: "dark" }],
  home: () => import("./home.md?forgebook-markdown")
};
