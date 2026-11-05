/**
 * Forgebook's renderer for a Next.js project, whole: the frame's drawing (`nextFrameRenderer.tsx`) and the story drawn
 * as HTML on the server, for the generated server tests, with React's server render.
 *
 * @remarks
 * The frame page imports `nextFrameRenderer.tsx` alone, so React's server renderer never reaches it. The server render
 * waits for the story's server components, as Next.js's server does, and their `fetch` never reaches the network
 * (`serverFetch.ts`).
 *
 * @module
 */
import { awaitedRenderToString } from "@forgebook/react/renderer";
import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { mockHandlersOf } from "forgebook/story-mocks";

import { nextFrameRenderer, withNext } from "./nextFrameRenderer.tsx";
import { createRouteStore, setCurrentStore } from "./routeStore.ts";
import { forgetServerResults } from "./serverComponents.ts";
import { withStoryFetch } from "./serverFetch.ts";

/** The server renders under way, in order: each sets the route's store the story reads while it renders. */
let serverRenders: Promise<void> = Promise.resolve();

/**
 * How long a server render waits for what its story waits for, in milliseconds. Renders run in order, so one that
 * never ends would stall every story after it; under Vitest's 5 s, so the story that hangs fails with why, alone.
 */
const SERVER_RENDER_LIMIT = 4500;

/**
 * A story's HTML, its server components awaited and their `fetch` answered by its mocks.
 *
 * @param drawing - the story.
 * @throws the first fetch no mock answered, else what the render threw, or that it did not end.
 */
const serverHtml = async (drawing: StoryDrawing): Promise<string> => {
  const signal = AbortSignal.timeout(SERVER_RENDER_LIMIT);
  try {
    return await withStoryFetch(mockHandlersOf(drawing.story.parameters), () =>
      awaitedRenderToString(withNext(drawing, undefined), signal)
    );
  } catch (thrown) {
    if (!signal.aborted || thrown !== signal.reason) throw thrown;
    throw new Error(
      `${drawing.identity.title} › ${drawing.identity.name} did not finish its server render in ` +
        `${SERVER_RENDER_LIMIT} ms: a server component waits for something that never comes.`,
      { cause: thrown }
    );
  }
};

/** React's renderer for a Next.js project. */
export const nextRenderer: StoryRenderer = {
  ...nextFrameRenderer,
  renderToString: (drawing: StoryDrawing): Promise<string> => {
    // one at a time: the route's store is the module's, and React's render waits for its server renderer to load
    const render = serverRenders.then(async () => {
      setCurrentStore(createRouteStore(drawing.story.parameters, drawing.onEvent));
      forgetServerResults();
      return await serverHtml(drawing);
    });
    serverRenders = render.then(
      () => undefined,
      () => undefined
    );
    return render;
  }
};
