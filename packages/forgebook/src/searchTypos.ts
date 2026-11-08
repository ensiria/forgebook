/**
 * How the catalogue's searches read a word nothing holds as typed: as the nearest word of the catalogue's names, a
 * letter or two away.
 *
 * @remarks
 * `forgebook find`, `forgebook search`, the dev server's API and MCP read typos alike from here. The shell's search
 * reads words as typed: what reading typos costs is more than its first search's budget leaves. Pure.
 *
 * @module
 */
import {
  answerOf,
  queryOf,
  type SearchAnswer,
  type Searchable,
  type SearchLimits,
  scoredAll
} from "./search.ts";
import { type SearchPlace, SYNONYMS } from "./searchMatch.ts";

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

/** A query's words as a search reads them. */
export type CorrectedQuery = {
  /** The words nothing held as typed, and what each was read as; empty when the query is read as typed. */
  readonly corrections: readonly SearchCorrection[];
  /** The query's words, the corrections applied, each word once. */
  readonly words: readonly string[];
};

/**
 * A query's words with those nothing holds read as near names (`correctionsOf`).
 *
 * @param words - the query's words.
 * @param held - those something holds as typed.
 * @param everything - the words of each thing that can be found, by where they are.
 */
export const correctedQuery = (
  words: readonly string[],
  held: ReadonlySet<string>,
  everything: readonly Partial<Record<SearchPlace, readonly string[]>>[]
): CorrectedQuery => {
  const corrections = correctionsOf(
    words.filter((word) => !held.has(word)),
    everything
  );
  return { corrections, words: correctedWords(words, corrections) };
};

/** What a query finds, with the words read as others. */
export type CorrectedAnswer = SearchAnswer & {
  /** The words nothing held as typed, and what each was read as; empty when the query was read as typed. */
  readonly corrections: readonly SearchCorrection[];
};

/**
 * What a query finds (`searchCatalogue`), a word nothing holds as typed read as the nearest name (`correctedQuery`).
 *
 * @param all - everything that can be found (`searchables`).
 * @param query - what was typed.
 * @param limits - how much of the answer to give.
 */
export const correctedSearch = (
  all: readonly Searchable[],
  query: string,
  limits: SearchLimits
): CorrectedAnswer => {
  const typed = queryOf(query);
  const strict = scoredAll(all, typed);
  const { corrections, words } = correctedQuery(
    typed.words,
    new Set(strict.flatMap((each) => each.matched)),
    all.map((each) => each.parts)
  );
  if (corrections.length === 0) return { ...answerOf(strict, typed, limits), corrections };
  const read = { ...typed, words };
  return { ...answerOf(scoredAll(all, read), read, limits), corrections };
};
