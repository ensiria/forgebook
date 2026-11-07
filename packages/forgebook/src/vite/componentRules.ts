/**
 * How a design system says to choose among its components and how they fit together, in a few TSDoc tags or a file beside
 * the component. Whoever keeps a design system should not have to learn a language for this.
 *
 * @remarks
 * Pure. Each tag is one line a person can read without knowing Forgebook:
 *
 * ```ts
 * /**
 *  * Pick one of a few options, all in view.
 *  *
 *  * \@intent choose-one: up to five options, all visible
 *  * \@parent Form, Fieldset
 *  * \@children Radio
 *  * \@insteadOf select
 *  *\/
 * ```
 *
 * Components sharing an intent are the choices for it, and each one's text says when it is the right one. A file beside the
 * component (`RadioGroup.rules.json`) says the same for one that cannot carry a comment, keyed by the component's name:
 * `{ "RadioGroup": { "intent": ["choose-one: up to five options"], "parent": ["Form"] } }`.
 *
 * @module
 */
import { plainWords } from "./sourceText.ts";
import type { DocTag } from "./usageGuidance.ts";

/** A situation a component answers. */
export type ComponentIntent = {
  /** What it is for, in the words of whoever wrote it: components sharing it are the choices for it. */
  readonly id: string;
  /** When this one is the right one. */
  readonly when?: string;
};

/** How a component is chosen and how it fits with others. */
export type ComponentRules = {
  /** The situations it answers. */
  readonly intents?: readonly ComponentIntent[];
  /** What it may stand inside, at any depth; none for anywhere. */
  readonly parents?: readonly string[];
  /** What may stand directly inside it; none for anything. */
  readonly children?: readonly string[];
  /** What may stand beside it; none for anything. */
  readonly siblings?: readonly string[];
  /** The plain elements it stands in for: writing one by hand is a mistake. */
  readonly insteadOf?: readonly string[];
};

/** An intent's name: words a person chose, with dashes for its spaces. */
const INTENT_NAME = /^[\w-]{1,60}$/;

/** How much of an intent an answer repeats. */
const LONGEST_INTENT = 260;

/** How many names one rule holds. */
const MOST_NAMES = 12;

/** A component's or an element's name, and no more: these reach an agent as its next step. */
const NAME = /^[A-Za-z][\w.-]{0,80}$/;

/** A list of names, keeping only what is a name. */
const namesOf = (written: readonly string[]): string[] =>
  written
    .flatMap((each) => each.split(/,|\s+or\s+/))
    .map((each) => each.replaceAll("`", "").trim())
    .filter((each) => NAME.test(each))
    .slice(0, MOST_NAMES);

/** The intents written, keeping only what reads as one. */
const intentsOf = (written: readonly string[]): ComponentIntent[] =>
  written.flatMap((each) => {
    const text = plainWords(each, LONGEST_INTENT).trim();
    const colon = text.indexOf(":");
    const name = (colon === -1 ? text : text.slice(0, colon)).trim().replaceAll(/\s+/g, "-");
    const when = colon === -1 ? "" : text.slice(colon + 1).trim();
    if (!INTENT_NAME.test(name)) return [];
    return [{ id: name, ...(when === "" ? {} : { when }) }];
  });

/** Rules with what is empty left out, so most components carry nothing. */
const compact = (lists: {
  readonly intents: readonly ComponentIntent[];
  readonly parents: readonly string[];
  readonly children: readonly string[];
  readonly siblings: readonly string[];
  readonly insteadOf: readonly string[];
}): ComponentRules | undefined => {
  const rules = Object.fromEntries(Object.entries(lists).filter(([, list]) => list.length > 0));
  return Object.keys(rules).length === 0 ? undefined : rules;
};

/**
 * A component's rules, from its tags.
 *
 * @param tags - its TSDoc tags.
 */
export const rulesOfTags = (tags: readonly DocTag[]): ComponentRules | undefined => {
  const textsOf = (name: string): string[] => tags.filter((tag) => tag.name === name).map((tag) => tag.text);
  return compact({
    intents: intentsOf(textsOf("intent")),
    parents: namesOf(textsOf("parent")),
    children: namesOf(textsOf("children")),
    siblings: namesOf(textsOf("siblings")),
    insteadOf: namesOf(textsOf("insteadOf"))
  });
};

/** A field of a rules file as a list of strings. */
const textList = (fields: ReadonlyMap<string, unknown>, key: string): string[] => {
  const value = fields.get(key);
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((each) => typeof each === "string") : [];
};

/**
 * What a rules file says, by component, read as data: one that cannot be read says nothing.
 *
 * @param text - the file's text.
 */
export const rulesOfFile = (text: string): ReadonlyMap<string, ComponentRules> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Map();
  }
  if (typeof parsed !== "object" || parsed === null) return new Map();
  return new Map(
    Object.entries(parsed).flatMap(([name, written]): [string, ComponentRules][] => {
      if (typeof written !== "object" || written === null) return [];
      const fields = new Map(Object.entries(written));
      const rules = compact({
        intents: intentsOf([...textList(fields, "intent"), ...textList(fields, "intents")]),
        parents: namesOf([...textList(fields, "parent"), ...textList(fields, "parents")]),
        children: namesOf(textList(fields, "children")),
        siblings: namesOf(textList(fields, "siblings")),
        insteadOf: namesOf(textList(fields, "insteadOf"))
      });
      return rules === undefined ? [] : [[name, rules]];
    })
  );
};
