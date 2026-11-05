/**
 * The `fetch` a story's `load` gets: in a page, the frame's own, which the catalogue's mocks answer; on a server, the
 * story's mock handlers run in place of the network for an address on the story's page's origin.
 *
 * @remarks
 * SvelteKit's `fetch` on a server reads a path from the page's address, so a server render (the generated server
 * tests) would ask `http://localhost` for it: whatever answers on that machine, or nothing, would decide what the page
 * draws. A server render never reaches the network for the page's own origin, a loopback name for it included: the
 * story's handlers answer it (`forgebook/story-mocks`), and one they do not answer fails the render with what to give
 * instead. An address on another origin is fetched as it is.
 *
 * @module
 */
import { isOnPageOrigin, mockedFetch } from "forgebook/story-mocks";

/** The module MSW's request handling is imported from, by the project that installs it. */
const MSW_MODULE = "msw";

/** A load's `fetch`. */
export type LoadFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * The error of a request on the page's origin that no handler answered: what was asked, and what to give.
 *
 * @param request - the request.
 */
const unansweredError = (request: Request): Error =>
  new Error(
    `A load fetched ${request.method} ${request.url} on a server, and no mock of the story answers it: a server render ` +
      "never reaches the network. Answer it with a handler in parameters.msw.handlers, or give the page's data " +
      "with parameters.sveltekit.serverData or parameters.sveltekit.page.data."
  );

/**
 * The fetch a load gets.
 *
 * @param pageUrl - the address of the page being loaded, which a path is read from.
 * @param handlers - the story's mock handlers.
 * @param onUnanswered - told of a request on the page's origin that no handler answered on a server, so the render
 *   fails even when the load catches the error and draws something else.
 */
export const loadFetch = (
  pageUrl: URL,
  handlers: readonly unknown[],
  onUnanswered: (error: Error) => void
): LoadFetch => {
  // in a page, a path is read from the frame's address, where the catalogue's mocks answer it
  if (typeof location !== "undefined")
    return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => globalThis.fetch(input, init);
  const send = mockedFetch({
    handlers,
    origin: pageUrl.origin,
    // named by a variable, so a frame's build never resolves MSW: the frame fetches through the page
    loadMsw: (): Promise<unknown> => import(/* @vite-ignore */ MSW_MODULE),
    isMocked: (address: URL): boolean => isOnPageOrigin(address, pageUrl),
    onUnanswered: (request: Request): Error => {
      const error = unansweredError(request);
      onUnanswered(error);
      return error;
    }
  });
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    send(new Request(typeof input === "string" ? new URL(input, pageUrl) : input, init));
};
