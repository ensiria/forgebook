/**
 * The `--json` document of `forgebook-texts`: the keys the stories use, what is wrong with them, and what each language
 * still has to translate.
 *
 * @module
 */

/** A text one language still lacks: its key and the English to translate. */
export type UntranslatedText = {
  /** The key (`skeleton.dashboard.title`). */
  readonly key: string;
  /** The English text. */
  readonly text: string;
};

/** What `forgebook-texts` reports. */
export type StoryTextsReport = {
  /** How many keys the stories use. */
  readonly used: number;
  /** Keys a story uses that the English file lacks: the story would show the key. */
  readonly missing: readonly string[];
  /** Keys of the English file no story uses. */
  readonly unused: readonly string[];
  /** By language id (every file but English), the texts it lacks. */
  readonly untranslated: Readonly<Record<string, readonly UntranslatedText[]>>;
};
