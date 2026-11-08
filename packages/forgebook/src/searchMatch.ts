/**
 * How the catalogue's searches read words: what a text's words are, what a word means, and how much a word counts by
 * where it is found.
 *
 * @remarks
 * The one place both searches take this from, so a person and an agent asking the same words get the same answer:
 * `forgebook find` ranks components with it (`vite/findComponent.ts`), the shell's search and `forgebook search` rank
 * everything else (`search.ts`). Pure, with no model: a lexical ranking is instant, works offline and gives the same
 * answer twice. Case and accents never count. A word nothing holds is read as the nearest name a letter or two away
 * (`correctionsOf`), and the answer says so. Pure apart from a cache of what a word means.
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
 * The words of short texts read so far: names, story names and search words come back many times in a catalogue
 * (`Primary`, `Default`), and reading each is most of what the first search does. Long texts are read once anyway.
 */
const WORDS = new Map<string, readonly string[]>();

/** The longest text whose words are kept: a name or a title, not a page. */
const MAX_KEPT_TEXT = 80;

/** The most texts kept: past that the cache starts again, so a long session holds a bounded amount. */
const MAX_KEPT_TEXTS = 20_000;

/**
 * A text's words, lower case and without accents, a camel-case name split into its words.
 *
 * @param text - any text.
 */
export const wordsOf = (text: string): string[] => {
  const known = WORDS.get(text);
  if (known !== undefined) return [...known];
  const words = foldedText(text.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2"))
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
  if (text.length <= MAX_KEPT_TEXT) {
    if (WORDS.size >= MAX_KEPT_TEXTS) WORDS.clear();
    WORDS.set(text, words);
  }
  return [...words];
};

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

/** A word of a query read as another, because nothing holds it as typed and the other is a letter or two away. */
export type SearchCorrection = {
  /** The word as typed, lower case and without accents. */
  readonly typed: string;
  /** The word of the catalogue it was read as. */
  readonly read: string;
};

/** The places whose words a typo is read against: names, not prose, where a near word is seldom the one meant. */
const CORRECTION_PLACES: readonly SearchPlace[] = ["name", "keyword", "prop", "heading", "title", "story"];

/** The shortest word read as another: in a shorter one, a letter changed makes most often a different word. */
const MIN_CORRECTED = 4;

/** From this length a word may be two letters away from the one meant. */
const TWO_TYPOS_FROM = 8;

/**
 * How many letters a typed word may be away from the word meant: none under four letters, one up to seven, two from
 * eight.
 *
 * @param word - a word, as `wordsOf` gives it.
 */
export const typosAllowed = (word: string): number => {
  if (word.length < MIN_CORRECTED) return 0;
  return word.length < TWO_TYPOS_FROM ? 1 : 2;
};

/**
 * How many letters two words are apart, a letter added, removed, changed, or two side by side swapped counting one
 * each (the restricted Damerau-Levenshtein distance); none past a limit.
 *
 * @remarks
 * Stops at the first row past the limit, so a word far from the one asked costs a few steps, not its whole table.
 *
 * @param first - a word.
 * @param second - another.
 * @param limit - the most that counts.
 * @returns the distance, or `undefined` past the limit.
 */
export const distanceWithin = (first: string, second: string, limit: number): number | undefined => {
  if (Math.abs(first.length - second.length) > limit) return undefined;
  let before: readonly number[] = [];
  let previous: readonly number[] = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = distanceRow(first, second, row, { previous, before });
    if (Math.min(...current) > limit) return undefined;
    before = previous;
    previous = current;
  }
  const distance = previous[second.length] ?? 0;
  return distance <= limit ? distance : undefined;
};

/**
 * One row of the distance's table: how far the first `row` letters of a word are from each start of another.
 *
 * @param first - the word the rows follow.
 * @param second - the word the columns follow.
 * @param row - how many letters of the first word.
 * @param rows - the row before and the one before it, for a swap.
 */
const distanceRow = (
  first: string,
  second: string,
  row: number,
  rows: { readonly previous: readonly number[]; readonly before: readonly number[] }
): number[] => {
  const { previous, before } = rows;
  const current = [row];
  for (let column = 1; column <= second.length; column += 1) {
    const cost = first[row - 1] === second[column - 1] ? 0 : 1;
    const steps = [
      (previous[column] ?? 0) + 1,
      (current[column - 1] ?? 0) + 1,
      (previous[column - 1] ?? 0) + cost
    ];
    const isSwap =
      row > 1 && column > 1 && first[row - 1] === second[column - 2] && first[row - 2] === second[column - 1];
    if (isSwap) steps.push((before[column - 2] ?? 0) + 1);
    current.push(Math.min(...steps));
  }
  return current;
};

/** A word met in the catalogue, with how often. */
type Candidate = { readonly word: string; readonly distance: number; readonly count: number };

/**
 * The words a typo can be read as, each with how often the catalogue's names use it.
 *
 * @param everything - the words of each thing that can be found, by where they are.
 */
const candidateWords = (
  everything: readonly Partial<Record<SearchPlace, readonly string[]>>[]
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const parts of everything) {
    for (const word of CORRECTION_PLACES.flatMap((place) => parts[place] ?? [])) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  // a synonym is a candidate only when the catalogue holds a word of its group: read otherwise, it would find nothing
  for (const group of SYNONYMS.filter((each) => each.some((word) => counts.has(word)))) {
    for (const word of group) if (!counts.has(word)) counts.set(word, 0);
  }
  return counts;
};

/** Whether a candidate is a better reading than the best so far: nearer, then used more, then first in order. */
const isBetter = (candidate: Candidate, best: Candidate | undefined): boolean =>
  best === undefined ||
  candidate.distance < best.distance ||
  (candidate.distance === best.distance &&
    (candidate.count > best.count || (candidate.count === best.count && candidate.word < best.word)));

/** The candidate a typed word is read as; none when none is near enough. */
const nearestWord = (typed: string, counts: ReadonlyMap<string, number>): string | undefined => {
  let best: Candidate | undefined;
  for (const [word, count] of counts) {
    const distance = distanceWithin(typed, word, typosAllowed(typed));
    if (distance === undefined || distance === 0) continue;
    const candidate = { word, distance, count };
    if (isBetter(candidate, best)) best = candidate;
  }
  return best?.word;
};

/**
 * The words of a query that nothing holds, each read as the nearest word of the catalogue's names, when one is near
 * enough (`typosAllowed`).
 *
 * @remarks
 * Only a word that matches nothing anywhere is read as another, so a typo never changes what a word found already
 * finds, and every result of an exact query stays. The nearest wins; between words as near, the one the catalogue
 * uses most, then the first in alphabetical order, so the same query reads the same way twice. The synonyms' words
 * count as the catalogue's where it holds a word of their group: `dialgo` reads `dialog`, which then finds a `Modal`.
 *
 * @param missing - the query's words that nothing holds.
 * @param everything - the words of each thing that can be found, by where they are.
 */
export const correctionsOf = (
  missing: readonly string[],
  everything: readonly Partial<Record<SearchPlace, readonly string[]>>[]
): readonly SearchCorrection[] => {
  const asked = missing.filter((word) => typosAllowed(word) > 0);
  if (asked.length === 0) return [];
  const counts = candidateWords(everything);
  return asked.flatMap((typed): SearchCorrection[] => {
    const read = nearestWord(typed, counts);
    return read === undefined ? [] : [{ typed, read }];
  });
};

/**
 * A query's words with its corrections applied, each word once.
 *
 * @param words - the query's words.
 * @param corrections - what some of them are read as (`correctionsOf`).
 */
export const correctedWords = (
  words: readonly string[],
  corrections: readonly SearchCorrection[]
): string[] => [
  ...new Set(words.map((word) => corrections.find((each) => each.typed === word)?.read ?? word))
];
