/**
 * The element a story is drawn in, as the frame prepares it for any framework: its layout and the states it forces.
 *
 * @module
 */

import { FORCE_ATTRIBUTE } from "../vite/forcedStates.ts";
import type { LoadedStory } from "./storyModule.ts";

/**
 * A new canvas for the story alone: padded, centred or the whole frame, with its forced states.
 *
 * @param document - the frame's document.
 * @param story - the story.
 */
export const storyCanvas = (document: Document, story: LoadedStory): HTMLElement => {
  const canvas = document.createElement("div");
  canvas.className = "forgebook-frame";
  canvas.dataset["layout"] = story.layout;
  forceStates(canvas, story);
  return canvas;
};

/**
 * Sets the attribute that forces the story's states on an element, when it forces any.
 *
 * @param element - the story's canvas, or a cell of its matrix.
 * @param story - the story.
 */
export const forceStates = (element: HTMLElement, story: LoadedStory): void => {
  if (story.forceState.length > 0) element.setAttribute(FORCE_ATTRIBUTE, story.forceState.join(" "));
};
