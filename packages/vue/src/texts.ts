/**
 * The texts inside the stories for Vue components inside a story: the shown language's table, as the frame provides it,
 * read with `useStoryText()`.
 *
 * @remarks
 * The table and the text function are the format's (`@forgebook/story-format/texts`); this module is how a Vue
 * component reads them. The frame's renderer provides the table (`vueRenderer.ts`), as a ref, so a text read in a
 * render follows the language; outside a catalogue there is none, and a text is its key in brackets.
 *
 * @module
 */
import { type StoryTextFunction, type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";
import { type InjectionKey, inject, type Ref } from "vue";

/** What the frame provides: the texts of the shown language. */
export const STORY_TEXTS: InjectionKey<Readonly<Ref<StoryTextTable>>> = Symbol("forgebook story texts");

/**
 * The text function of the shown language, for a component inside a story.
 *
 * @returns `text(key, values?)`, reading the language when called, so a template using it follows a change.
 */
export const useStoryText = (): StoryTextFunction => {
  const provided = inject(STORY_TEXTS, undefined);
  return (...parameters: Parameters<StoryTextFunction>): string =>
    storyTextOf(provided?.value ?? {})(...parameters);
};
