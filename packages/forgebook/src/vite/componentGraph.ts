/**
 * A map of a project's components and tokens, for an agent to read instead of everything: what exists, what each is for,
 * what renders what and which tokens each file uses.
 *
 * @remarks
 * Generated from the source, so it cannot drift from it, and small on purpose: a list of names first, and a component's
 * neighbourhood or an intent's choices on request. A store of decisions written apart would be a second source of truth.
 *
 * @module
 */

import { join } from "node:path";

import type { UsageGuidance } from "../componentDocs.ts";
import { COLOR_CLASS, FONT_CLASS, RADIUS_CLASS, SPACE_CLASS } from "./appAudit.ts";
import { smallFileText } from "./appTokenFiles.ts";
import { readAppTokens } from "./appTokens.ts";
import { currentComponents } from "./componentCache.ts";
import type { ComponentIntent, ComponentRules } from "./componentRules.ts";
import type { ScannedComponent } from "./componentScan.ts";
import type { DesignToken } from "./designTokens.ts";
import { plainWords } from "./sourceText.ts";

/** A component in the map. */
export type GraphComponent = {
  /** Its name. */
  readonly name: string;
  /** Where it is, `file:line`. */
  readonly at: string;
  /** When to use it and when not. */
  readonly guidance?: UsageGuidance;
  /** How it is chosen and how it fits. */
  readonly rules?: ComponentRules;
  /** The project's components it renders. */
  readonly renders: readonly string[];
  /** How many of the project's components render it. */
  readonly usedBy: number;
};

/** A component in detail, with those around it. */
export type GraphDetail = GraphComponent & {
  /** The components that render it. */
  readonly renderedBy: readonly string[];
  /** The tokens its file uses. */
  readonly tokens: readonly string[];
  /** Where else a component of this name is: `usedBy` counts them together. */
  readonly alsoAt: readonly string[];
};

/** The map. */
export type GraphDocument = {
  /** The shape's version. */
  readonly schema: 1;
  /** How many components there are, whatever the answer lists. */
  readonly total: number;
  /** The components, those with something to say first. */
  readonly components: readonly GraphComponent[];
  /** The choices for each situation, by what it is called. */
  readonly intents: Readonly<Record<string, readonly (ComponentIntent & { readonly component: string })[]>>;
  /** The tokens known, by type, and how many of each. */
  readonly tokens: Readonly<Record<string, number>>;
  /** The one asked about, in detail. */
  readonly detail?: GraphDetail;
  /** What could not be read. */
  readonly notes: readonly string[];
};

/** What is asked of the map. */
export type GraphQuestion = {
  /** A component to give in detail. */
  readonly component?: string | undefined;
  /** An intent to list only the choices of. */
  readonly intent?: string | undefined;
  /** How many components to list. */
  readonly limit?: number | undefined;
};

/** How many components a map lists unless asked otherwise: an agent degrades on long answers. */
const LIMIT = 100;

/** How much of what an author wrote the map repeats, for each thing. */
const LONGEST_WORDS = 200;

/** How many things of a kind (situations, choices) the map gives. */
const MOST_WORDS = 20;

/** A custom property a file uses. */
const VAR_USE = /var\(\s*(--[\w-]+)/g;

/** What an author wrote, as data and short. */
const plainGuidance = (guidance: UsageGuidance): UsageGuidance => {
  const plain = (text: string): string => plainWords(text, LONGEST_WORDS);
  const list = (texts: readonly string[] | undefined): readonly string[] | undefined =>
    texts?.slice(0, MOST_WORDS).map(plain);
  const { useWhen, avoidWhen, alternatives, deprecated, replacedBy } = guidance;
  const [when, avoid, others] = [list(useWhen), list(avoidWhen), list(alternatives)];
  return {
    ...(when === undefined ? {} : { useWhen: when }),
    ...(avoid === undefined ? {} : { avoidWhen: avoid }),
    ...(others === undefined ? {} : { alternatives: others }),
    ...(deprecated === undefined ? {} : { deprecated: plain(deprecated) }),
    ...(replacedBy === undefined ? {} : { replacedBy: plain(replacedBy) })
  };
};

/** A component in the map's short form. */
const shortForm = (
  each: ScannedComponent,
  usedBy: ReadonlyMap<string, readonly string[]>,
  known: ReadonlySet<string>
): GraphComponent => ({
  name: each.name,
  at: plainWords(`${each.file}:${each.line}`, LONGEST_WORDS),
  ...(each.guidance === undefined ? {} : { guidance: plainGuidance(each.guidance) }),
  ...(each.rules === undefined ? {} : { rules: each.rules }),
  renders: each.renders.filter((name) => known.has(name) && name !== each.name),
  usedBy: usedBy.get(each.name)?.length ?? 0
});

/** The tokens a component's file uses: by reference, and by the classes that write them. */
const tokensOfFile = (text: string, tokens: readonly DesignToken[]): string[] => {
  const names = new Set(tokens.map(({ name }) => name));
  const colors = new Map(
    tokens.flatMap(({ utility, name, type }) =>
      utility !== undefined && type === "color" ? [[utility, name] as const] : []
    )
  );
  const used = [...text.matchAll(VAR_USE)].flatMap((match) => match[1] ?? []);
  const classed = [
    ...[...text.matchAll(COLOR_CLASS)].flatMap((match) => colors.get(match[1] ?? "") ?? []),
    ...[...text.matchAll(SPACE_CLASS)].map((match) => `--spacing-${match[1] ?? ""}`),
    ...[...text.matchAll(RADIUS_CLASS)].map((match) => `--radius-${match[1] ?? ""}`),
    ...[...text.matchAll(FONT_CLASS)].map((match) => `--text-${match[1] ?? ""}`)
  ];
  return [...new Set([...used, ...classed])].filter((name) => names.has(name)).toSorted();
};

/** Which components render each, by name. */
const usersOf = (
  components: readonly ScannedComponent[],
  known: ReadonlySet<string>
): Map<string, string[]> => {
  const users = new Map<string, string[]>();
  for (const each of components) {
    for (const name of each.renders) {
      if (known.has(name) && name !== each.name) users.set(name, [...(users.get(name) ?? []), each.name]);
    }
  }
  return users;
};

/** The choices for each situation, by what it is called; a Map, since an author may call one `constructor`. */
const intentsOf = (
  components: readonly ScannedComponent[]
): Map<string, (ComponentIntent & { component: string })[]> => {
  const intents = new Map<string, (ComponentIntent & { component: string })[]>();
  for (const each of components) {
    for (const intent of each.rules?.intents ?? []) {
      intents.set(intent.id, [...(intents.get(intent.id) ?? []), { ...intent, component: each.name }]);
    }
  }
  return intents;
};

/** How many tokens of each type. */
const countsOf = (tokens: readonly DesignToken[]): Record<string, number> => {
  const types: Record<string, number> = {};
  for (const { type } of tokens) types[type] = (types[type] ?? 0) + 1;
  return types;
};

/**
 * The map of a project.
 *
 * @param dir - its folder.
 * @param question - what is asked.
 */
export const graphDocument = (dir: string, question: GraphQuestion): GraphDocument => {
  const notes: string[] = [];
  const everything = currentComponents(dir, notes);
  const components = everything.filter((each) => each.isExported);
  const { tokens, unread } = readAppTokens(dir);
  const known = new Set(components.map(({ name }) => name));
  const usedBy = usersOf(everything, known);
  const intents = intentsOf(components);
  const uses = (name: string): number => usedBy.get(name)?.length ?? 0;
  const isSilent = (each: ScannedComponent): number =>
    Number(each.rules === undefined && each.guidance === undefined);
  const choices = new Set((intents.get(question.intent ?? "") ?? []).map(({ component }) => component));
  const listed = (
    question.intent === undefined ? components : components.filter((each) => choices.has(each.name))
  )
    .toSorted((first, second) => isSilent(first) - isSilent(second) || uses(second.name) - uses(first.name))
    .slice(0, question.limit ?? LIMIT)
    .map((each) => shortForm(each, usedBy, known));
  const asked = components.find((each) => each.name === question.component);
  return {
    schema: 1,
    total: components.length,
    components: listed,
    intents: Object.fromEntries(
      (question.intent === undefined
        ? [...intents].slice(0, question.limit ?? LIMIT)
        : [[question.intent, intents.get(question.intent) ?? []] as const]
      ).map(([id, list]) => [id, list.slice(0, question.limit ?? LIMIT)])
    ),
    tokens: countsOf(tokens),
    ...(asked === undefined
      ? {}
      : {
          detail: {
            ...shortForm(asked, usedBy, known),
            renderedBy: usedBy.get(asked.name) ?? [],
            tokens: tokensOfFile(smallFileText(join(dir, asked.file)) ?? "", tokens),
            alsoAt: components
              .filter((each) => each.name === asked.name && each !== asked)
              .map(({ file, line }) => `${file}:${line}`)
          }
        }),
    notes: [...notes, ...unread]
  };
};
