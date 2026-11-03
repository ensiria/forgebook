/**
 * Forgebook's renderer for React, whole: the frame's drawing (`reactFrameRenderer.tsx`) and the story drawn as HTML
 * on the server, for the generated server tests.
 *
 * @remarks
 * The frame page imports `reactFrameRenderer.tsx` alone, so React's server renderer never reaches it. Here it still
 * loads only when a server test renders a story (`renderToString`), so a test that only mounts does not load it.
 *
 * @module
 */

import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";

import { reactFrameRenderer } from "./reactFrameRenderer.tsx";
import { storyElement } from "./storyElement.ts";
import { inProviders } from "./storyProviders.tsx";

/** React as the frame draws with it and the server tests render with it. */
export const reactRenderer: StoryRenderer = {
  ...reactFrameRenderer,
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderToString } = await import("react-dom/server");
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    return renderToString(inProviders(drawing, storyElement(drawing.story, context, drawing.decorators)));
  }
};
