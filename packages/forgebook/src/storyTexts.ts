/**
 * The texts the stories are drawn with in the shown language: the source's English table with the language's own
 * over it, or the English pseudo-translated for a pseudo-language.
 *
 * @remarks
 * English is the table every key is in (`stories/locales/en.json`); a language that lacks a key shows the English
 * one, so a story is never empty while a translation is under way. An arg written `storyText("key")` becomes the text
 * of its key before the story receives it. A language a source gives as a loader is loaded when it is shown, and only
 * then. Pure apart from those loaders.
 *
 * @module
 */
import type { StoryLanguage, StorySource, StoryTexts } from "@forgebook/story-format/source";
import { isStoryTextArg, type StoryTextFunction, type StoryTextTable } from "@forgebook/story-format/texts";

/** The language every key is in. */
export const BASE_LANGUAGE = "en";

/** The letters a pseudo-translation swaps for an accented look-alike. */
const ACCENTED: Readonly<Record<string, string>> = {
  a: "å",
  c: "ç",
  e: "é",
  i: "î",
  n: "ñ",
  o: "ö",
  s: "š",
  u: "û",
  y: "ý",
  A: "Å",
  C: "Ç",
  E: "É",
  I: "Î",
  N: "Ñ",
  O: "Ö",
  S: "Š",
  U: "Û"
};

/**
 * A text pseudo-translated: accented, about a third longer, in brackets, its `{name}` placeholders untouched; it shows
 * a text written outside the tables, one cut too short, or one put together from pieces.
 *
 * @param text - an English text.
 */
export const pseudoText = (text: string): string => {
  const accented = text
    .split(/(\{\w+\})/)
    .map((part) =>
      part.startsWith("{") ? part : [...part].map((letter) => ACCENTED[letter] ?? letter).join("")
    )
    .join("");
  const padding = "·".repeat(Math.ceil(text.length / 3));
  return `[${accented}${padding}]`;
};

/**
 * A language's table, its loader awaited when the source gives one; empty for a language it has no texts in.
 *
 * @param texts - the language's texts in the source.
 */
export const textTable = async (texts: StoryTexts | undefined): Promise<StoryTextTable> => {
  if (texts === undefined) return {};
  return typeof texts === "function" ? (await texts()).default : texts;
};

/**
 * Reads the texts of a language: the work of `shownTexts`, each time anew.
 *
 * @param texts - the source's tables or their loaders, by language id; none when the source has none.
 * @param language - the shown language, when one is chosen; none for the stories' own (English).
 */
const readShownTexts = async (
  texts: StorySource["texts"],
  language: StoryLanguage | undefined
): Promise<StoryTextTable> => {
  // both at once: the shown language's table does not wait for English's
  const shown = language === undefined || language.isPseudo === true ? undefined : texts?.[language.id];
  const [base, own] = await Promise.all([textTable(texts?.[BASE_LANGUAGE]), textTable(shown)]);
  if (language === undefined) return base;
  if (language.isPseudo === true) {
    return Object.fromEntries(Object.entries(base).map(([key, text]) => [key, pseudoText(text)]));
  }
  return { ...base, ...own };
};

/** What stands for a source with no texts among the tables kept: a key of its own, never a source's. */
const NO_TEXTS: object = {};

/** The tables already read, by the source's texts and then by language, so a language shown again is the same table. */
const shownTables = new WeakMap<object, Map<string, Promise<StoryTextTable>>>();

/**
 * The texts of the shown language: the same table, the same object, for as long as the language and the source's
 * texts stay the same, whatever else of the view changes (a theme, a width), so what a story derives from it (a
 * text function a memo is keyed on) changes only with the language. A table whose loader failed is read again the
 * next time it is asked for.
 *
 * @param texts - the source's tables or their loaders, by language id; none when the source has none.
 * @param language - the shown language, when one is chosen; none for the stories' own (English).
 */
export const shownTexts = (
  texts: StorySource["texts"],
  language: StoryLanguage | undefined
): Promise<StoryTextTable> => {
  const holder = texts ?? NO_TEXTS;
  const byLanguage = shownTables.get(holder) ?? new Map<string, Promise<StoryTextTable>>();
  shownTables.set(holder, byLanguage);
  const key = language === undefined ? "" : `${language.id}${language.isPseudo === true ? " pseudo" : ""}`;
  const known = byLanguage.get(key);
  if (known !== undefined) return known;
  const read = readShownTexts(texts, language);
  byLanguage.set(key, read);
  read.catch(() => byLanguage.delete(key));
  return read;
};

/**
 * A story's args with each `storyText("key")` turned into the text in the shown language, as the story receives them.
 *
 * @param args - the story's args.
 * @param text - the text function of the shown language.
 */
export const withStoryTexts = (
  args: Readonly<Record<string, unknown>>,
  text: StoryTextFunction
): Readonly<Record<string, unknown>> =>
  Object.values(args).some(isStoryTextArg)
    ? Object.fromEntries(
        Object.entries(args).map(([name, value]) => [
          name,
          isStoryTextArg(value) ? text(value.storyText, value.values) : value
        ])
      )
    : args;

/**
 * The args that name a text, with their keys: the panel shows the key beside the text.
 *
 * @param args - the story's args.
 */
export const storyTextKeysOf = (args: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(args).flatMap(([name, value]): [string, string][] =>
      isStoryTextArg(value) ? [[name, value.storyText]] : []
    )
  );
