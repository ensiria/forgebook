/**
 * Forgebook's renderer for React, whole: what the frame draws with, and the server render the generated server tests
 * run (`storyServerTests` of `@forgebook/testing`, `@forgebook/react/renderer`).
 *
 * @remarks
 * Only tests import this module: a page goes through `reactFrameRenderer.tsx`, so React's server renderer never reaches
 * a browser.
 *
 * @module
 */
import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { renderToString } from "react-dom/server";

import { contextOf, inProviders, reactFrameRenderer } from "./reactFrameRenderer.tsx";
import { storyElement } from "./storyElement.ts";

/** React, as a page draws with it and as a server does. */
export const reactRenderer: StoryRenderer = {
  ...reactFrameRenderer,
  renderToString: (drawing: StoryDrawing): string => {
    const context = contextOf(drawing, () => document.body);
    return renderToString(inProviders(drawing, storyElement(drawing.story, context, drawing.decorators)));
  }
};
