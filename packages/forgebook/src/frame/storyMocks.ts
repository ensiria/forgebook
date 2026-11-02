/**
 * A story's mocked API: `parameters.msw.handlers`, served by MSW's service worker while the story is shown.
 *
 * @remarks
 * MSW is an optional peer the project installs, and it loads only for a story that has handlers: a story without any,
 * in a catalogue with MSW or without it, costs nothing. The worker starts before the story's loaders, which may fetch.
 * Handlers are read as a list, or as a record of lists, as MSW's Storybook addon writes them, so stories move over as
 * they are. A request no handler answers goes to the network, as in the project without mocks. Every frame of a page
 * shares one origin, so one worker serves them all: each story's handlers answer its own frame only, and a frame
 * whose story has none goes to the network.
 *
 * @module
 */

/** The worker's script, beside the frame's page: `npx msw init <public folder>` writes it. */
const WORKER_FILE = "mockServiceWorker.js";

/** What of MSW's worker a story uses. */
export type MockWorker = {
  /** Registers the service worker. */
  readonly start: (options: {
    readonly serviceWorker: { readonly url: string };
    readonly onUnhandledRequest: "bypass";
    readonly quiet: boolean;
  }) => Promise<unknown>;
  /** Stops answering. */
  readonly stop: () => void;
};

/** What of an intercepted request a story's handlers read to tell which frame sent it. */
export type MockRequest = {
  /** The address of the page that sent it, an empty string when its referrer policy hides it. */
  readonly referrer: string;
};

/** What of `msw/browser` and `msw` a story uses. */
export type MockTools = {
  /** Makes a worker of handlers. */
  readonly setupWorker: (...handlers: readonly unknown[]) => MockWorker;
  /** Makes request handlers. */
  readonly http: {
    /** A handler of every request; when its resolver gives no answer, the next handler answers. */
    readonly all: (path: string, resolver: (info: { readonly request: MockRequest }) => unknown) => unknown;
  };
  /** The answer that sends a request on to the network. */
  readonly passthrough: () => unknown;
};

/** Loads MSW; none when the project does not install it. */
export type MockToolsLoader = () => Promise<MockTools>;

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The handlers a story's parameters declare, flat. */
const handlersOf = (parameters: Readonly<Record<string, unknown>>): readonly unknown[] => {
  const msw = parameters["msw"];
  const handlers = isRecord(msw) ? msw["handlers"] : undefined;
  if (Array.isArray(handlers)) return handlers;
  return isRecord(handlers) ? Object.values(handlers).flat() : [];
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
const ownFrameOnly = ({ http, passthrough }: MockTools): unknown =>
  http.all("*", ({ request }) => (isFromAnotherFrame(request) ? passthrough() : undefined));

/** How every story's worker starts. */
const WORKER_OPTIONS = {
  serviceWorker: { url: WORKER_FILE },
  onUnhandledRequest: "bypass",
  quiet: true
} as const;

/** Nothing to undo. */
const NOTHING = (): void => undefined;

/** How long a page waits for a worker to take it over, in milliseconds. */
const TAKEOVER_WAIT = 500;

/** Where a frame notes the reload it did for its worker, so it does one at most. */
const RELOADED_KEY = "forgebook:mocks-reloaded";

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

/**
 * Reloads a page the worker did not take over, once.
 *
 * @remarks
 * MSW's script unregisters itself when its last page closes. When that page is the one this story replaces, the new
 * page can end up with an active registration that never claims it: `start` resolves and every request goes to the
 * network, however many times it starts again. A new document is served from its first request.
 *
 * @returns whether the page is going away, which leaves the story nothing to draw.
 */
const reloadForWorker = (): boolean => {
  if (sessionStorage.getItem(RELOADED_KEY) !== null) return false;
  sessionStorage.setItem(RELOADED_KEY, "1");
  location.reload();
  return true;
};

/**
 * Starts a story's mocks, before its loaders.
 *
 * @param parameters - the story's parameters.
 * @param load - loads MSW; none when the project does not install it.
 * @returns what stops them.
 * @throws when the story has handlers and the project has no MSW, saying what to do.
 */
export const startStoryMocks = async (
  parameters: Readonly<Record<string, unknown>>,
  load: MockToolsLoader | undefined
): Promise<() => void> => {
  const handlers = handlersOf(parameters);
  if (handlers.length === 0) return NOTHING;
  if (load === undefined) {
    throw new Error("This story mocks its API: `npm install --save-dev msw`, then `npx msw init public`");
  }
  const tools = await load();
  const worker = tools.setupWorker(ownFrameOnly(tools), ...handlers);
  await worker.start(WORKER_OPTIONS);
  if (await isServedByWorker()) sessionStorage.removeItem(RELOADED_KEY);
  else if (reloadForWorker()) await new Promise<never>(() => undefined);
  return (): void => worker.stop();
};
