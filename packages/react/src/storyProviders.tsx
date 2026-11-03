/**
 * The providers every React story is drawn inside, in a frame and on the server alike: the story's texts and its clock.
 *
 * @module
 */

import type { StoryDrawing } from "forgebook/renderer";
import type { ReactNode } from "react";

import { StoryClockContext } from "./clock.ts";
import { StoryTextsContext } from "./texts.ts";

/**
 * The story in the texts' and the clock's providers; the language's provider is a decorator of the catalogue's
 * preview, inside these.
 *
 * @param drawing - the story's texts and clock.
 * @param story - the story's element, to wrap.
 */
export const inProviders = (drawing: StoryDrawing, story: ReactNode): ReactNode => (
  <StoryTextsContext.Provider value={drawing.texts}>
    <StoryClockContext.Provider value={drawing.clock}>{story}</StoryClockContext.Provider>
  </StoryTextsContext.Provider>
);
