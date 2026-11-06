/**
 * The Storybook fixture's stories, as a package hands them to a catalogue: `.tsx` and `.jsx` files, most without
 * Forgebook's own fields, one with no title at all.
 *
 * @module
 */
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import docs from "./docs/*.md?forgebook-docs-pages";
import jsxFiles from "./src/**/*.stories.jsx?forgebook-files";
import tsxFiles from "./src/**/*.stories.tsx?forgebook-files";

/** The Storybook fixture's stories. */
export const source: StorySource = {
  id: "sb",
  name: "Storybook stories",
  files: [tsxFiles, jsxFiles],
  docs: [docs],
  namedValues: {
    ValueIcon: { Star: (): string => "★", Heart: (): string => "♥" },
    ReactNode: { Bold: "A named node" }
  },
  sheets: { required: [], theme: [], restyled: [] }
};
