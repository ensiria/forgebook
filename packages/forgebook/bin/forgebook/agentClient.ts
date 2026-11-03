/**
 * How `forgebook stories`, `forgebook story` and `forgebook mcp` get their answers: from the catalogue's running dev
 * server when it serves this catalogue, otherwise from a dev server of their own, started without listening.
 *
 * @remarks
 * A running `forgebook dev` answers at once and its links work. A server of their own is started in the same process
 * (Vite in middleware mode: no port, nothing reachable from outside) and the same function answers; its links name
 * where `forgebook dev` serves by default, so they work once it runs. A server found at the address is used only when
 * it says it serves this catalogue's folder (`ROOT_HEADER`), never another project's catalogue on the same port. A
 * server of their own keeps its pre-bundled dependencies apart from the dev server's (`commandServer.ts`).
 *
 * @module
 */
import { readFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";

import { createServer, type ViteDevServer } from "vite";

import { AGENT_INDEX_FILE, indexAnswer, isAgentIndex } from "../../src/vite/agentIndex.ts";
import {
  AGENT_API,
  type AgentAnswer,
  agentAnswer,
  agentServer,
  ROOT_HEADER,
  rootHeaderValue
} from "../../src/vite/agentRoutes.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { commandServerVite } from "./commandServer.ts";

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
    await commandServerVite(config, {
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
      logLevel: "error"
    })
  );
  return {
    ask: (route: string, params: URLSearchParams): Promise<AgentAnswer> =>
      agentAnswer(agentServer(server, config), config, route, params, origin),
    runningAt: undefined,
    close: () => server.close()
  };
};

/** The largest index read, in bytes, and how long an address may take: what it answers is not trusted. */
const MAX_INDEX_BYTES = 64 * 1024 * 1024;
const INDEX_TIMEOUT = 30_000;

/** A response's text, up to the largest index: an endless answer would otherwise fill the memory. */
const boundedText = async (response: Response, address: string): Promise<string> => {
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const part of response.body ?? []) {
    size += part.byteLength;
    if (size > MAX_INDEX_BYTES) throw new Error(`${address} is over ${MAX_INDEX_BYTES} bytes`);
    parts.push(part);
  }
  return Buffer.concat(parts).toString("utf8");
};

/** Where `forgebook mcp --from` reads the index: a built catalogue's address, or its folder. */
const indexSource = (from: string): { readonly text: () => Promise<string>; readonly origin: string } => {
  if (!/^https?:\/\//i.test(from)) {
    return { text: () => readFile(resolve(from, AGENT_INDEX_FILE), "utf8"), origin: "" };
  }
  const origin = from.replace(/\/+$/, "");
  const address = `${origin}/${AGENT_INDEX_FILE}`;
  const text = async (): Promise<string> => {
    const response = await fetch(address, { signal: AbortSignal.timeout(INDEX_TIMEOUT) });
    if (!response.ok) throw new Error(`${address} answered ${response.status}`);
    return boundedText(response, address);
  };
  return { text, origin };
};

/** The parsed index: a host's fallback page is not JSON, and that is the same as no index. */
const parsedIndex = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** An answer that can be sent: a file's shape is checked only at its top, and text too deep to write must not end the server. */
const sendable = (answer: AgentAnswer): AgentAnswer => {
  try {
    JSON.stringify(answer.body);
    return answer;
  } catch {
    return { status: 500, body: { error: "The index holds an answer that cannot be written" } };
  }
};

/**
 * The answers of a built catalogue, from its index.
 *
 * @param from - its address, or its folder; the links work from an address, and are paths from a folder.
 * @returns the client.
 * @throws when there is no index, or this version cannot read it.
 */
export const indexClient = async (from: string): Promise<CatalogueClient> => {
  const { text, origin } = indexSource(from);
  const index = parsedIndex(await text());
  if (!isAgentIndex(index)) {
    throw new Error(`${from} holds no index this version reads: \`forgebook build --agent-index\` writes it`);
  }
  const pages = { page: `${origin}/`, frame: `${origin}/frame.html` };
  return {
    ask: async (route: string, params: URLSearchParams): Promise<AgentAnswer> =>
      sendable(indexAnswer(index, pages, route, params)),
    runningAt: undefined,
    close: async () => undefined
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
 * A dev server of its own, listening on the local address.
 *
 * @param config - the catalogue's configuration.
 * @param port - the port, which must be free; 0 for any free one.
 */
const ownListening = async (config: ResolvedConfig, port: number): Promise<ServedCatalogue> => {
  const server: ViteDevServer = await createServer(
    await commandServerVite(config, {
      server: { port, strictPort: port !== 0, host: "127.0.0.1" },
      logLevel: "error"
    })
  );
  try {
    await server.listen();
  } catch (error) {
    // a server that could not listen still watches the files, which would keep the process alive
    await server.close();
    throw error;
  }
  const address = server.resolvedUrls?.local[0]?.replace(/\/+$/, "");
  if (address === undefined) {
    await server.close();
    throw new Error("The catalogue's dev server started with no address");
  }
  return { origin: address, runningAt: undefined, close: () => server.close() };
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
  return ownListening(config, 0);
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

/** A port free right now, asked of the system. */
const freePort = (): Promise<number> =>
  new Promise((done, fail) => {
    const probe = createNetServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => done(port));
    });
  });

/** Where a client that renders apps gets a story's preview from. */
export type PreviewServer = {
  /** The address previews will come from, with nothing started: a host may read it before any story is asked for. */
  readonly origin: () => Promise<string>;
  /** Serves the catalogue at that address, once, and answers it. */
  readonly serve: () => Promise<string>;
  /** Stops what it started. */
  readonly close: () => Promise<void>;
};

/**
 * The previews' server: the running dev server, or one of its own started when the first preview is asked for.
 *
 * @remarks
 * A host learns the origin it may frame when it reads the app's resource, which it may do at connection, long before
 * anyone asks for a story. So the address is settled then, a port taken from the system and left free, and the server
 * comes up on that port only when a story is asked for; were another program to take the port in between, the preview
 * fails and the page falls back to a picture.
 *
 * @param config - the catalogue's configuration.
 * @param runningAt - the running dev server, when there is one.
 */
export const previewServer = (config: ResolvedConfig, runningAt: string | undefined): PreviewServer => {
  if (runningAt !== undefined)
    return { origin: async () => runningAt, serve: async () => runningAt, close: async () => undefined };
  let port: Promise<number> | undefined;
  let served: Promise<ServedCatalogue> | undefined;
  const portOf = (): Promise<number> => {
    port ??= freePort();
    return port;
  };
  const started = async (): Promise<ServedCatalogue> => ownListening(config, await portOf());
  return {
    origin: async () => `http://127.0.0.1:${await portOf()}`,
    serve: async () => {
      served ??= started();
      try {
        return (await served).origin;
      } catch (error) {
        served = undefined;
        throw error;
      }
    },
    close: async () => {
      await (await served)?.close();
    }
  };
};
