/**
 * The texts inside the stories for Solid components inside a story: the shown language's table, as the frame provides
 * it, read with `useStoryText()`.
 *
 * @remarks
 * The table and the text function are the format's (`@forgebook/story-format/texts`); this module is how a Solid
 * component reads them. The frame's renderer provides the table as an accessor (`solidRenderer.ts`), so a text read
 * inside JSX follows the language without the story running again; outside a catalogue there is none, and a text is
 * its key in brackets.
 *
 * @module
 */
import {
  type StoryTextFunction,
  type StoryTextTable,
  type StoryTextValues,
  storyTextOf
} from "@forgebook/story-format/texts";
import { type Accessor, createContext, useContext } from "solid-js";

/** The texts of the shown language, as the catalogue's frame provides them; none outside a catalogue. */
export const StoryTextsContext = createContext<Accessor<StoryTextTable>>(() => ({}));

/**
 * The text function of the shown language, for a component inside a story: each call reads the table of the moment.
 *
 * @returns `text(key, values?)`.
 */
export const useStoryText = (): StoryTextFunction => {
  const table = useContext(StoryTextsContext);
  return (key: string, values?: StoryTextValues): string => storyTextOf(table())(key, values);
};
