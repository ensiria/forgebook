/**
 * The catalogue's search across everything: components, stories, docs pages, props and the text of the documentation,
 * ranked as `forgebook find` ranks, so a person and an agent asking the same words get the same answer.
 *
 * @remarks
 * A page or a component is one result, and what matched inside it are its hits: a person looks for a place first and a
 * line second, and a word found in a component's name and another in one of its stories is one good answer, not two
 * half ones. A word is worth what it is worth where it counts most in the result (`searchMatch.ts`), so the ranking is
 * `findComponents`' with more places. A result that holds every word comes before one that does not, which says what it
 * missed. Everything is read from the tree and the index (`searchIndex.ts`), with no server, so the same code answers
 * in the page and on the dev server. Pure.
 *
 * @module
 */

import { propAnchor } from "./docAnchors.ts";
import type { TreePage } from "./pageTree.ts";
import type { SearchComponent, SearchIndex, SearchSection } from "./searchIndex.ts";
import { type MarkedQuery, type MarkedText, markedText, snippetOf } from "./searchMarks.ts";
import {
  foldedText,
  meaningsOf,
  type SearchPlace,
  WEIGHTS,
  wordMatch,
  wordsOf,
  worthOf
} from "./searchMatch.ts";
import { componentId, type StoryTree, type TreeComponent, type TreeSource } from "./storyTree.ts";

/** Where a result or a hit goes: a page of the catalogue, at a heading or a prop when it has one. */
export type SearchTarget =
  | ComponentTarget
  | PageTarget
  | {
      /** A story's page. */
      readonly kind: "story";
      /** Its id. */
      readonly id: string;
    };

/** A component's page, at a heading or a prop when it has one. */
export type ComponentTarget = {
  /** What it is. */
  readonly kind: "component";
  /** Its id. */
  readonly id: string;
  /** The heading or the prop it opens at. */
  readonly anchor?: string;
};

/** A docs page, at a heading when it has one. */
export type PageTarget = {
  /** What it is. */
  readonly kind: "page";
  /** Its id. */
  readonly id: string;
  /** The heading it opens at. */
  readonly anchor?: string;
};

/** What a line of a result is: a kind of thing a word can be found in. */
export type SearchHitKind = "description" | "story" | "prop" | "event" | "heading" | "text";

/** Why a result's own name is there: where in its name, words or place a word of the query is. */
export type SearchReason = {
  /** Where it is. */
  readonly place: "name" | "keyword" | "title";
  /** What stands there, when it is another word for the one asked (`modal` finding `dialog`). */
  readonly means?: string;
};

/** A line of a result: something inside it that matched. */
export type SearchHit = {
  /** What it is. */
  readonly kind: SearchHitKind;
  /** Its name, marked: the prop, the story, the heading; none for plain text. */
  readonly label?: readonly MarkedText[];
  /** The text around the match, marked. */
  readonly snippet: readonly MarkedText[];
  /** Where it goes. */
  readonly target: SearchTarget;
};

/** A result: a component or a docs page. */
export type SearchResult = {
  /** What it is. */
  readonly kind: "component" | "page";
  /** Where it goes. */
  readonly target: ComponentTarget | PageTarget;
  /** Its name, marked. */
  readonly name: readonly MarkedText[];
  /** Where it sits: its source and its place. */
  readonly place: string;
  /** How well it matches: higher is better, only comparable within an answer. */
  readonly score: number;
  /** The words of the query it holds. */
  readonly matched: readonly string[];
  /** The words of the query it does not. */
  readonly missed: readonly string[];
  /** Why its name is there; none when only what is inside it matched. */
  readonly reasons: readonly SearchReason[];
  /** The best of what matched inside it. */
  readonly hits: readonly SearchHit[];
  /** How many things inside it matched, those not listed included. */
  readonly hitCount: number;
};

/** An answer. */
export type SearchAnswer = {
  /** The results, best first. */
  readonly results: readonly SearchResult[];
  /** How many there are, those past the limit included. */
  readonly total: number;
};

/** How much of an answer to give. */
export type SearchLimits = {
  /** How many results. */
  readonly results: number;
  /** How many hits of each. */
  readonly hits: number;
};

/** What the search reads of something inside a result. */
type Field = {
  /** What it is. */
  readonly kind: SearchHitKind | SearchReason["place"];
  /** Its name; none for plain text. */
  readonly label: string | undefined;
  /** Its text. */
  readonly text: string;
  /** Its name's words. */
  readonly labelWords: readonly string[];
  /** Its text's words. */
  readonly textWords: readonly string[];
  /** Its name's and its text's words in order, each between spaces, as the words of a query are looked for in them. */
  readonly sentences: readonly string[];
  /** Where it goes. */
  readonly target: SearchTarget;
};

/** A component or a docs page, read for the search. */
export type Searchable = {
  /** What it is. */
  readonly kind: SearchResult["kind"];
  /** Where it goes. */
  readonly target: SearchResult["target"];
  /** Its name. */
  readonly name: string;
  /** Where it sits. */
  readonly place: string;
  /** What is in it. */
  readonly fields: readonly Field[];
  /** Its words, by where they are. */
  readonly parts: Partial<Record<SearchPlace, readonly string[]>>;
};

/** Where the words of a field's name count. */
const LABEL_PLACE: Record<Field["kind"], SearchPlace> = {
  name: "name",
  keyword: "keyword",
  title: "title",
  description: "description",
  story: "story",
  prop: "prop",
  event: "prop",
  heading: "heading",
  text: "text"
};

/** Where the words of a field's text count. */
const TEXT_PLACE: Record<Field["kind"], SearchPlace> = {
  ...LABEL_PLACE,
  prop: "description",
  event: "description",
  heading: "text"
};

/** A name's words, and the name as one word: `onvalue` starts `onValueChange`. */
const labelWordsOf = (label: string): readonly string[] => [
  ...new Set([...wordsOf(label), foldedText(label).replace(/[^\p{L}\p{N}]+/gu, "")])
];

/** A text's words in order, each between spaces: `art button` must not be found in `smart buttons`. */
const sentenceOf = (text: string): string => ` ${wordsOf(text).join(" ")} `;

/** A field. */
const fieldOf = (
  kind: Field["kind"],
  label: string | undefined,
  written: string,
  target: SearchTarget
): Field => {
  // a TSDoc's backticks are marks, which a line of results does not draw
  const text = written.replaceAll("`", "");
  return {
    kind,
    label,
    text,
    labelWords: label === undefined ? [] : labelWordsOf(label),
    textWords: [...new Set(wordsOf(text))],
    sentences: [sentenceOf(label ?? ""), sentenceOf(text)],
    target
  };
};

/** A thing's words, by where they are. */
const partsOf = (fields: readonly Field[]): Searchable["parts"] => {
  const parts = new Map<SearchPlace, Set<string>>();
  const add = (place: SearchPlace, words: readonly string[]): void => {
    const known = parts.get(place) ?? new Set();
    for (const word of words) known.add(word);
    parts.set(place, known);
  };
  for (const field of fields) {
    add(LABEL_PLACE[field.kind], field.labelWords);
    add(TEXT_PLACE[field.kind], field.textWords);
  }
  return Object.fromEntries([...parts].map(([place, words]) => [place, [...words]]));
};

/** A stretch of documentation as a field of what holds it. */
const sectionField = (section: SearchSection, target: ComponentTarget | PageTarget): Field => {
  const opened = section.anchor === undefined ? target : { ...target, anchor: section.anchor };
  return fieldOf(section.heading === undefined ? "text" : "heading", section.heading, section.text, opened);
};

/** What the search reads of a component. */
const componentFields = (
  component: TreeComponent,
  target: ComponentTarget,
  index: SearchComponent | undefined
): Field[] => [
  fieldOf("name", component.name, "", target),
  fieldOf("title", component.title.split("/").slice(0, -1).join(" "), "", target),
  ...component.keywords.map((keyword) => fieldOf("keyword", keyword, "", target)),
  ...(index?.lead === undefined ? [] : [fieldOf("description", undefined, index.lead, target)]),
  ...(index?.props ?? []).map(({ name, text, part, isEvent }) =>
    fieldOf(isEvent === true ? "event" : "prop", name, text, { ...target, anchor: propAnchor(name, part) })
  ),
  ...component.stories.map((story) =>
    fieldOf("story", story.name, story.description ?? "", { kind: "story", id: story.id })
  ),
  ...(index?.sections ?? []).map((section) => sectionField(section, target))
];

/** A component, read for the search. */
const searchableComponent = (
  source: TreeSource,
  familyName: string,
  groupName: string | undefined,
  component: TreeComponent,
  index: SearchIndex | undefined
): Searchable => {
  const target: ComponentTarget = { kind: "component", id: componentId(source.id, component.title) };
  const fields = componentFields(component, target, index?.components?.[component.file]);
  return {
    kind: "component",
    target,
    name: component.name,
    place: [source.name, familyName, groupName].filter((part) => part !== undefined).join(" · "),
    fields,
    parts: partsOf(fields)
  };
};

/** A docs page, read for the search. */
const searchablePage = (source: TreeSource, page: TreePage, index: SearchIndex | undefined): Searchable => {
  const target: PageTarget = { kind: "page", id: page.id };
  const sections = index?.pages?.[page.file] ?? [];
  const fields = [
    fieldOf("name", page.name, "", target),
    fieldOf("title", page.group ?? "", "", target),
    ...(page.description === undefined ? [] : [fieldOf("description", undefined, page.description, target)]),
    ...sections.map((section) => sectionField(section, target))
  ];
  return {
    kind: "page",
    target,
    name: page.name,
    place: [source.name, page.group].filter((part) => part !== undefined).join(" · "),
    fields,
    parts: partsOf(fields)
  };
};

/**
 * Everything the search can find in a catalogue.
 *
 * @param tree - the tree: names, keywords and stories, there from the first screen.
 * @param indexes - each source's index, by its id: what it adds is found once it is there.
 */
export const searchables = (
  tree: StoryTree,
  indexes: ReadonlyMap<string, SearchIndex>
): readonly Searchable[] =>
  tree.sources.flatMap((source) => {
    const index = indexes.get(source.id);
    return [
      ...source.pages.map((page) => searchablePage(source, page, index)),
      ...source.families.flatMap((family) =>
        family.groups.flatMap((group) =>
          group.components.map((component) =>
            searchableComponent(source, family.name, group.name, component, index)
          )
        )
      )
    ];
  });

/** The query, read. */
type Query = MarkedQuery & {
  /** Its words as a sentence (`sentenceOf`), when there are several: copied from a page, it finds that page first. */
  readonly sentence: string | undefined;
};

/** How much of a query must be there for a result to stand beside one that holds all of it. */
const NEAR_SHARE = 0.75;

/** The most of a query that is read: a page pasted by mistake must not hold the tab for seconds. */
export const MAX_QUERY = 200;

/** A query's words and phrase. */
const queryOf = (typed: string): Query => {
  const query = typed.slice(0, MAX_QUERY);
  const words = wordsOf(query);
  const isSeveral = words.length > 1;
  return {
    words: [...new Set(words)],
    phrase: isSeveral ? foldedText(query).replace(/\s+/g, " ").trim() : undefined,
    sentence: isSeveral ? sentenceOf(query) : undefined
  };
};

/** Whether some word of a list holds a word asked for. */
const isHeldIn = (words: readonly string[], word: string): boolean => {
  const meanings = meaningsOf(word);
  return words.some((held) => wordMatch(held, word, meanings) !== undefined);
};

/** A found thing, before its hits are worked out. */
type Scored = {
  /** The thing. */
  readonly found: Searchable;
  /** Its score. */
  readonly score: number;
  /** The words it holds. */
  readonly matched: readonly string[];
  /** The words it does not. */
  readonly missed: readonly string[];
};

/** Whether a field holds a query's sentence, in its name or its text. */
const holdsSentence = (field: Field, sentence: string | undefined): boolean =>
  sentence !== undefined && field.sentences.some((each) => each.includes(sentence));

/** How a thing answers the query; none when it holds no word of it. */
const scored = (found: Searchable, { words, sentence }: Query): Scored | undefined => {
  const worths = words.map((word) => ({ word, worth: worthOf(found.parts, word) }));
  const sum = worths.reduce((total, each) => total + each.worth, 0);
  if (sum === 0) return undefined;
  const hasPhrase = found.fields.some((field) => holdsSentence(field, sentence));
  return {
    found,
    score: sum + (hasPhrase ? WEIGHTS.name : 0),
    matched: worths.filter((each) => each.worth > 0).map((each) => each.word),
    missed: worths.filter((each) => each.worth === 0).map((each) => each.word)
  };
};

/** The word that stands in a text for one asked, when it is another word for it. */
const synonymIn = (words: readonly string[], asked: readonly string[]): string | undefined => {
  const meant = asked.flatMap((word) => {
    const meanings = meaningsOf(word);
    return words.find((held) => held !== word && meanings.includes(held) && !word.startsWith(held)) ?? [];
  });
  return meant[0];
};

/** Where a thing's name can say why it is there, the place that says most first. */
const REASON_PLACES: readonly SearchReason["place"][] = ["name", "keyword", "title"];

/** Why a thing's own name is there: each word answered once, where it counts most. */
const reasonsOf = ({ fields }: Searchable, words: readonly string[]): readonly SearchReason[] => {
  let open = words;
  return REASON_PLACES.flatMap((place) => {
    const labels = fields.filter((field) => field.kind === place).flatMap((field) => field.labelWords);
    const held = open.filter((word) => isHeldIn(labels, word));
    if (held.length === 0) return [];
    open = open.filter((word) => !held.includes(word));
    const means = synonymIn(labels, held);
    return [means === undefined ? { place } : { place, means }];
  });
};

/** A field that is a thing inside a result, not its own name. */
type InnerField = Field & { readonly kind: SearchHitKind };

/** Whether a field is a thing inside a result. */
const isInnerField = (field: Field): field is InnerField =>
  field.kind !== "name" && field.kind !== "keyword" && field.kind !== "title";

/** A field that matched, with what it holds. */
type HeldField = {
  /** The field. */
  readonly field: InnerField;
  /** Whether its name holds the most of the query: a line then says it is about the name, not its text. */
  readonly isInLabel: boolean;
  /** How many words it holds. */
  readonly count: number;
  /** What it counts for. */
  readonly worth: number;
  /** Whether it holds the query's phrase. */
  readonly hasPhrase: boolean;
};

/** A field as a line a result may show; none when it holds nothing. */
const heldField = (field: InnerField, { words, sentence }: Query): HeldField | undefined => {
  const inLabel = words.filter((word) => isHeldIn(field.labelWords, word));
  const inText = words.filter((word) => isHeldIn(field.textWords, word));
  const count = new Set([...inLabel, ...inText]).size;
  if (count === 0) return undefined;
  const isInLabel = inLabel.length > 0 && inLabel.length >= inText.length;
  return {
    field,
    isInLabel,
    count,
    worth: isInLabel ? WEIGHTS[LABEL_PLACE[field.kind]] : WEIGHTS[TEXT_PLACE[field.kind]],
    hasPhrase: holdsSentence(field, sentence)
  };
};

/** A field that matched as a line of its result. */
const hitOf = ({ field, isInLabel }: HeldField, query: Query): SearchHit => {
  const { kind, label, text, target } = field;
  return {
    kind: kind === "heading" && !isInLabel ? "text" : kind,
    ...(label === undefined ? {} : { label: markedText(label, query) }),
    snippet: snippetOf(text, query),
    target
  };
};

/** A thing with its hits, as a result. */
const resultOf = ({ found, score, matched, missed }: Scored, query: Query, limit: number): SearchResult => {
  const held = found.fields
    .filter(isInnerField)
    .flatMap((field) => heldField(field, query) ?? [])
    .toSorted(
      (first, second) =>
        Number(second.hasPhrase) - Number(first.hasPhrase) ||
        second.count - first.count ||
        second.worth - first.worth
    );
  return {
    kind: found.kind,
    target: found.target,
    name: markedText(found.name, query),
    place: found.place,
    score,
    matched,
    missed,
    reasons: reasonsOf(found, query.words),
    hits: held.slice(0, limit).map((each) => hitOf(each, query)),
    hitCount: held.length
  };
};

/**
 * What a query finds.
 *
 * @remarks
 * Where something holds every word, what holds much less is left out: `the` must not bring the whole catalogue along
 * with a sentence copied from a page. Nothing holding every word, the nearest are given, each saying what it missed.
 *
 * @param all - everything that can be found (`searchables`).
 * @param query - what was typed.
 * @param limits - how much of the answer to give.
 */
export const searchCatalogue = (
  all: readonly Searchable[],
  query: string,
  limits: SearchLimits
): SearchAnswer => {
  const read = queryOf(query);
  const found = all
    .flatMap((each) => scored(each, read) ?? [])
    .toSorted(
      (first, second) =>
        first.missed.length - second.missed.length ||
        second.score - first.score ||
        first.found.name.localeCompare(second.found.name)
    );
  const hasWhole = found.some((each) => each.missed.length === 0);
  const kept = found.filter((each) => !hasWhole || each.matched.length >= read.words.length * NEAR_SHARE);
  return {
    results: kept.slice(0, limits.results).map((each) => resultOf(each, read, limits.hits)),
    total: kept.length
  };
};
