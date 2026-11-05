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

/**
 * A story's HTML once everything it waits for came, as a framework's server sends a page: for an adapter whose stories
 * wait for data while they render, which `renderToString` gives up on.
 *
 * @remarks
 * Every render error fails it, one inside a `Suspense` boundary too: a real server would hand that boundary to the
 * browser to try again, which a server test has none of.
 *
 * @param drawing - the story.
 * @param signal - gives up on what still waits.
 * @returns the HTML.
 * @throws the first error of the render.
 */
export const awaitedRenderToString = async (drawing: StoryDrawing, signal: AbortSignal): Promise<string> => {
  // the entry for a server with web streams: Node's own has them only from React 19.2
  const { renderToReadableStream } = await import("react-dom/server.edge");
  const context = storyContextOf(drawing, drawing.args, () => document.body);
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(
    inProviders(drawing, storyElement(drawing.story, context, drawing.decorators)),
    // no chunk limit: past it React writes a boundary apart, its fallback and a script in the HTML, however long it waited
    {
      signal,
      progressiveChunkSize: Number.POSITIVE_INFINITY,
      onError: (error: unknown): void => void errors.push(error)
    }
  );
  // read before everything came, the stream would hold fallbacks too
  await stream.allReady;
  if (errors.length > 0) throw errors[0];
  return await new Response(stream).text();
};

/** React as the frame draws with it and the server tests render with it. */
export const reactRenderer: StoryRenderer = {
  ...reactFrameRenderer,
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { renderToString } = await import("react-dom/server");
    const context = storyContextOf(drawing, drawing.args, () => document.body);
    return renderToString(inProviders(drawing, storyElement(drawing.story, context, drawing.decorators)));
  }
};
