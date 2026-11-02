/**
 * The search index: what the search reads that the page does not already hold, as the plugin builds it for each group of
 * story files and docs pages, and the shell loads on the first search.
 *
 * @remarks
 * The names, keywords and stories are in the tree the sidebar draws, so the index leaves them out and holds only what
 * would otherwise take opening every component: the props, the descriptions and the text of the documentation. It
 * crosses from the plugin to the page as data, so it is checked on arrival (`isSearchIndex`). Pure.
 *
 * @module
 */

/** A stretch of documentation: the text under one heading, or before the first. */
export type SearchSection = {
  /** The heading's anchor; none for the text before the first heading. */
  readonly anchor?: string;
  /** The heading's text, without marks. */
  readonly heading?: string;
  /** The text, plain, without its marks. */
  readonly text: string;
};

/** A prop, an event or a hook's parameter of a component. */
export type SearchProp = {
  /** Its name. */
  readonly name: string;
  /** What it does; empty when its TSDoc does not say. */
  readonly text: string;
  /** The part it belongs to (the meta's `subcomponents`); none for the component's own. */
  readonly part?: string;
  /** Whether it is an event, listed under the Events heading. */
  readonly isEvent?: boolean;
};

/** What the search reads of a component beyond the tree. */
export type SearchComponent = {
  /** What it is: its file's summary, its TSDoc and when to use it. */
  readonly lead?: string;
  /** Its props, events and parameters. */
  readonly props?: readonly SearchProp[];
  /** Its documentation file, by heading. */
  readonly sections?: readonly SearchSection[];
};

/** A group's index: its components by story file, its docs pages by file. */
export type SearchIndex = {
  /** The components, keyed as the group's files are. */
  readonly components?: Readonly<Record<string, SearchComponent>>;
  /** The docs pages' text by heading, keyed as the group's pages are. */
  readonly pages?: Readonly<Record<string, readonly SearchSection[]>>;
  /** What could not be read: the rest of the index still works. */
  readonly problems?: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is left out or a text. */
const isOptionalText = (value: unknown): boolean => value === undefined || typeof value === "string";

/** Whether a value is a stretch of documentation. */
const isSection = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value["text"] === "string" &&
  isOptionalText(value["anchor"]) &&
  isOptionalText(value["heading"]);

/** Whether a value is left out or a list of stretches of documentation. */
const isOptionalSections = (value: unknown): boolean =>
  value === undefined || (Array.isArray(value) && value.every(isSection));

/** Whether a value is a prop of a component. */
const isProp = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  typeof value["text"] === "string" &&
  isOptionalText(value["part"]) &&
  (value["isEvent"] === undefined || typeof value["isEvent"] === "boolean");

/** Whether a value is what the search reads of a component. */
const isComponent = (value: unknown): boolean =>
  isRecord(value) &&
  isOptionalText(value["lead"]) &&
  isOptionalSections(value["sections"]) &&
  (value["props"] === undefined || (Array.isArray(value["props"]) && value["props"].every(isProp)));

/**
 * Whether a value is a group's index: what its loader gives is unchecked data.
 *
 * @param value - what the loader gave.
 */
export const isSearchIndex = (value: unknown): value is SearchIndex =>
  isRecord(value) &&
  (value["components"] === undefined ||
    (isRecord(value["components"]) && Object.values(value["components"]).every(isComponent))) &&
  (value["pages"] === undefined ||
    (isRecord(value["pages"]) && Object.values(value["pages"]).every(isOptionalSections))) &&
  (value["problems"] === undefined ||
    (Array.isArray(value["problems"]) && value["problems"].every((problem) => typeof problem === "string")));

/**
 * Several groups' indexes as one: the keys are unique across a source's groups.
 *
 * @param indexes - the indexes.
 */
export const mergedSearchIndex = (indexes: readonly SearchIndex[]): SearchIndex => ({
  components: Object.assign({}, ...indexes.map((index) => index.components)),
  pages: Object.assign({}, ...indexes.map((index) => index.pages)),
  problems: indexes.flatMap((index) => index.problems ?? [])
});
