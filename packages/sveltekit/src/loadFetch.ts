/**
 * The `fetch` a story's `load` gets: in a page, the frame's own, which the catalogue's mocks answer; on a server, the
 * story's mock handlers run in place of the network for an address on the story's page's origin.
 *
 * @remarks
 * SvelteKit's `fetch` on a server reads a path from the page's address, so a server render (the generated server
 * tests) would ask `http://localhost` for it: whatever answers on that machine, or nothing, would decide what the page
 * draws. A server render never reaches the network for the page's own origin: the story's handlers
 * (`parameters.msw.handlers`, the ones the frame's worker serves) answer it through MSW's `getResponse`, a plain call
 * with no interception, so concurrent renders never see each other's handlers. A request no handler answers, or one
 * a handler sends on to the network (`passthrough()`), fails the render with what to give instead. An address on
 * another origin is fetched as it is. A handler's `HttpResponse.error()` rejects the fetch and its redirect is followed,
 * as in the frame.
 *
 * @module
 */

/** The module MSW's request handling is imported from, by the project that installs it. */
const MSW_MODULE = "msw";

/** What of MSW a server render uses: `getResponse`, whose `baseUrl` (MSW 2.11) reads a handler's path. */
type MswCore = {
  /** The answer of the first handler that answers the request; none when no handler does. */
  readonly getResponse: (
    handlers: unknown[],
    request: Request,
    resolutionContext: { readonly baseUrl: string }
  ) => Promise<Response | undefined>;
};

/** A load's `fetch`. */
export type LoadFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
  restoreHandlers(handlers);
  const send = async (request: Request, redirects: number): Promise<Response> => {
    if (new URL(request.url).origin !== pageUrl.origin) return globalThis.fetch(request);
    // kept for a redirect that sends the request again, body included, after a handler read it
    const kept = request.clone();
    const answer = await mockAnswer(handlers, request, pageUrl.origin);
    if (answer === undefined) {
      const error = unansweredError(request);
      onUnanswered(error);
      throw error;
    }
    // MSW's mocked network error: `fetch` rejects, as it does in the frame
    if (answer.type === "error") throw new TypeError("Failed to fetch", { cause: answer });
    const next = redirectOf(answer, kept);
    if (next === undefined) return answer;
    if (redirects >= MOST_REDIRECTS) throw new TypeError(`Too many redirects, the last to ${next.url}`);
    return send(next, redirects + 1);
  };
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    send(new Request(typeof input === "string" ? new URL(input, pageUrl) : input, init), 0);
};

/** How many redirects a fetch follows, as browsers and Node's `fetch` do. */
const MOST_REDIRECTS = 20;

/**
 * The request a mocked redirect leads to, as `fetch` follows it: the same method and body for a 307 or a 308, a GET
 * for a 303 and for a POST's 301 or 302; none when the answer is no redirect or the request does not follow one.
 *
 * @param answer - a handler's answer.
 * @param request - the request it answered, its body unread.
 * @throws a `TypeError` for a redirect a request with `redirect: "error"` gets, as `fetch` does.
 */
const redirectOf = (answer: Response, request: Request): Request | undefined => {
  const location = answer.headers.get("location");
  if (![301, 302, 303, 307, 308].includes(answer.status) || location === null) return undefined;
  if (request.redirect === "manual") return undefined;
  if (request.redirect === "error")
    throw new TypeError(`Redirected to ${location}, which the request refuses`);
  const target = new URL(location, request.url);
  const isGet =
    answer.status === 303 || (request.method === "POST" && answer.status !== 307 && answer.status !== 308);
  if (!isGet) return new Request(target, request);
  return new Request(target, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: request.headers
  });
};

/**
 * The handlers a story's parameters declare, flat: a list, or a record of lists as MSW's Storybook addon writes them.
 *
 * @param parameters - the story's parameters.
 */
export const mockHandlersOf = (parameters: Readonly<Record<string, unknown>>): readonly unknown[] => {
  const msw = parameters["msw"];
  const handlers = isRecord(msw) ? msw["handlers"] : undefined;
  if (Array.isArray(handlers)) return handlers;
  return isRecord(handlers) ? Object.values(handlers).flat() : [];
};

/**
 * Makes a story's `{ once: true }` handlers answer again, as MSW's `restoreHandlers` does: each page load on a server is
 * a page of its own, as each frame is, while the handler objects outlive it in the test process.
 *
 * @param handlers - the story's handlers.
 */
const restoreHandlers = (handlers: readonly unknown[]): void => {
  for (const handler of handlers)
    if (isRecord(handler) && typeof handler["isUsed"] === "boolean") Reflect.set(handler, "isUsed", false);
};

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What the story's handlers answer: none when they do not, or when the one that does sends the request on to the
 * network, which a server render never reaches.
 *
 * @param handlers - the story's handlers.
 * @param request - the request.
 * @param origin - the page's origin, which a handler's path (`/api/users`) is read from, as the frame reads it.
 */
const mockAnswer = async (
  handlers: readonly unknown[],
  request: Request,
  origin: string
): Promise<Response | undefined> => {
  if (handlers.length === 0) return undefined;
  const { getResponse } = await mswCore();
  const answer = await getResponse([...handlers], request, { baseUrl: origin });
  return answer === undefined || isPassthrough(answer) ? undefined : answer;
};

/**
 * Whether an answer is MSW's `passthrough()`: MSW marks it with this status and header, which its own
 * `isPassthroughResponse` reads (exported from MSW 3 only).
 *
 * @param answer - a handler's answer.
 */
const isPassthrough = (answer: Response): boolean =>
  answer.status === 302 && answer.headers.get("x-msw-intention") === "passthrough";

/**
 * Whether a module is MSW's, as much as a server render uses.
 *
 * @param module - the module, as `import()` gave it.
 */
const isMswCore = (module: unknown): module is MswCore =>
  typeof module === "object" &&
  module !== null &&
  "getResponse" in module &&
  typeof module.getResponse === "function";

/**
 * Loads MSW, which only a story with handlers needs on a server.
 *
 * @throws when MSW is not installed, or is older than its `getResponse`.
 */
const mswCore = async (): Promise<MswCore> => {
  let module: unknown;
  try {
    // named by a variable, so a frame's build never resolves MSW: the frame fetches through the page
    module = await import(/* @vite-ignore */ MSW_MODULE);
  } catch (error) {
    throw new Error(
      "Answering a load's fetch with the story's mocks on a server needs MSW: npm install --save-dev msw",
      { cause: error }
    );
  }
  if (!isMswCore(module))
    throw new Error("The installed MSW has no getResponse: MSW 2.11 or later is needed");
  return module;
};

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
