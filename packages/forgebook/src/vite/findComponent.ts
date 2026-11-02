/**
 * Finding a component by intent: the words a designer or an agent would use, not the name in the code.
 *
 * @remarks
 * Pure, and with no model: a lexical ranking is instant, works offline and gives the same answer twice, and an index of a
 * few hundred components is small enough for it. A component's name counts most, then the words its author declared
 * (`keywords` in the meta, the way to say "radio tile group" of `OptionCards`), then its title and its stories' text. A
 * short list of synonyms bridges the words designers and code use for the same thing. The answer says which words
 * matched, so an agent can tell a strong result from a guess.
 *
 * @module
 */

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

/** How much a word counts, by where it is found. */
const WEIGHTS = { name: 8, keyword: 6, title: 3, story: 1 } as const;

/** What a match by a word's start costs against the word itself, so `card` finds `Card` before `OptionCards`. */
const STARTING_COST = 0.5;

/** Which of a component's texts each place reads. */
const PLACES = { name: "name", keyword: "keywords", title: "title", story: "stories" } as const;

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

/** A text's words, lower case. */
const wordsOf = (text: string): string[] =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");

/** A word and the ones it means, its plural taken off. */
const variants = (word: string): readonly string[] => {
  const singular = word.length > MIN_PREFIX && word.endsWith("s") ? word.slice(0, -1) : word;
  return [...new Set([word, singular, ...SYNONYMS.filter((group) => group.includes(singular)).flat()])];
};

/** How a text holds a word: as it is, by its start, which counts a little less, or not at all. */
const heldAs = (
  words: readonly string[],
  asked: string,
  meanings: readonly string[]
): "exact" | "start" | undefined => {
  if (words.some((word) => meanings.includes(word))) return "exact";
  const canStart = asked.length >= MIN_PREFIX;
  return canStart && words.some((word) => word.startsWith(asked)) ? "start" : undefined;
};

/** A word's worth in a component: where it counts most; nothing when it is not there. */
const worth = (component: Parts, word: string): number => {
  const meanings = variants(word);
  const singular = word.length > MIN_PREFIX && word.endsWith("s") ? word.slice(0, -1) : word;
  for (const place of ["name", "keyword", "title", "story"] as const) {
    const found = heldAs(component[PLACES[place]], singular, meanings);
    if (found === "exact") return WEIGHTS[place];
    if (found === "start") return WEIGHTS[place] - STARTING_COST;
  }
  return 0;
};

/** A component's words, by where they are. */
type Parts = {
  readonly name: readonly string[];
  readonly keywords: readonly string[];
  readonly title: readonly string[];
  readonly stories: readonly string[];
};

/** A component's words. */
const partsOf = (component: FindableComponent): Parts => ({
  name: wordsOf(component.title.split("/").at(-1) ?? ""),
  keywords: component.keywords.flatMap(wordsOf),
  title: wordsOf(component.title),
  stories: component.stories.flatMap(wordsOf)
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
      const scores = words.map((word) => ({ word, score: worth(parts, word) }));
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
