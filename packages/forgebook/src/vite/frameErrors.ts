/**
 * What the dev server does with the errors the open frames report: keeps each, with the place its stack maps to, and
 * answers the frame with the stack in the lines of the files as written.
 *
 * @remarks
 * The mapping runs here, on the maps of the modules the server served (`stackLines.ts`), so the frame loads no decoder
 * and no map. A stack that cannot be mapped is kept and answered as it came. Used by the plugin's dev server.
 *
 * @module
 */
import type { ViteDevServer, WebSocketClient } from "vite";

import {
  isLiveErrorReport,
  LIVE_ERROR_EVENT,
  type LiveErrorReport,
  type LiveErrors,
  MAPPED_STACK_EVENT,
  type MappedStackAnswer
} from "../liveErrors.ts";
import { type MappedStack, mappedStack, type ServedModule } from "./stackLines.ts";

/**
 * The module the dev server served at an address, with its map: none for another address or one it keeps no map of.
 *
 * @param server - the dev server.
 * @param address - the address, as a stack names it: the server's own or its frames' origin, which serve the same
 *   modules.
 */
const servedModule = async (server: ViteDevServer, address: string): Promise<ServedModule | undefined> => {
  let url: string;
  try {
    const parsed = new URL(address);
    url = `${parsed.pathname}${parsed.search}`;
  } catch {
    return undefined;
  }
  const module = await server.environments.client.moduleGraph.getModuleByUrl(url);
  const map = module?.transformResult?.map;
  if (module?.file == null || map == null || !("version" in map)) return undefined;
  return { file: module.file, map };
};

/**
 * A report's stack mapped, or as it came when the mapping fails.
 *
 * @param server - the dev server.
 * @param stack - the stack the frame sent.
 */
const mapped = async (server: ViteDevServer, stack: string): Promise<MappedStack> => {
  try {
    return await mappedStack(stack, (address) => servedModule(server, address), server.config.root);
  } catch {
    return { stack };
  }
};

/**
 * Keeps a report, its stack swapped for the place it maps to, and answers the frame with the stack mapped.
 *
 * @param server - the dev server.
 * @param live - the errors kept.
 * @param report - the frame's report.
 * @param client - the frame's connection.
 */
const keep = async (
  server: ViteDevServer,
  live: LiveErrors,
  report: LiveErrorReport,
  client: WebSocketClient
): Promise<void> => {
  const { stack, ...kept } = report;
  if (stack === undefined) {
    live.add(kept, new Date());
    return;
  }
  const result = await mapped(server, stack);
  live.add(result.place === undefined ? kept : { ...kept, place: result.place }, new Date());
  const answer: MappedStackAnswer = { sent: stack, stack: result.stack };
  client.send(MAPPED_STACK_EVENT, answer);
};

/**
 * Listens to the frames' error reports on the dev server's connection.
 *
 * @param server - the dev server.
 * @param live - where the errors are kept.
 */
export const receiveFrameErrors = (server: ViteDevServer, live: LiveErrors): void => {
  server.ws.on(LIVE_ERROR_EVENT, (report: unknown, client: WebSocketClient): void => {
    if (!isLiveErrorReport(report)) return;
    keep(server, live, report, client).catch((error: unknown) =>
      server.config.logger.error(
        `Forgebook could not keep a frame's error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  });
};
