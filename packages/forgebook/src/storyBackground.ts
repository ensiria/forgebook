/**
 * The colour a story's box waits on while the story loads: its source's page colour for the theme and contrast the
 * view shows, so the box is not white before a dark story and does not change colour when the story appears; the
 * colour of the backdrop Forgebook draws instead, when the view sets one. Pure.
 *
 * @module
 */
import type { StoryBackground } from "@forgebook/story-format/source";

import { backdropColor } from "./backdrops.ts";
import type { CatalogueSettings } from "./catalogue.ts";
import { isMoreContrastOf, schemeOf, type ViewState } from "./viewState.ts";

/**
 * A source's page colour for a view, or the colour of the view's backdrop.
 *
 * @param background - the source's colours; none when it gives none.
 * @param view - the switches' values the story is drawn in, and the backdrop behind it.
 * @param catalogue - the catalogue's switches (its colour scheme, its contrast) and backdrops.
 * @param isSystemDark - whether the system prefers dark, for the `system` theme.
 * @returns the CSS colour, or none when the source gives none.
 */
export const storyBackground = (
  background: StoryBackground | undefined,
  view: Pick<ViewState, "switches" | "backdrop">,
  catalogue: Pick<CatalogueSettings, "switches" | "backdrops">,
  isSystemDark: boolean
): string | undefined => {
  const { switches } = catalogue;
  const scheme = schemeOf(view, switches);
  const isDark = scheme === "dark" || (scheme === "system" && isSystemDark);
  const isMoreContrast = isMoreContrastOf(view, switches);
  const shown = catalogue.backdrops.find((each) => each.id === view.backdrop);
  const backdrop = backdropColor(shown, isDark);
  if (backdrop !== undefined) return backdrop;
  if (background === undefined) return undefined;
  if (isDark) return isMoreContrast ? (background.darkMore ?? background.dark) : background.dark;
  return isMoreContrast ? (background.lightMore ?? background.light) : background.light;
};
