/**
 * The plugin's frame module: starts a story's mocks before its loaders, and tells the Network tab what they do.
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
import { handlerLabel, handlersOf, startStoryMocks } from "./storyMocks.ts";

/** MSW's browser module. */
type MswBrowser = typeof import("msw/browser");

/** A handler, as MSW takes it. */
type Handler = Parameters<MswBrowser["setupWorker"]>[number];

/** Loads MSW, the first time a story needs it. */
const loadMsw = (): Promise<MswBrowser> => import("msw/browser");

/** Whether a value a story's parameters list can be a handler; MSW itself says what a wrong one lacks. */
const isHandler = (value: unknown): value is Handler => typeof value === "object" && value !== null;

/** The plugin's frame. */
export const frame = definePluginFrame(
  ({ report }: PluginFrameHost): PluginFrame => ({
    prepare: async ({ parameters }: PluginPrepareContext): Promise<(() => void) | undefined> => {
      const handlers = handlersOf(parameters).filter(isHandler);
      if (handlers.length === 0) return undefined;
      const labels = handlers.map((handler) => ({ label: handlerLabel(handler) }));
      let requests: readonly NetworkRequest[] = [];
      const tell = (): void => {
        const value: NetworkReport = { handlers: labels, requests };
        report(value, String(requests.length));
      };
      tell();
      return startStoryMocks(handlers, loadMsw, ({ request, response }, isMocked) => {
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
    }
  })
);
