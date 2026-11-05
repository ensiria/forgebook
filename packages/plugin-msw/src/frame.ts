/**
 * The plugin's frame module: starts a story's mocks before its first mount's loaders, keeps them until the page is left
 * (renewing its handlers when an edit of the story file changes them), and tells the Network tab what they do.
 *
 * @module
 */
import {
  definePluginFrame,
  type PluginFrame,
  type PluginFrameHost,
  type PluginPrepareContext
} from "forgebook/plugin";
import { mockHandlersOf } from "forgebook/story-mocks";

import {
  isStoryRequest,
  type NetworkReport,
  type NetworkRequest,
  shownUrl,
  withRequest
} from "./networkReport.ts";
import { handlerLabel, type MockTools, type StoryMocks, startStoryMocks } from "./storyMocks.ts";

/** MSW's browser module. */
type MswBrowser = typeof import("msw/browser");

/** A handler, as MSW takes it. */
type Handler = Parameters<MswBrowser["setupWorker"]>[number];

/** MSW's answer that sends a request on to the network. */
type Passthrough = ReturnType<typeof import("msw")["passthrough"]>;

/** Loads MSW, the first time a story needs it. */
const loadMsw = async (): Promise<MockTools<Handler, Passthrough>> => {
  const [browser, core] = await Promise.all([import("msw/browser"), import("msw")]);
  return { setupWorker: browser.setupWorker, http: core.http, passthrough: core.passthrough };
};

/** Whether a value a story's parameters list can be a handler; MSW itself says what a wrong one lacks. */
const isHandler = (value: unknown): value is Handler => typeof value === "object" && value !== null;

/**
 * Whether two lists hold the same handlers: a story mounted again hands the same ones, an edit of its file new ones.
 *
 * @param shown - the handlers answering now.
 * @param next - the story's handlers at this mount.
 */
const isSameHandlers = (shown: readonly Handler[], next: readonly Handler[]): boolean =>
  shown.length === next.length && shown.every((handler, index) => handler === next[index]);

/** The plugin's frame. */
export const frame = definePluginFrame(({ report }: PluginFrameHost): PluginFrame => {
  // the story's mocks, started by its first mount and kept until the page is left: stopping MSW's worker to start it at
  // once again lets the worker forget the page after it started serving it again, so the new mount's requests would go
  // to the network. An edit of the story file renews the handlers in the running worker instead
  let mocks: Promise<StoryMocks<Handler>> | undefined;
  let shown: readonly Handler[] = [];
  let requests: readonly NetworkRequest[] = [];
  const tell = (): void => {
    const value: NetworkReport = {
      handlers: shown.map((handler) => ({ label: handlerLabel(handler) })),
      requests
    };
    report(value, { hint: String(requests.length) });
  };
  // the shell opens another story by loading another page; a page kept for the back button keeps its mocks
  window.addEventListener("pagehide", (event: PageTransitionEvent): void => {
    if (event.persisted || mocks === undefined) return;
    void mocks.then(
      (running) => running.stop(),
      () => undefined
    );
  });
  const start = (handlers: readonly Handler[]): Promise<StoryMocks<Handler>> =>
    startStoryMocks(handlers, loadMsw, ({ request, response }, isMocked) => {
      const { origin } = window.location;
      if (!isMocked && !isStoryRequest(request.url, origin)) return;
      requests = withRequest(requests, {
        method: request.method,
        url: shownUrl(request.url, origin),
        status: response.status,
        isMocked
      });
      tell();
    });
  return {
    prepare: async ({ parameters }: PluginPrepareContext): Promise<undefined> => {
      const handlers = mockHandlersOf(parameters).filter(isHandler);
      if (mocks !== undefined) {
        const running = await mocks;
        if (isSameHandlers(shown, handlers)) return undefined;
        running.renew(handlers);
        shown = handlers;
        tell();
        return undefined;
      }
      if (handlers.length === 0) return undefined;
      shown = handlers;
      tell();
      mocks = start(handlers);
      // a start that failed is tried again by the next mount
      await mocks.catch((error: unknown) => {
        mocks = undefined;
        throw error;
      });
      return undefined;
    }
  };
});
