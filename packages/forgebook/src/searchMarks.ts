/**
 * Where a text holds what was searched for: the stretches to mark, and the part of a long text worth showing.
 *
 * @remarks
 * A person has to see why a result is there, so the marks follow the matching rules exactly (`searchMatch.ts`): a
 * camel-case name is marked word by word, a word found by its start only as far as it was typed, and a synonym where it
 * stands. Pure.
 *
 * @module
 */
import { foldedText, meaningsOf, wordMatch } from "./searchMatch.ts";

/** A piece of a text, marked when it matched. */
export type MarkedText = {
  /** The text. */
  readonly text: string;
  /** Whether it is what was searched for. */
  readonly isMatch: boolean;
};

/** What was searched for, as the marks read it. */
export type MarkedQuery = {
  /** Its words. */
  readonly words: readonly string[];
  /** Its words as one text, when there are several (`foldedText`). */
  readonly phrase: string | undefined;
};

/** A stretch of a text that matched. */
type Match = {
  /** Where it starts. */
  readonly start: number;
  /** Where it ends. */
  readonly end: number;
  /** The word of the query it answers. */
  readonly word: string;
};

/** How long a snippet is, in characters. */
const SNIPPET_LENGTH = 110;

/** How much of a snippet comes before its first match, in characters. */
const LEAD_IN = 28;

/** What stands for the text left out of a snippet. */
const ELLIPSIS = "…";

/** The characters two texts start with in common. */
const commonStart = (first: string, second: string): number => {
  let length = 0;
  while (length < first.length && first[length] === second[length]) length += 1;
  return length;
};

/** The pieces of a run of letters a camel-case name splits it into, with where each starts. */
const piecesOf = (token: string): readonly { readonly offset: number; readonly text: string }[] => {
  let offset = 0;
  return token
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .split(" ")
    .map((text) => {
      const piece = { offset, text };
      offset += text.length;
      return piece;
    });
};

/** How long a word has to be to be marked by its start: `the` lights up every `theme` of a sentence otherwise. */
const MIN_MARKED_START = 4;

/** Where a run of letters answers one word; a whole name typed as one word marks the whole name. */
const tokenMatches = (
  token: string,
  whole: string,
  at: number,
  word: string,
  isTyped: boolean
): readonly Match[] => {
  const meanings = meaningsOf(word);
  // an accent folded into two letters moves every place after it: the run is then marked whole or not at all
  if (whole.length !== token.length) {
    return wordMatch(whole, word, meanings) === undefined
      ? []
      : [{ start: at, end: at + token.length, word }];
  }
  const wholeMatch = wordMatch(whole, word, meanings);
  if (wholeMatch === "exact") return [{ start: at, end: at + token.length, word }];
  if (wholeMatch === "start" && isTyped) return [{ start: at, end: at + commonStart(whole, word), word }];
  return piecesOf(token).flatMap(({ offset, text }): Match[] => {
    const piece = foldedText(text);
    const found = wordMatch(piece, word, meanings);
    if (found === undefined || (found === "start" && !isTyped)) return [];
    const length = found === "exact" ? piece.length : commonStart(piece, word);
    return [{ start: at + offset, end: at + offset + length, word }];
  });
};

/** Where one run of letters answers the query. */
const runMatches = (token: string, at: number, words: readonly string[]): readonly Match[] => {
  const whole = foldedText(token);
  const last = words.at(-1);
  return words.flatMap((word) =>
    tokenMatches(token, whole, at, word, word === last || word.length >= MIN_MARKED_START)
  );
};

/** Whether a character belongs to a word; none at a text's edge. */
const isWordCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[\p{L}\p{M}\p{N}]/u.test(character);

/** Where a text holds a query's phrase, each stretch one match; none when an accent moved the text's places. */
const phraseMatches = (text: string, phrase: string, word: string): readonly Match[] => {
  const folded = foldedText(text);
  if (folded.length !== text.length) return [];
  const matches: Match[] = [];
  for (let start = folded.indexOf(phrase); start !== -1; start = folded.indexOf(phrase, start + 1)) {
    const end = start + phrase.length;
    const isOverlap = (matches.at(-1)?.end ?? 0) > start;
    if (!isOverlap && !isWordCharacter(folded[start - 1]) && !isWordCharacter(folded[end]))
      matches.push({ start, end, word });
  }
  return matches;
};

/** Every stretch of a text that answers a word, in order and without overlaps. */
const matchesOf = (text: string, { words, phrase }: MarkedQuery): readonly Match[] => {
  const whole = phrase === undefined ? [] : phraseMatches(text, phrase, phrase);
  if (whole.length > 0) return whole;
  const matches = [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)]
    .flatMap((run) => runMatches(run[0], run.index, words))
    .toSorted((first, second) => first.start - second.start || second.end - first.end);
  let reached = 0;
  return matches.filter((match) => {
    if (match.start < reached) return false;
    reached = match.end;
    return true;
  });
};

/** A stretch of a text as pieces, marked where it matched. */
const piecesBetween = (text: string, matches: readonly Match[], from: number, to: number): MarkedText[] => {
  const pieces: MarkedText[] = [];
  let reached = from;
  for (const match of matches) {
    if (match.start < from || match.end > to) continue;
    if (match.start > reached) pieces.push({ text: text.slice(reached, match.start), isMatch: false });
    pieces.push({ text: text.slice(match.start, match.end), isMatch: true });
    reached = match.end;
  }
  if (reached < to) pieces.push({ text: text.slice(reached, to), isMatch: false });
  return pieces;
};

/**
 * A short text with what matched marked.
 *
 * @param text - the text.
 * @param query - what was searched for.
 */
export const markedText = (text: string, query: MarkedQuery): readonly MarkedText[] =>
  piecesBetween(text, matchesOf(text, query), 0, text.length);

/** How many different words of the query a snippet starting at a match would show. */
const wordsShown = (matches: readonly Match[], from: Match): number =>
  new Set(
    matches
      .filter(
        (match) =>
          match === from || (match.start >= from.start && match.end <= from.start + SNIPPET_LENGTH - LEAD_IN)
      )
      .map((match) => match.word)
  ).size;

/** The match a snippet starts around: the first that shows the most words of the query. */
const bestStart = (matches: readonly Match[]): Match | undefined => {
  let best: Match | undefined;
  let bestCount = 0;
  for (const match of matches) {
    const count = wordsShown(matches, match);
    if (count > bestCount) {
      best = match;
      bestCount = count;
    }
  }
  return best;
};

/**
 * The part of a text worth showing, with what matched marked: around the matches that show most of the query, cut
 * between words; the text's start when nothing in it matched.
 *
 * @param text - the text.
 * @param query - what was searched for.
 */
export const snippetOf = (text: string, query: MarkedQuery): readonly MarkedText[] => {
  const matches = matchesOf(text, query);
  if (text.length <= SNIPPET_LENGTH) return piecesBetween(text, matches, 0, text.length);
  const best = bestStart(matches);
  const around = best?.start ?? 0;
  const roughStart = Math.max(0, around - LEAD_IN);
  const nextSpace = roughStart === 0 ? 0 : text.indexOf(" ", roughStart) + 1;
  const start = nextSpace === 0 || nextSpace > around ? roughStart : nextSpace;
  // a sentence longer than a snippet still shows whole, or it would show unmarked
  const roughEnd = Math.min(text.length, Math.max(start + SNIPPET_LENGTH, best?.end ?? 0));
  const lastSpace = text.lastIndexOf(" ", roughEnd);
  const end = roughEnd === text.length || lastSpace < (best?.end ?? around) ? roughEnd : lastSpace;
  return [
    ...(start === 0 ? [] : [{ text: ELLIPSIS, isMatch: false }]),
    ...piecesBetween(text, matches, start, end),
    ...(end === text.length ? [] : [{ text: ELLIPSIS, isMatch: false }])
  ];
};
