/**
 * The logic of `forgebook-texts`: the keys the stories use, read from their source, set against the package's locale
 * files.
 *
 * @remarks
 * A story names a text with a string literal, `text("key")` (from `useStoryText()` or `context.text`) or
 * `storyText("key")` in its args, so every key is found in the source without running it; a key built at run time is not seen, which the format forbids. Pure:
 * texts in, report out.
 *
 * @module
 */
import type { StoryTextsReport, UntranslatedText } from "./storyTextsReport.types.ts";

/** A call naming a text with a literal key: `text("key")`, `text('key', …)` or an arg's `storyText("key")`. */
const TEXT_CALL = /\b(?:text|storyText)\(\s*(["'])([^"'\\]+)\1/g;

/**
 * The keys a source text uses.
 *
 * @param source - a story file's or a fixture's text.
 */
export const usedKeys = (source: string): string[] =>
  [...source.matchAll(TEXT_CALL)].map((match) => match[2] ?? "");

/**
 * The report of a package's story texts.
 *
 * @param sources - the text of every story file and fixture.
 * @param locales - the locale files by language id; `en` is the one every key is in.
 */
export const storyTextsReport = (
  sources: readonly string[],
  locales: Readonly<Record<string, Readonly<Record<string, string>>>>
): StoryTextsReport => {
  const used = new Set(sources.flatMap(usedKeys));
  const base = locales["en"] ?? {};
  const untranslated: Record<string, UntranslatedText[]> = {};
  for (const [language, table] of Object.entries(locales)) {
    if (language === "en") continue;
    untranslated[language] = Object.entries(base)
      .filter(([key]) => table[key] === undefined)
      .map(([key, text]) => ({ key, text }));
  }
  return {
    used: used.size,
    missing: [...used].filter((key) => base[key] === undefined).sort(),
    unused: Object.keys(base)
      .filter((key) => !used.has(key))
      .sort(),
    untranslated
  };
};
