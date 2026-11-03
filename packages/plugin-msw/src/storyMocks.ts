/**
 * A story's mocked API: `parameters.msw.handlers`, served by MSW's service worker while the story is shown.
 *
 * @remarks
 * MSW loads only for a story that has handlers. Handlers are read as a list, or as a record of lists, as MSW's Storybook
 * addon writes them, so stories move over as they are. A request no handler answers goes to the network, as in the
 * project without mocks. Every frame of a page shares one origin, so one worker serves them all: each story's handlers
 * answer its own frame only, and a frame whose story has none goes to the network.
 *
 * @module
 */

/** The worker's script, beside the frame's page: `npx msw init <public folder>` writes it. */
const WORKER_FILE = "mockServiceWorker.js";

/** One of the worker's events, as much of it as the log reads. */
export type MockEvent = {
  /** The request, with the address of the page that sent it. */
  readonly request: { readonly method: string; readonly url: string; readonly referrer: string };
  /** The answer. */
  readonly response: { readonly status: number };
};

/** What of MSW's worker a story uses. */
export type MockWorker<THandler> = {
  /** Registers the service worker. */
  readonly start: (options: {
    readonly serviceWorker: { readonly url: string };
    readonly onUnhandledRequest: "bypass";
    readonly quiet: boolean;
  }) => Promise<unknown>;
  /** Stops answering; MSW 3 waits for its last requests. */
  readonly stop: () => unknown;
  /** Answers with these handlers from now on, the worker kept running. */
  readonly resetHandlers: (...handlers: THandler[]) => void;
  /** What the worker tells of each request. */
  readonly events: {
    /** Listens to an answer: a handler's, or the network's. */
    readonly on: (
      event: "response:mocked" | "response:bypass",
      listener: (event: MockEvent) => void
    ) => unknown;
  };
};

/** What of an intercepted request the first handler reads to tell which frame sent it. */
export type MockRequest = {
  /** The address of the page that sent it, an empty string when its referrer policy hides it. */
  readonly referrer: string;
};

/** What of `msw/browser` and `msw` a story uses. */
export type MockTools<THandler, TAnswer> = {
  /** Makes a worker of handlers. */
  readonly setupWorker: (...handlers: THandler[]) => MockWorker<THandler>;
  /** Makes request handlers. */
  readonly http: {
    /** A handler of every request; when its resolver gives no answer, the next handler answers. */
    readonly all: (
      path: string,
      resolver: (info: { readonly request: MockRequest }) => TAnswer | undefined
    ) => THandler;
  };
  /** The answer that sends a request on to the network. */
  readonly passthrough: () => TAnswer;
};

/** Loads MSW. */
export type MockToolsLoader<THandler, TAnswer> = () => Promise<MockTools<THandler, TAnswer>>;

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The handlers a story's parameters declare, flat.
 *
 * @param parameters - the story's parameters.
 */
export const handlersOf = (parameters: Readonly<Record<string, unknown>>): readonly unknown[] => {
  const msw = parameters["msw"];
  const handlers = isRecord(msw) ? msw["handlers"] : undefined;
  if (Array.isArray(handlers)) return handlers;
  return isRecord(handlers) ? Object.values(handlers).flat() : [];
};

/**
 * What a handler answers, as MSW's own log writes it (`GET /api/users`).
 *
 * @param handler - a handler; `info.header` is MSW's since version 2.
 */
export const handlerLabel = (handler: unknown): string => {
  const info = isRecord(handler) ? handler["info"] : undefined;
  const header = isRecord(info) ? info["header"] : undefined;
  return typeof header === "string" ? header : "(unnamed handler)";
};

/** The parameter of a frame's address that names its story (`frame.html?story=…`). */
const STORY_PARAMETER = "story";

/** The story an address names, none when it names none or cannot be read. */
const storyOfAddress = (address: string): string | null => {
  if (!URL.canParse(address)) return null;
  return new URL(address).searchParams.get(STORY_PARAMETER);
};

/**
 * Whether a request was sent by the frame of another story.
 *
 * @remarks
 * Read from the request's referrer, the address of the page that sent it, against this frame's address at the time:
 * a story that changes its own address keeps its requests. A request whose sender cannot be told (a hidden referrer,
 * a worker the story started) stays with this story's handlers, as MSW would have it.
 */
const isFromAnotherFrame = (request: MockRequest): boolean => {
  const sender = storyOfAddress(request.referrer);
  return sender !== null && sender !== storyOfAddress(location.href);
};

/**
 * The handler, first of a story's, that sends on to the network what another frame of the page asks.
 *
 * @remarks
 * MSW's worker answers a request from a page that never started it, which a frame with no handlers is, through any
 * visible page that did: it is how a mocked application's own frames are mocked. On a page of several frames that
 * page is another story's, whose handlers would answer a story that mocks nothing, or mocks otherwise. Which frame
 * started first decides nothing: each story answers its own frame, the others go to the network.
 */
const ownFrameOnly = <THandler, TAnswer>({ http, passthrough }: MockTools<THandler, TAnswer>): THandler =>
  http.all("*", ({ request }) => (isFromAnotherFrame(request) ? passthrough() : undefined));

/** How every story's worker starts. */
const WORKER_OPTIONS = {
  serviceWorker: { url: WORKER_FILE },
  onUnhandledRequest: "bypass",
  quiet: true
} as const;

/** How long a page waits for a worker to take it over, in milliseconds. */
const TAKEOVER_WAIT = 500;

/**
 * Where a frame notes the reload it did for its worker, so it does one at most: by its address.
 *
 * @remarks
 * Every frame of a page shares the page's session storage. One mark for them all would let the first frame that reloads
 * stop the others: on a page whose frames the worker all missed, they would draw their stories with no mocks.
 */
const reloadedKey = (): string => `forgebook:mocks-reloaded:${location.href}`;

/** Whether this page came from a reload: its own, or a person's of this frame alone. */
const isReloaded = (): boolean =>
  performance.getEntriesByType("navigation").some((entry) => "type" in entry && entry.type === "reload");

/** Whether the service worker serves this page, waiting briefly for it to take the page over. */
const isServedByWorker = async (): Promise<boolean> => {
  const { serviceWorker } = navigator;
  if (serviceWorker.controller !== null) return true;
  await new Promise<void>((resolve) => {
    serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    setTimeout(resolve, TAKEOVER_WAIT);
  });
  return serviceWorker.controller !== null;
};

/** The page's session storage; none where the browser denies it, as a third-party frame's may be. */
const pageStorage = (): Storage | undefined => {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
};

/**
 * Reloads a page the worker did not take over, once.
 *
 * @remarks
 * MSW's script unregisters itself when its last page closes. When that page is the one this story replaces, or when a
 * whole page reloads on a busy machine and the old frames close before the new ones are ready, the new pages can end up
 * with an active registration that never claims them: `start` resolves and every request goes to the network, however
 * many times it starts again. A new document is served from its first request; each frame needs its own.
 *
 * @returns whether the page is going away, which leaves the story nothing to draw.
 */
const reloadForWorker = (): boolean => {
  // with no storage, as a third-party frame may have, a reload could not know it already happened: it would never end
  const storage = pageStorage();
  if (storage === undefined) return false;
  // the mark alone may be an earlier visit's, left by a reload that did not help: this page is that reload only when it
  // came from one too
  const key = reloadedKey();
  if (storage.getItem(key) !== null && isReloaded()) return false;
  storage.setItem(key, "1");
  location.reload();
  return true;
};

/** A story's mocks, running. */
export type StoryMocks<THandler> = {
  /** Answers with other handlers, the worker kept running: an edit of the story file wrote new ones. */
  readonly renew: (handlers: readonly THandler[]) => void;
  /** Stops them, once they stopped. */
  readonly stop: () => Promise<void>;
};

/**
 * Starts a story's mocks, before its loaders.
 *
 * @param handlers - the story's handlers, at least one.
 * @param load - loads MSW.
 * @param onEvent - told of each answer to this frame's requests; a handler's or the network's.
 * @returns what renews and stops them.
 */
export const startStoryMocks = async <THandler, TAnswer>(
  handlers: readonly THandler[],
  load: MockToolsLoader<THandler, TAnswer>,
  onEvent: (event: MockEvent, isMocked: boolean) => void
): Promise<StoryMocks<THandler>> => {
  const tools = await load();
  const first = ownFrameOnly(tools);
  const worker = tools.setupWorker(first, ...handlers);
  // the worker tells this page of the requests it relays for another frame too, which are that frame's to list
  const tell = (event: MockEvent, isMocked: boolean): void => {
    if (!isFromAnotherFrame(event.request)) onEvent(event, isMocked);
  };
  worker.events.on("response:mocked", (event) => tell(event, true));
  worker.events.on("response:bypass", (event) => tell(event, false));
  await worker.start(WORKER_OPTIONS);
  if (await isServedByWorker()) pageStorage()?.removeItem(reloadedKey());
  else if (reloadForWorker()) await new Promise<never>(() => undefined);
  return {
    renew: (next: readonly THandler[]): void => worker.resetHandlers(first, ...next),
    stop: async (): Promise<void> => {
      await worker.stop();
    }
  };
};
