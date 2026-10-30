/**
 * The texts inside the stories (a card's title, a row's sample name), in the language the catalogue shows: a story
 * names a text by its key, and the package's locale files hold the words (`stories/locales/en.json`, `it.json`, …).
 *
 * @remarks
 * The catalogue provides the texts of the shown language, English where a language lacks a key; a story reads them
 * with `context.text()` in a render or a play function, or a framework's own access in a component (`useStoryText()`
 * in `@forgebook/react/texts`), and an
 * arg names one with `storyText("key")`: args are plain data, written before any language is known, so the catalogue
 * gives the story the text in the shown language and the props panel shows it with its key. A key is written as a
 * plain string literal (`text("skeleton.dashboard.title")`, `storyText("button.save")`), so `forgebook-texts` can find
 * every key the stories use. Values may hold `{name}` placeholders, filled from the second argument. Without a provider (a test
 * rendering a story on its own) a text is its key in brackets, never an empty string.
 *
 * @module
 */
/** One language's texts, by key. */
export type StoryTextTable = Readonly<Record<string, string>>;

/** The values a text's `{name}` placeholders take. */
export type StoryTextValues = Readonly<Record<string, string | number>>;

/** Gives the text of a key in the shown language, its placeholders filled. */
export type StoryTextFunction = (key: string, values?: StoryTextValues) => string;

/**
 * A text with its `{name}` placeholders filled; a placeholder without a value stays as it is.
 *
 * @param text - the text.
 * @param values - the placeholders' values; none by default.
 */
export const filledText = (text: string, values: StoryTextValues = {}): string =>
  text.replace(/\{(\w+)\}/g, (placeholder: string, name: string): string => {
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });

/**
 * The text function over a table: a key the table lacks is the key in brackets, so a missing text shows.
 *
 * @param table - the texts of the shown language, English filled in.
 */
export const storyTextOf =
  (table: StoryTextTable): StoryTextFunction =>
  (key: string, values?: StoryTextValues): string => {
    const text = table[key];
    return text === undefined ? `[${key}]` : filledText(text, values);
  };

/** An arg that names a text: the story receives the text of the key in the shown language, its placeholders filled. */
export type StoryTextArg = {
  /** The text's key. */
  readonly storyText: string;
  /** The values of its `{name}` placeholders; none by default. */
  readonly values?: StoryTextValues;
};

/**
 * An arg that names a text, for a prop that takes one: `args: { children: storyText("button.save") }`.
 *
 * @param key - the text's key, a plain string literal.
 * @param values - the values of its `{name}` placeholders; none by default.
 */
export const storyText = (key: string, values?: StoryTextValues): StoryTextArg =>
  values === undefined ? { storyText: key } : { storyText: key, values };

/**
 * Whether an arg names a text.
 *
 * @param value - a story's arg.
 */
export const isStoryTextArg = (value: unknown): value is StoryTextArg =>
  typeof value === "object" && value !== null && "storyText" in value && typeof value.storyText === "string";
