/**
 * What the shell and the frame pages read of a catalogue's configuration (`vite/config.ts`): data, as the plugin hands
 * it to the generated pages through `virtual:forgebook/config`.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/story-format/source";

import type { CatalogueLists } from "./catalogue.ts";
import type { FramesPlacement } from "./frameOrigins.ts";
import type { ViewSwitch } from "./switches.ts";

/** What the shell and the frame pages read of a configuration: data, as the plugin hands it to them. */
export type PageConfig = {
  /** The catalogue's name. */
  readonly title: string;
  /** The heights file's address, relative to the pages; none without one. */
  readonly heights: string | undefined;
  /** The switches, the presets' and the catalogue's merged. */
  readonly switches: readonly ViewSwitch[] | undefined;
  /** The catalogue's own story patterns, for a dev server's home with no story to say where it looks; none in a build. */
  readonly storyGlobs?: readonly string[];
  /** The languages, the presets' and the catalogue's merged. */
  readonly languages: readonly StoryLanguage[];
  /** The lists (widths, backgrounds, story groups, texts…), the presets' and the catalogue's merged. */
  readonly lists: CatalogueLists;
  /** Where the frames run: the shell loads them there, and each side hears only the other's origin. */
  readonly frames: FramesPlacement;
};
