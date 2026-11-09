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
import { createContext, useContext, useMemo } from "react";

/** The texts of the shown language, as the catalogue's frame provides them; none outside a catalogue. */
export const StoryTextsContext = createContext<StoryTextTable>({});

/**
 * The text function of the shown language, for a component inside a story.
 *
 * @remarks
 * The function keeps its identity across renders for as long as the shown language, and the texts it reads, stay the
 * same: the frame hands the same table until the language changes (a theme or a width changed meanwhile does not
 * count), and the function is made once per table. It is a new function after a language switch. So a `useMemo` or
 * `useCallback` keyed on it (a table's columns, a story's data) is built again exactly when the language changes,
 * and not on every render. What it returns for a key is the same either way.
 *
 * @returns `text(key, values?)`.
 */
export const useStoryText = (): StoryTextFunction => {
  const table = useContext(StoryTextsContext);
  return useMemo(() => storyTextOf(table), [table]);
};
