/**
 * A story's mock handlers (`parameters.msw.handlers`) read from its parameters, and run on a server in place of the
 * network. Exported as `forgebook/story-mocks`, for `@forgebook/plugin-msw` and the adapters that render on a server.
 *
 * @remarks
 * A server render (the generated server tests) has no service worker, and whatever answers on the test machine must
 * not decide what a page draws. So the handlers the frame's worker serves are run here through MSW's `getResponse`, a
 * plain call with no interception, so concurrent renders never see each other's handlers. A request no handler answers,
 * one a handler answers with `passthrough()`, or one made with `bypass()`, fails with the error the adapter writes, which
 * knows what its stories can give instead. A handler's `HttpResponse.error()` rejects the fetch and its redirect is
 * followed, as in the frame.
 *
 * Imports nothing, MSW included: `msw` is an optional peer of each adapter that uses this, so it is resolved from that
 * package and passed in. A strict package manager would not find it from here.
 *
 * @module
 */

/** How many redirects a fetch follows, as browsers and Node's `fetch` do. */
const MOST_REDIRECTS = 20;

/**
 * How many requests of a render wait at once. A handler that fetches the address it answers comes back to itself for
 * ever, in promises alone, so no timer of the render's ever fires: only this stops it.
 */
const MOST_WAITING = 1000;

/** The headers a redirect to another origin does not carry. */
const CREDENTIAL_HEADERS = ["authorization", "cookie", "proxy-authorization"];

/** What of MSW a server render uses: `getResponse`, whose `baseUrl` (MSW 2.11) reads a handler's path. */
type MswCore = {
  /** The answer of the first handler that answers the request; none when no handler does. */
  readonly getResponse: (
    handlers: unknown[],
    request: Request,
    resolutionContext: { readonly baseUrl: string }
  ) => Promise<Response | undefined>;
};

/** What a story's mocks need to answer requests on a server. */
export type ServerMocks = {
  /** The story's handlers (`mockHandlersOf`). */
  readonly handlers: readonly unknown[];
  /** The origin of the story's page, which a handler's path (`/api/users`) is read from, as the frame reads it. */
  readonly origin: string;
  /** Imports `msw`, from the adapter that declares it as a peer; called only when there are handlers to run. */
  readonly loadMsw: () => Promise<unknown>;
  /** The error a request fails with when no handler answers it; the adapter also keeps it, to fail the render. */
  readonly onUnanswered: (request: Request) => Error;
  /** Whether the mocks answer an address, or the network does; every address by default. */
  readonly isMocked?: (address: URL) => boolean;
};

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The handlers a story's parameters declare, flat: a list, or a record of lists as MSW's Storybook addon writes them.
 *
 * @param parameters - the story's parameters.
 * @returns the handlers; none when the story has no mocks.
 */
export const mockHandlersOf = (parameters: Readonly<Record<string, unknown>>): readonly unknown[] => {
  const msw = parameters["msw"];
  const handlers = isRecord(msw) ? msw["handlers"] : undefined;
  if (Array.isArray(handlers)) return handlers;
  return isRecord(handlers) ? Object.values(handlers).flat() : [];
};

/** The addresses of this machine that are not a range: every interface's, which connecting to reaches this machine. */
const OWN_ADDRESSES: ReadonlySet<string> = new Set(["[::1]", "0.0.0.0", "[::]"]);

/**
 * Whether a host name is this machine's own, as `URL` writes it: `localhost` and its subdomains, with or without the
 * final dot, `127.0.0.0/8`, the same range mapped into IPv6, and the addresses that reach every interface.
 *
 * @param hostname - the host name, from a `URL`.
 */
const isLoopback = (hostname: string): boolean => {
  const name = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    OWN_ADDRESSES.has(name) ||
    /^127\.\d+\.\d+\.\d+$/.test(name) ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(name)
  );
};

/**
 * Whether an address reaches the same server as a page: its origin, or another name of this machine on the same scheme
 * and port (`127.0.0.1` or `[::1]` beside a `localhost` page), which a real machine answers the same.
 *
 * @param address - the address.
 * @param page - the page's address.
 */
export const isOnPageOrigin = (address: URL, page: URL): boolean => {
  if (address.origin === page.origin) return true;
  return (
    address.protocol === page.protocol &&
    address.port === page.port &&
    isLoopback(address.hostname) &&
    isLoopback(page.hostname)
  );
};

/**
 * Makes a story's `{ once: true }` handlers answer again, as MSW's `restoreHandlers` does: each render on a server is a
 * page of its own, as each frame is, while the handler objects outlive it in the test process.
 *
 * @param handlers - the story's handlers.
 */
const restoreHandlers = (handlers: readonly unknown[]): void => {
  for (const handler of handlers)
    if (isRecord(handler) && typeof handler["isUsed"] === "boolean") Reflect.set(handler, "isUsed", false);
};

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
 * @param loadMsw - imports it.
 * @throws when MSW is not installed, or is older than its `getResponse`.
 */
const mswCore = async (loadMsw: () => Promise<unknown>): Promise<MswCore> => {
  let module: unknown;
  try {
    module = await loadMsw();
  } catch (error) {
    throw new Error(
      "Answering a fetch with the story's mocks on a server needs MSW: npm install --save-dev msw",
      { cause: error }
    );
  }
  if (!isMswCore(module))
    throw new Error("The installed MSW has no getResponse: MSW 2.11 or later is needed");
  return module;
};

/**
 * Whether a request asks to skip the mocks and reach the network: MSW's `bypass()` adds this to its `accept` header. A
 * handler's `fetch(bypass(request))` would otherwise come back to the same handler for ever.
 *
 * @param request - the request.
 */
const isBypass = (request: Request): boolean =>
  request.headers.get("accept")?.includes("msw/passthrough") === true;

/**
 * Whether an answer is MSW's `passthrough()`: MSW marks it with this status and header, which its own
 * `isPassthroughResponse` reads (exported from MSW 3 only).
 *
 * @param answer - a handler's answer.
 */
const isPassthrough = (answer: Response): boolean =>
  answer.status === 302 && answer.headers.get("x-msw-intention") === "passthrough";

/**
 * What the story's handlers answer: none when they do not, or when the one that does sends the request on to the
 * network, which a server render never reaches.
 *
 * @param mocks - the story's mocks.
 * @param request - the request.
 */
const mockAnswer = async (mocks: ServerMocks, request: Request): Promise<Response | undefined> => {
  if (mocks.handlers.length === 0 || isBypass(request)) return undefined;
  const { getResponse } = await mswCore(mocks.loadMsw);
  const address = new URL(request.url);
  // an address on this machine, whichever name or port, is the app's own: `/api/users` answers it as in the app
  const baseUrl = isLoopback(address.hostname) ? address.origin : mocks.origin;
  const answer = await getResponse([...mocks.handlers], request, { baseUrl });
  return answer === undefined || isPassthrough(answer) ? undefined : answer;
};

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
  const next = isGet
    ? new Request(target, { method: request.method === "HEAD" ? "HEAD" : "GET", headers: request.headers })
    : new Request(target, request);
  // an adapter may send this one to the network: another origin never gets the first one's credentials, as with `fetch`
  if (target.origin !== new URL(request.url).origin)
    for (const name of CREDENTIAL_HEADERS) next.headers.delete(name);
  return next;
};

/**
 * A `fetch` of one render, its requests answered by the story's mocks. Make one per render: its `{ once: true }` handlers
 * answer again from here.
 *
 * @param mocks - the story's mocks.
 * @returns what sends a request; an address the mocks do not take goes to the global `fetch`.
 */
export const mockedFetch = (mocks: ServerMocks): ((request: Request) => Promise<Response>) => {
  restoreHandlers(mocks.handlers);
  const send = async (request: Request, redirects: number): Promise<Response> => {
    if (mocks.isMocked?.(new URL(request.url)) === false) return globalThis.fetch(request);
    // kept for a redirect that sends the request again, body included, after a handler read it
    const kept = request.clone();
    const answer = await mockAnswer(mocks, request);
    if (answer === undefined) throw mocks.onUnanswered(request);
    // MSW's mocked network error: `fetch` rejects, as it does in the frame
    if (answer.type === "error") throw new TypeError("Failed to fetch", { cause: answer });
    const next = redirectOf(answer, kept);
    if (next === undefined) return answer;
    if (redirects >= MOST_REDIRECTS) throw new TypeError(`Too many redirects, the last to ${next.url}`);
    return send(next, redirects + 1);
  };
  let waiting = 0;
  return async (request: Request): Promise<Response> => {
    if (waiting >= MOST_WAITING)
      throw new TypeError(`${request.method} ${request.url}: a handler keeps fetching what it answers`);
    waiting += 1;
    try {
      return await send(request, 0);
    } finally {
      waiting -= 1;
    }
  };
};
