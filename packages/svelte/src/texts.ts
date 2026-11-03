/**
 * The texts inside the stories for Svelte components inside a story: the shown language's table, as the frame sets it,
 * read with `getStoryText()`.
 *
 * @remarks
 * The table and the text function are the format's (`@forgebook/story-format/texts`); this module is how a Svelte
 * component reads them. The text function reads the language when it is called, so a template that calls it follows a
 * change; outside a catalogue there is no table, and a text is its key in brackets.
 *
 * @module
 */
import { type StoryTextFunction, storyTextOf } from "@forgebook/story-format/texts";

import { storyView } from "./storyView.ts";

/**
 * The text function of the shown language, for a component inside a story; called while the component is initialised.
 *
 * @returns `text(key, values?)`, reading the language when called.
 */
export const getStoryText = (): StoryTextFunction => {
  const view = storyView();
  return (...parameters: Parameters<StoryTextFunction>): string =>
    storyTextOf(view?.texts ?? {})(...parameters);
};
