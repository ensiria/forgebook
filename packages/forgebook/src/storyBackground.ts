/**
 * The colour a story's box waits on while the story loads: its source's page colour for the theme and contrast the
 * view shows, so the box is not white before a dark story and does not change colour when the story appears; the
 * colour of the backdrop Forgebook draws instead, when the view sets one (D-652). Pure.
 *
 * @module
 */
import type { StoryBackground } from "@forgebook/story-format/source";

import { backdropColor } from "./backdrops";
import type { ViewState } from "./viewState";

/**
 * A source's page colour for a view, or the colour of the view's backdrop.
 *
 * @param background - the source's colours; none when it gives none.
 * @param view - the theme and the contrast the story is drawn in, and the backdrop behind it.
 * @param isSystemDark - whether the system prefers dark, for the `system` theme.
 * @returns the CSS colour, or none when the source gives none.
 */
export const storyBackground = (
  background: StoryBackground | undefined,
  view: Pick<ViewState, "theme" | "isMoreContrast" | "backdrop">,
  isSystemDark: boolean
): string | undefined => {
  const isDark = view.theme === "dark" || (view.theme === "system" && isSystemDark);
  const backdrop = backdropColor(view.backdrop, isDark);
  if (backdrop !== undefined) return backdrop;
  if (background === undefined) return undefined;
  if (isDark) return view.isMoreContrast ? (background.darkMore ?? background.dark) : background.dark;
  return view.isMoreContrast ? (background.lightMore ?? background.light) : background.light;
};
