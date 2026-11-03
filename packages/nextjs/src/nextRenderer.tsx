/**
 * Forgebook's renderer for a Next.js project, whole: the frame's drawing (`nextFrameRenderer.tsx`) and the story drawn
 * as HTML on the server, for the generated server tests, with React's server render.
 *
 * @remarks
 * The frame page imports `nextFrameRenderer.tsx` alone, so React's server renderer never reaches it.
 *
 * @module
 */
import { reactRenderer } from "@forgebook/react/renderer";
import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";

import { nextFrameRenderer, withNext } from "./nextFrameRenderer.tsx";
import { createRouteStore, setCurrentStore } from "./routeStore.ts";
import { forgetServerResults } from "./serverComponents.ts";

/** The server renders under way, in order: each sets the route's store the story reads while it renders. */
let serverRenders: Promise<void> = Promise.resolve();

/** React's renderer for a Next.js project. */
export const nextRenderer: StoryRenderer = {
  ...nextFrameRenderer,
  renderToString: (drawing: StoryDrawing): Promise<string> => {
    // one at a time: the route's store is the module's, and React's render waits for its server renderer to load
    const render = serverRenders.then(async () => {
      setCurrentStore(createRouteStore(drawing.story.parameters, drawing.onEvent));
      forgetServerResults();
      return await reactRenderer.renderToString(withNext(drawing, undefined));
    });
    serverRenders = render.then(
      () => undefined,
      () => undefined
    );
    return render;
  }
};
