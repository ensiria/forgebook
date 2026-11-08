/**
 * Forgebook's renderer for React, whole: the frame's drawing (`reactFrameRenderer.tsx`) and the story drawn as HTML
 * on the server, for the generated server tests.
 *
 * @remarks
 * The frame page imports `reactFrameRenderer.tsx` alone, so React's server renderer never reaches it. Here it still
 * loads only when a server test renders a story (`renderToString`), so a test that only mounts does not load it.
 *
 * The web streams renderer has a different entry in each React the package supports, and the one React 19 has does
 * not exist in React 18: naming it in an import would fail where it is missing even when never run, since a bundler
 * resolves every import it sees. So the entry is chosen from the installed React's version, and read through a check.
 *
 * @module
 */

import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { version } from "react-dom";
import type { renderToReadableStream as RenderToReadableStream } from "react-dom/server.browser";

import { reactFrameRenderer } from "./reactFrameRenderer.tsx";
import { storyElement } from "./storyElement.ts";
import { inProviders } from "./storyProviders.tsx";

/** React's renderer to a web stream, as each entry that has one exports it. */
type WebStreamServer = { readonly renderToReadableStream: typeof RenderToReadableStream };

/**
 * Whether a module is a renderer to a web stream.
 *
 * @param module - the module an entry gave.
 */
const isWebStreamServer = (module: unknown): module is WebStreamServer =>
  typeof module === "object" &&
  module !== null &&
  typeof Reflect.get(module, "renderToReadableStream") === "function";

/**
 * The entry of React's renderer to a web stream for a server: React 19 has one for a server (Node's own has web
 * streams only from React 19.2); React 18 has only the browser's, which runs on a server with web streams too.
 *
 * @param reactVersion - the installed React DOM's version.
 * @returns the entry to import.
 */
const webStreamServerEntry = (reactVersion: string): string =>
  Number.parseInt(reactVersion, 10) >= 19 ? "react-dom/server.edge" : "react-dom/server.browser";

/**
 * React's renderer to a web stream, from the entry the installed React has.
 *
 * @throws when the entry has no such renderer.
 */
const webStreamServer = async (): Promise<WebStreamServer> => {
  const entry = webStreamServerEntry(version);
  // a name only known when this runs: the entry the other React has is never resolved
  const server: unknown = await import(/* @vite-ignore */ entry);
  if (!isWebStreamServer(server))
    throw new Error(`${entry} has no renderToReadableStream in React ${version}`);
  return server;
};

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
  const { renderToReadableStream } = await webStreamServer();
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
