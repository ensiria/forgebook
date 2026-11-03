/**
 * The plugin's frame module: starts a story's mocks before its first mount's loaders, keeps them until the page is left,
 * and tells the Network tab what they do.
 *
 * @module
 */
import {
  definePluginFrame,
  type PluginFrame,
  type PluginFrameHost,
  type PluginPrepareContext
} from "forgebook/plugin";

import {
  isStoryRequest,
  type NetworkReport,
  type NetworkRequest,
  shownUrl,
  withRequest
} from "./networkReport.ts";
import { handlerLabel, handlersOf, type MockTools, startStoryMocks } from "./storyMocks.ts";

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

/** The plugin's frame. */
export const frame = definePluginFrame(({ report }: PluginFrameHost): PluginFrame => {
  // the story's mocks, started by its first mount and kept until the page is left: a frame shows one story, every mount
  // has its handlers, and stopping MSW's worker to start it at once again lets the worker forget the page after it
  // started serving it again, so the new mount's requests would go to the network
  let mocks: Promise<() => Promise<void>> | undefined;
  // the shell opens another story by loading another page; a page kept for the back button keeps its mocks
  window.addEventListener("pagehide", (event: PageTransitionEvent): void => {
    if (event.persisted || mocks === undefined) return;
    void mocks.then(
      (stop) => stop(),
      () => undefined
    );
  });
  return {
    prepare: async ({ parameters }: PluginPrepareContext): Promise<undefined> => {
      if (mocks !== undefined) {
        await mocks;
        return undefined;
      }
      const handlers = handlersOf(parameters).filter(isHandler);
      if (handlers.length === 0) return undefined;
      const labels = handlers.map((handler) => ({ label: handlerLabel(handler) }));
      let requests: readonly NetworkRequest[] = [];
      const tell = (): void => {
        const value: NetworkReport = { handlers: labels, requests };
        report(value, { hint: String(requests.length) });
      };
      tell();
      mocks = startStoryMocks(handlers, loadMsw, ({ request, response }, isMocked) => {
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
      // a start that failed is tried again by the next mount
      await mocks.catch((error: unknown) => {
        mocks = undefined;
        throw error;
      });
      return undefined;
    }
  };
});
