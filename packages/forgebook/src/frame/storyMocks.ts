/**
 * A story's mocked API: `parameters.msw.handlers`, served by MSW's service worker while the story is shown.
 *
 * @remarks
 * MSW is an optional peer the project installs, and it loads only for a story that has handlers: a story without any,
 * in a catalogue with MSW or without it, costs nothing. The worker starts before the story's loaders, which may fetch.
 * Handlers are read as a list, or as a record of lists, as MSW's Storybook addon writes them, so stories move over as
 * they are. A request no handler answers goes to the network, as in the project without mocks.
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

/** What of `msw/browser` a story uses. */
export type MockTools = {
  /** Makes a worker of handlers. */
  readonly setupWorker: (...handlers: readonly unknown[]) => MockWorker;
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

/** Nothing to undo. */
const NOTHING = (): void => undefined;

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
  const { setupWorker } = await load();
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: { url: WORKER_FILE },
    onUnhandledRequest: "bypass",
    quiet: true
  });
  return (): void => worker.stop();
};
