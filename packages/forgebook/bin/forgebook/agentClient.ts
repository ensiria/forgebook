/**
 * How `forgebook stories`, `forgebook story` and `forgebook mcp` get their answers: from the catalogue's running dev
 * server when it serves this catalogue, otherwise from a dev server of their own, started without listening.
 *
 * @remarks
 * A running `forgebook dev` answers at once and its links work. A server of their own is started in the same process
 * (Vite in middleware mode: no port, nothing reachable from outside) and the same function answers; its links name
 * where `forgebook dev` serves by default, so they work once it runs. A server found at the address is used only when
 * it says it serves this catalogue's folder (`ROOT_HEADER`), never another project's catalogue on the same port.
 *
 * @module
 */
import { createServer, type ViteDevServer } from "vite";

import {
  AGENT_API,
  type AgentAnswer,
  agentAnswer,
  ROOT_HEADER,
  rootHeaderValue
} from "../../src/vite/agentRoutes.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";

/** Where `forgebook dev` serves when no port is given: Vite's default. */
export const DEFAULT_ORIGIN = "http://localhost:5173";

/** The catalogue's answers, from wherever they come. */
export type CatalogueClient = {
  /** Asks one of the API's paths (`stories`, `story`) with its query. */
  readonly ask: (route: string, params: URLSearchParams) => Promise<AgentAnswer>;
  /** Where the answers come from: the running server's address, or none for a server of its own. */
  readonly runningAt: string | undefined;
  /** Stops the server it started; nothing for a running one. */
  readonly close: () => Promise<void>;
};

/**
 * Asks a running dev server, if one at the address serves this catalogue.
 *
 * @param origin - the address to try.
 * @param config - the catalogue's configuration, whose folder the server must name.
 * @returns the client, or none when nothing there serves this catalogue.
 */
const runningClient = async (
  origin: string,
  config: ResolvedConfig
): Promise<CatalogueClient | undefined> => {
  const ask = async (route: string, params: URLSearchParams): Promise<AgentAnswer> => {
    const response = await fetch(`${origin}${AGENT_API}${route}?${params.toString()}`);
    return { status: response.status, body: await response.json() };
  };
  try {
    const probe = await fetch(`${origin}${AGENT_API}stories`, { signal: AbortSignal.timeout(2000) });
    if (probe.headers.get(ROOT_HEADER) !== rootHeaderValue(config.dir)) return undefined;
    await probe.body?.cancel();
  } catch {
    return undefined;
  }
  return { ask, runningAt: origin, close: async () => undefined };
};

/**
 * A dev server of its own, in middleware mode, and the answers from it.
 *
 * @param config - the catalogue's configuration.
 * @param origin - the address the links name.
 */
const ownClient = async (config: ResolvedConfig, origin: string): Promise<CatalogueClient> => {
  const server: ViteDevServer = await createServer(
    await catalogueVite(config, {
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
      logLevel: "error"
    })
  );
  return {
    ask: (route: string, params: URLSearchParams): Promise<AgentAnswer> =>
      agentAnswer((id: string) => server.ssrLoadModule(id), config, route, params, origin),
    runningAt: undefined,
    close: () => server.close()
  };
};

/** A catalogue a browser can open: its address, and how to let it go. */
export type ServedCatalogue = {
  /** Its address (`http://localhost:5173`). */
  readonly origin: string;
  /** Where it was already running, or none for a server started for the command. */
  readonly runningAt: string | undefined;
  /** Stops the server it started; nothing for a running one. */
  readonly close: () => Promise<void>;
};

/**
 * The catalogue served over HTTP, for a browser to open its frames: the running dev server at the address when it
 * serves this catalogue, else a dev server of its own on a free port (its answers' middleware has no address).
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 */
export const servedCatalogue = async (
  config: ResolvedConfig,
  url: string | undefined
): Promise<ServedCatalogue> => {
  const origin = (url ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
  const running = await runningClient(origin, config);
  if (running !== undefined) return { origin, runningAt: origin, close: async () => undefined };
  const server: ViteDevServer = await createServer(
    await catalogueVite(config, { server: { port: 0, host: "127.0.0.1" }, logLevel: "error" })
  );
  await server.listen();
  const address = server.resolvedUrls?.local[0]?.replace(/\/+$/, "");
  if (address === undefined) {
    await server.close();
    throw new Error("The catalogue's dev server started with no address");
  }
  return { origin: address, runningAt: undefined, close: () => server.close() };
};

/**
 * The catalogue's answers: the running dev server at the address when it serves this catalogue, a server of its own
 * otherwise.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 */
export const catalogueClient = async (
  config: ResolvedConfig,
  url: string | undefined
): Promise<CatalogueClient> => {
  const origin = (url ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
  return (await runningClient(origin, config)) ?? ownClient(config, origin);
};
