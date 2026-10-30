/**
 * The frames of the compare view: the story once per value of the compared switch, each frame with that value fixed
 * over the view, and its label.
 *
 * @module
 */
import type { StoryLanguage } from "@ensiria/story-format/source";

import { type CompareMode, SHEETS_CHOICES, TEXT_SCALES, type ViewState } from "../viewState";
import { STRINGS } from "./strings";

/** One frame of the compare view. */
export type CompareVariant = {
  /** What the frame shows, under it. */
  readonly label: string;
  /** The switches the frame fixes over the view. */
  readonly view: Partial<ViewState>;
};

/** The themes at both contrasts: the four looks every story must hold. */
const THEME_VARIANTS: readonly CompareVariant[] = [
  { label: STRINGS.compareThemes.light, view: { theme: "light", isMoreContrast: false } },
  { label: STRINGS.compareThemes.dark, view: { theme: "dark", isMoreContrast: false } },
  { label: STRINGS.compareThemes.lightMore, view: { theme: "light", isMoreContrast: true } },
  { label: STRINGS.compareThemes.darkMore, view: { theme: "dark", isMoreContrast: true } }
];

/**
 * The frames of a compare mode.
 *
 * @param mode - the compared switch.
 * @param languages - the story's languages, for the language mode.
 * @returns the frames, in order; none when the view compares nothing.
 */
export const compareVariants = (mode: CompareMode, languages: readonly StoryLanguage[]): CompareVariant[] => {
  if (mode === "theme") return [...THEME_VARIANTS];
  if (mode === "language") {
    return [
      { label: STRINGS.storiesLanguage, view: { language: "" } },
      ...languages.map((language) => ({ label: language.label, view: { language: language.id } }))
    ];
  }
  if (mode === "text") return TEXT_SCALES.map((text) => ({ label: STRINGS.textScale(text), view: { text } }));
  if (mode === "sheets") {
    return SHEETS_CHOICES.map((sheets) => ({ label: STRINGS.sheetChoices[sheets], view: { sheets } }));
  }
  return [];
};
