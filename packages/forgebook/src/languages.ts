/**
 * The languages a story can be drawn in: the ones the catalogue's configuration offers every source, then the ones
 * the story's own source adds.
 *
 * @remarks
 * A catalogue turns translations on by giving `languages` to `mountShell` and `mountFrame` (the app's
 * configuration): every source's stories then get them, whatever library wrote them. A source may still offer its
 * own (`StorySource.languages`); for a language both offer, the source's wrapper wins, since the library knows its
 * provider best. With neither, the View menu has no Language row. Pure.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/story-format/source";

/**
 * The languages of a story: the catalogue's, then its source's, one per id, with the source's wrapper for an id both
 * offer.
 *
 * @param catalogue - the languages of the catalogue's configuration; none when it offers none.
 * @param source - the languages of the story's source; none when it offers none.
 */
export const storyLanguages = (
  catalogue: readonly StoryLanguage[],
  source: readonly StoryLanguage[]
): StoryLanguage[] => [
  ...catalogue.map((language) => source.find((own) => own.id === language.id) ?? language),
  ...source.filter((own) => !catalogue.some((language) => language.id === own.id))
];

/**
 * The language a view shows, among a story's: none for the stories' own text, or for an id the story does not offer.
 *
 * @param languages - the story's languages.
 * @param id - the view's language id; empty for the stories' own text.
 */
export const shownLanguage = (languages: readonly StoryLanguage[], id: string): StoryLanguage | undefined =>
  languages.find((language) => language.id === id);
