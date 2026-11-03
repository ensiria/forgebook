/**
 * How the catalogue's searches read words: what a text's words are, what a word means, and how much a word counts by
 * where it is found.
 *
 * @remarks
 * The one place both searches take this from, so a person and an agent asking the same words get the same answer:
 * `forgebook find` ranks components with it (`vite/findComponent.ts`), the shell's search and `forgebook search` rank
 * everything else (`search.ts`). Pure, with no model: a lexical ranking is instant, works offline and gives the same
 * answer twice. Case and accents never count. Pure apart from a cache of what a word means.
 *
 * @module
 */

/** How much a word counts, by where it is found. */
export const WEIGHTS = {
  name: 8,
  keyword: 6,
  prop: 5,
  heading: 5,
  title: 3,
  description: 2,
  story: 1,
  text: 1
} as const;

/** The places a word can be found in. */
export type SearchPlace = keyof typeof WEIGHTS;

/** The places, the one that counts most first. */
const PLACES: readonly SearchPlace[] = [
  "name",
  "keyword",
  "prop",
  "heading",
  "title",
  "description",
  "story",
  "text"
];

/** What a match by a word's start costs against the word itself, so `card` finds `Card` before `OptionCards`. */
const STARTING_COST = 0.5;

/** The shortest word that matches by its start: shorter ones match too much. */
const MIN_PREFIX = 3;

/** Words designers and code use for the same thing, each group read as one. */
const SYNONYMS: readonly (readonly string[])[] = [
  ["dialog", "modal", "popup", "lightbox"],
  ["select", "dropdown", "picker", "combobox"],
  ["button", "cta"],
  ["tooltip", "hint"],
  ["toast", "snackbar", "notification"],
  ["tabs", "tabbar"],
  ["drawer", "sheet", "sidepanel"],
  ["badge", "tag", "chip", "pill"],
  ["input", "textfield", "field"],
  ["checkbox", "tick"],
  ["switch", "toggle"],
  ["spinner", "loader"],
  ["card", "tile"]
];

/**
 * A text as the searches compare it: lower case, without accents.
 *
 * @param text - any text.
 */
export const foldedText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * A text's words, lower case and without accents, a camel-case name split into its words.
 *
 * @param text - any text.
 */
export const wordsOf = (text: string): string[] =>
  foldedText(text.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2"))
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");

/** A word without its plural. */
const singularOf = (word: string): string =>
  word.length > MIN_PREFIX && word.endsWith("s") ? word.slice(0, -1) : word;

/** The meanings worked out so far: a search asks for them for every word of every text it marks. */
const MEANINGS = new Map<string, readonly string[]>();

/**
 * A word and the ones it means, its plural taken off.
 *
 * @param word - a word, as `wordsOf` gives it.
 */
export const meaningsOf = (word: string): readonly string[] => {
  const known = MEANINGS.get(word);
  if (known !== undefined) return known;
  const singular = singularOf(word);
  const meanings = [
    ...new Set([word, singular, ...SYNONYMS.filter((group) => group.includes(singular)).flat()])
  ];
  MEANINGS.set(word, meanings);
  return meanings;
};

/**
 * How one of a text's words holds a word asked for: as it is, by its start, or not at all.
 *
 * @param held - the text's word.
 * @param word - the word asked for.
 * @param meanings - what it means (`meaningsOf`).
 */
export const wordMatch = (
  held: string,
  word: string,
  meanings: readonly string[]
): "exact" | "start" | undefined => {
  if (meanings.includes(held)) return "exact";
  const asked = singularOf(word);
  return asked.length >= MIN_PREFIX && held.startsWith(asked) ? "start" : undefined;
};

/** How a text holds a word: as it is, by its start, which counts a little less, or not at all. */
const heldAs = (
  words: readonly string[],
  word: string,
  meanings: readonly string[]
): "exact" | "start" | undefined => {
  if (words.some((held) => meanings.includes(held))) return "exact";
  return words.some((held) => wordMatch(held, word, meanings) === "start") ? "start" : undefined;
};

/**
 * A word's worth in something searched: where it counts most; nothing when it is not there.
 *
 * @param parts - its words, by where they are.
 * @param word - the word asked for.
 */
export const worthOf = (parts: Partial<Record<SearchPlace, readonly string[]>>, word: string): number => {
  const meanings = meaningsOf(word);
  for (const place of PLACES) {
    const found = heldAs(parts[place] ?? [], word, meanings);
    if (found === "exact") return WEIGHTS[place];
    if (found === "start") return WEIGHTS[place] - STARTING_COST;
  }
  return 0;
};
