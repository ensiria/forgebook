/**
 * The words of the search's results, loaded with them: a reader who never searches pays for neither. A catalogue
 * replaces them as any other text of the shell (`strings: { "search.kindPage": "Guides" }`).
 *
 * @module
 */
import { configureGroup } from "./strings.ts";

/** The texts, as Forgebook writes them. */
const searchStrings = {
  results: "Search results",
  count: (count: number): string => (count === 1 ? "1 result" : `${count} results`),
  reading: "Reading the docs…",
  unreadable: "Part of the docs could not be read",
  nothing: (query: string): string => `Nothing found for “${query}”`,
  missing: (words: string): string => `Without: ${words}`,
  more: (count: number): string => `${count} more inside`,
  means: (word: string): string => `means ${word}`,
  kindComponent: "Component",
  kindPage: "Docs",
  hitProp: "Prop",
  hitEvent: "Event",
  hitStory: "Story",
  hitHeading: "Heading",
  hitText: "Text",
  hitDescription: "About",
  reasonKeyword: "Keyword",
  reasonPlace: "Place",
  keyMove: "to move",
  keyOpen: "to open",
  keyClear: "to clear"
};

configureGroup("search", searchStrings);

/** The search's texts, as shown. */
export const SEARCH_STRINGS: typeof searchStrings = searchStrings;
