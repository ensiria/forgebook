/**
 * Finding a component by intent: the words a designer or an agent would use, not the name in the code.
 *
 * @remarks
 * Pure, and with no model: a lexical ranking is instant, works offline and gives the same answer twice, and an index of a
 * few hundred components is small enough for it. A component's name counts most, then the words its author declared
 * (`keywords` in the meta, the way to say "radio tile group" of `OptionCards`), then its title and its stories' text. A
 * short list of synonyms bridges the words designers and code use for the same thing (`searchMatch.ts`, which the
 * catalogue's text search reads too). The answer says which words matched, so an agent can tell a strong result from a
 * guess.
 *
 * @module
 */
import { wordsOf, worthOf } from "../searchMatch.ts";

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

/**
 * The components a query describes, best first.
 *
 * @param components - the catalogue's components.
 * @param query - what is being looked for, in any words.
 * @returns up to five; none when no word matches.
 */
export const findComponents = (components: readonly FindableComponent[], query: string): FoundComponent[] => {
  const words = wordsOf(query);
  return components
    .flatMap((component): FoundComponent[] => {
      const parts = partsOf(component);
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
    .toSorted((first, second) => second.score - first.score)
    .slice(0, LIMIT);
};
