/**
 * The texts inside the stories for React components inside a story: the shown language's table, as the frame provides
 * it, read with `useStoryText()`.
 *
 * @remarks
 * The table and the text function are the format's (`@forgebook/story-format/texts`); this module is how a React
 * component reads them. The frame's renderer provides the table (`reactRenderer.tsx`); outside a catalogue there is
 * none, and a text is its key in brackets.
 *
 * @module
 */
import { type StoryTextFunction, type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";
import { createContext, useContext } from "react";

/** The texts of the shown language, as the catalogue's frame provides them; none outside a catalogue. */
export const StoryTextsContext = createContext<StoryTextTable>({});

/**
 * The text function of the shown language, for a component inside a story.
 *
 * @returns `text(key, values?)`.
 */
export const useStoryText = (): StoryTextFunction => storyTextOf(useContext(StoryTextsContext));
