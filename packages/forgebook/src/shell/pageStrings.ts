/**
 * The texts of the pages loaded on first use (the home, generated or written, and the docs pages): loaded with them, so
 * a story's or a component's first load does not carry them. A catalogue replaces them by the same names as the shell's
 * other texts (`strings: { "asides.tip": "Hint" }`).
 *
 * @module
 */
import { lateStrings } from "./strings.ts";

/** The texts of the home and the docs pages, the catalogue's replacements applied. */
export const PAGE_STRINGS = lateStrings({
  homeEmpty: "No stories yet: a source with story files shows its families here.",
  homeSummary: (components: number, sources: number): string =>
    `${components} ${components === 1 ? "component" : "components"} in ${sources} ${sources === 1 ? "library" : "libraries"}.`,
  homeIntroError: "The library's introduction could not be read",
  recentlyOpened: "Recently opened",
  componentsCount: (count: number): string => `${count} ${count === 1 ? "component" : "components"}`,
  showAll: (count: number): string => `Show all ${count}`,
  showFewer: "Show fewer",

  pageContents: "On this page",
  previousPage: "Previous",
  nextPage: "Next",
  docPageError: "The page could not be read",
  homeError: "The home could not be read",
  homeProblems: "The home's file has problems",
  unknownSource: (id: string): string =>
    `No library "${id}": the home names one the catalogue does not have.`,
  asides: { note: "Note", tip: "Tip", important: "Important", caution: "Caution", danger: "Danger" }
});
