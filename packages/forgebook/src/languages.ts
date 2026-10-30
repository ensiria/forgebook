/**
 * The language a view shows, among the catalogue's (the View menu's Language row): its texts table is the source's
 * (`StorySource.texts`), its provider a decorator of the catalogue's preview. Pure.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/story-format/source";

/**
 * The language a view shows, among the catalogue's: none for the stories' own text, or for an id it does not offer.
 *
 * @param languages - the catalogue's languages.
 * @param id - the view's language id; empty for the stories' own text.
 */
export const shownLanguage = (languages: readonly StoryLanguage[], id: string): StoryLanguage | undefined =>
  languages.find((language) => language.id === id);
