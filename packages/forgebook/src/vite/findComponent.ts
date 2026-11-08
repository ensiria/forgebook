/**
 * Finding a component by intent: the words a designer or an agent would use, not the name in the code.
 *
 * @remarks
 * Pure, and with no model: a lexical ranking is instant, works offline and gives the same answer twice, and an index of a
 * few hundred components is small enough for it. A component's name counts most, then the words its author declared
 * (`keywords` in the meta, the way to say "radio tile group" of `OptionCards`), then its title and its stories' text. A
 * short list of synonyms bridges the words designers and code use for the same thing (`searchMatch.ts`, which the
 * catalogue's text search reads too). The answer says which words matched, so an agent can tell a strong result from a
 * guess, and which words nothing held as typed and were read as a name a letter or two away.
 *
 * @module
 */
import { wordsOf, worthOf } from "../searchMatch.ts";
import { correctedQuery, type SearchCorrection } from "../searchTypos.ts";

/** What the search reads of a component. */
export type FindableComponent = {
  /** Its id. */
  readonly id: string;
  /** Its whole title. */
  readonly title: string;
  /** The words its meta declares. */
  readonly keywords: readonly string[];
  /** Its stories' names and descriptions. */
  readonly stories: readonly string[];
};

/** A component found. */
export type FoundComponent = {
  /** Its id. */
  readonly id: string;
  /** Its whole title. */
  readonly title: string;
  /** How well it matches: higher is better, only comparable within an answer. */
  readonly score: number;
  /** The words of the query it holds. */
  readonly matched: readonly string[];
  /** The words of the query it does not. */
  readonly missed: readonly string[];
};

/** What a query finds. */
export type FoundComponents = {
  /** Up to five, best first; none when no word matches. */
  readonly components: readonly FoundComponent[];
  /** The words nothing held as typed, and what each was read as; empty when the query was read as typed. */
  readonly corrections: readonly SearchCorrection[];
};

/** How many components an answer gives. */
const LIMIT = 5;

/** A component's words, by where they are. */
type Parts = {
  readonly name: readonly string[];
  readonly keyword: readonly string[];
  readonly title: readonly string[];
  readonly story: readonly string[];
};

/** A component's words. */
const partsOf = (component: FindableComponent): Parts => ({
  name: wordsOf(component.title.split("/").at(-1) ?? ""),
  keyword: component.keywords.flatMap(wordsOf),
  title: wordsOf(component.title),
  story: component.stories.flatMap(wordsOf)
});

/** Each component holding a word, best first. */
const ranked = (components: readonly Parted[], words: readonly string[]): FoundComponent[] =>
  components
    .flatMap(({ component, parts }): FoundComponent[] => {
      const scores = words.map((word) => ({ word, score: worthOf(parts, word) }));
      const score = scores.reduce((sum, each) => sum + each.score, 0);
      if (score === 0) return [];
      return [
        {
          id: component.id,
          title: component.title,
          score,
          matched: scores.filter((each) => each.score > 0).map((each) => each.word),
          missed: scores.filter((each) => each.score === 0).map((each) => each.word)
        }
      ];
    })
    .toSorted((first, second) => second.score - first.score);

/** A component with its words. */
type Parted = { readonly component: FindableComponent; readonly parts: Parts };

/**
 * The components a query describes, best first.
 *
 * @param components - the catalogue's components.
 * @param query - what is being looked for, in any words.
 * @returns up to five, and the words read as others.
 */
export const findComponents = (components: readonly FindableComponent[], query: string): FoundComponents => {
  const typed = [...new Set(wordsOf(query))];
  const parted = components.map((component) => ({ component, parts: partsOf(component) }));
  const strict = ranked(parted, typed);
  const { corrections, words } = correctedQuery(
    typed,
    new Set(strict.flatMap((each) => each.matched)),
    parted.map(({ parts }) => parts)
  );
  const found = corrections.length === 0 ? strict : ranked(parted, words);
  return { components: found.slice(0, LIMIT), corrections };
};
