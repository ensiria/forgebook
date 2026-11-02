/**
 * The texts inside the stories for Angular components inside a story: the shown language's table, as the frame provides
 * it, read with `injectStoryText()`.
 *
 * @remarks
 * The table and the text function are the format's (`@forgebook/story-format/texts`); this module is how an Angular
 * component reads them. The frame's renderer provides the table (`angularRenderer.ts`) as a signal, so a template that
 * calls the text function follows the language; outside a catalogue there is none, and a text is its key in brackets.
 *
 * @module
 */

import { InjectionToken, inject, type Signal } from "@angular/core";
import { type StoryTextFunction, type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";

/** What the frame provides: the texts of the shown language. */
export const STORY_TEXTS = new InjectionToken<Signal<StoryTextTable>>("forgebook story texts");

/**
 * The text function of the shown language, for a component inside a story; called in an injection context (a field's
 * initialiser, a constructor).
 *
 * @returns `text(key, values?)`, reading the language when called, so a template using it follows a change.
 */
export const injectStoryText = (): StoryTextFunction => {
  const provided = inject(STORY_TEXTS, { optional: true });
  return (...parameters: Parameters<StoryTextFunction>): string =>
    storyTextOf(provided?.() ?? {})(...parameters);
};
