/**
 * The dev server's second port, for the stories' frames: the same Vite server (its middlewares, its module graph, its
 * WebSocket) on an origin of its own, and the guards that keep the two origins apart (`originGuard.ts`).
 *
 * @remarks
 * One Vite server, two `http.Server`s: no second module graph, no second watcher. The frames' port listens on the
 * catalogue's address, over HTTPS when the catalogue does, and hands its WebSocket upgrades (the frames' HMR, the
 * errors they report) to Vite's. Its port is the catalogue's + 1 by default, the next free one when that is taken; a
 * port the configuration gives must be free.
 *
 * Vite in middleware mode has no server of its own to add a port beside: its frames stay on the catalogue's origin.
 *
 * @module
 */
import { existsSync, statSync } from "node:fs";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { resolve, sep } from "node:path";
import type { Duplex } from "node:stream";

import type { ViteDevServer } from "vite";

import { type FramesPlacement, SAME_ORIGIN } from "../frameOrigins.ts";
import type { ResolvedConfig } from "./configFile.ts";
import type { ResolvedFrames } from "./framesConfig.ts";
import { framesOriginOf, servedPlacement } from "./framesConfig.ts";
import {
  catalogueAnswer,
  FRAME_PAGE_PATH,
  type FramesAnswer,
  framesAnswer,
  graphUrlOf,
  pageEntries,
  type RequestFacts
} from "./originGuard.ts";
import { pageHtml } from "./pages.ts";

/** How many ports after the default one the frames try before taking any free port. */
const PORT_TRIES = 20;

/** A Connect middleware. */
type Middleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void
) => void;

/** The frames' side of a dev server. */
export type FramesServing = {
  /** The catalogue origin's guard: installed before every other middleware. */
  readonly catalogueGuard: Middleware;
  /** Opens the frames' port once the catalogue's listens; where the frames run then. */
  readonly start: () => Promise<FramesPlacement>;
  /** Where the frames run, once `start` is over. */
  readonly placement: () => Promise<FramesPlacement>;
};

/**
 * A header's single value.
 *
 * @param request - the request.
 * @param name - the header's name, in lower case.
 */
const headerOf = (request: IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * The host and port a request was sent to: `Host`, or `:authority` over HTTP/2, which has no `Host`.
 *
 * @param request - the request.
 */
export const hostOf = (request: IncomingMessage): string | undefined =>
  headerOf(request, "host") ?? headerOf(request, ":authority");

/**
 * Whether a path goes to the project's own server through Vite's proxy (`server.proxy`), as a story's API call does.
 *
 * @param proxy - Vite's proxy, by its paths: a prefix, or a regular expression when it starts with `^`.
 * @param url - the request's address.
 */
const isProxied = (proxy: Readonly<Record<string, unknown>> | undefined, url: string): boolean =>
  Object.keys(proxy ?? {}).some((key) =>
    key.startsWith("^") ? new RegExp(key).test(url) : url.startsWith(key)
  );

/**
 * A request's path as an address parser reads it, which is how the routes behind the guards read it: a guard that read
 * `//x/__forgebook/api/stories` as written would pass what the route answers as `/__forgebook/api/stories`.
 *
 * @param url - the request's address, as it was sent.
 */
const parsedPath = (url: string): string => {
  try {
    return new URL(url, "http://parsed.invalid").pathname;
  } catch {
    return (url.split("?")[0] ?? url).split("#")[0] ?? "/";
  }
};

/**
 * What the browser says of a request.
 *
 * @param request - the request.
 */
const factsOf = (request: IncomingMessage): RequestFacts => {
  const url = request.url ?? "/";
  const queryAt = url.indexOf("?");
  return {
    path: parsedPath(url),
    query: queryAt === -1 ? "" : (url.slice(queryAt).split("#")[0] ?? ""),
    site: headerOf(request, "sec-fetch-site"),
    mode: headerOf(request, "sec-fetch-mode"),
    dest: headerOf(request, "sec-fetch-dest"),
    origin: headerOf(request, "origin"),
    host: hostOf(request)
  };
};

/**
 * Whether a path names a file of the public folder.
 *
 * @param publicDir - the public folder's absolute path; empty when there is none.
 * @param path - the request's path.
 */
const isPublicFile = (publicDir: string, path: string): boolean => {
  if (publicDir === "") return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  const file = resolve(publicDir, `.${decoded}`);
  return file.startsWith(`${publicDir}${sep}`) && existsSync(file) && statSync(file).isFile();
};

/**
 * Whether a module the catalogue imports names an address in its code, as a whole string: how a worker's file
 * (`?worker_file`) is started. Only an imported module counts, and only a whole string: an address asked for directly
 * writes its own query into its module's code (its HMR context), and a story's script could plant any address there.
 *
 * @param modules - the graph's modules.
 * @param url - the address, as the graph reads it; its `t=` left out.
 */
const isNamedInCode = (
  modules: readonly {
    readonly importers: ReadonlySet<unknown>;
    readonly transformResult: { readonly code: string } | null;
  }[],
  url: string
): boolean => {
  const named = JSON.stringify(url.replace(/[?&]t=\d+/, ""));
  return modules.some(
    (module) => module.importers.size > 0 && module.transformResult?.code.includes(named) === true
  );
};

/**
 * Ends a request the guards turned down, with its status and nothing a page could use.
 *
 * @param response - the response.
 * @param status - 403 or 404.
 */
const turnDown = (response: ServerResponse, status: 403 | 404): void => {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain");
  response.end(status === 403 ? "Forbidden to the stories' frames\n" : "Not found\n");
};

/**
 * Listens on a port, or tells why it could not.
 *
 * @param server - the server.
 * @param port - the port; 0 for any free one.
 * @param host - the address.
 * @returns the port it listens on, or the error.
 */
const listenOn = (server: Server, port: number, host: string): Promise<number | NodeJS.ErrnoException> =>
  new Promise((done) => {
    const onError = (error: NodeJS.ErrnoException): void => done(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const address = server.address();
      done(address !== null && typeof address === "object" ? address.port : port);
    });
  });

/**
 * Listens on the first free port of a list.
 *
 * @param server - the server.
 * @param ports - the ports, in order; 0 for any free one.
 * @param host - the address.
 * @returns the port it listens on; none when every port is taken.
 * @throws when listening fails for another reason than a port taken.
 */
const listenOnFirstFree = async (
  server: Server,
  ports: readonly number[],
  host: string
): Promise<number | undefined> => {
  for (const port of ports.filter((each) => each <= 65535)) {
    const listened = await listenOn(server, port, host);
    if (typeof listened === "number") return listened;
    if (listened.code !== "EADDRINUSE") throw listened;
  }
  return undefined;
};

/**
 * The frames' `http.Server`, over HTTPS when the catalogue's is, its WebSocket upgrades handed to Vite's, closed with
 * the catalogue's.
 *
 * @param server - the dev server.
 * @param catalogue - the catalogue's own server.
 * @param handle - answers a request.
 */
const framesHttpServer = (
  server: ViteDevServer,
  catalogue: NonNullable<ViteDevServer["httpServer"]>,
  handle: (request: IncomingMessage, response: ServerResponse) => void
): Server => {
  const https = server.config.server.https;
  const framesServer = https === undefined ? createHttpServer(handle) : createHttpsServer(https, handle);
  framesServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    catalogue.emit("upgrade", request, socket, head);
  });
  catalogue.once("close", (): void => {
    framesServer.closeAllConnections();
    framesServer.close();
  });
  return framesServer;
};

/**
 * The frames' side of a dev server.
 *
 * @param server - the dev server.
 * @param frames - where the configuration puts the frames.
 * @param frameHtml - the frame page's HTML, before Vite transforms it.
 * @param framedPages - the server's pages another origin's page may frame (`catalogueAnswer`).
 */
export const framesServing = (
  server: ViteDevServer,
  frames: ResolvedFrames,
  frameHtml: string,
  framedPages: ReadonlySet<string>
): FramesServing => {
  /** The requests that came in on the frames' port: the catalogue's guard leaves them to the frames'. */
  const framesRequests = new WeakSet<IncomingMessage>();
  const sharedPaths = frames.kind === "isolated" ? frames.paths : [];
  let framesPort: number | undefined;
  let settle: (placement: FramesPlacement) => void = () => undefined;
  const placed = new Promise<FramesPlacement>((resolvePlacement) => {
    settle = resolvePlacement;
  });
  // the paths the frame page names, read once from the page as Vite serves it
  let entries: Promise<ReadonlySet<string>> | undefined;
  const pageEntriesOnce = (): Promise<ReadonlySet<string>> => {
    entries ??= server.transformIndexHtml(FRAME_PAGE_PATH, frameHtml).then(pageEntries);
    return entries;
  };
  const scheme = server.config.server.https === undefined ? "http:" : "https:";

  /** The frames' origin for a request to the catalogue: the configured one, or its host on the frames' port. */
  const framesOriginFor = (request: IncomingMessage): string | undefined => {
    if (frames.kind === "same-origin" || framesPort === undefined) return undefined;
    if (frames.origins !== undefined) return frames.origins.frames;
    const host = hostOf(request);
    if (host === undefined) return undefined;
    try {
      return new URL(`${scheme}//${new URL(`${scheme}//${host}`).hostname}:${framesPort}`).origin;
    } catch {
      return undefined;
    }
  };

  const catalogueGuard: Middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void
  ): void => {
    if (framesRequests.has(request)) {
      next();
      return;
    }
    const answer = catalogueAnswer(factsOf(request), framedPages, (path) =>
      isPublicFile(server.config.publicDir, path)
    );
    if (answer === "refuse") {
      turnDown(response, 403);
      return;
    }
    const framesOrigin = answer === "to-frames" ? framesOriginFor(request) : undefined;
    if (framesOrigin === undefined) {
      next();
      return;
    }
    response.statusCode = 307;
    response.setHeader("Location", `${framesOrigin}${request.url ?? FRAME_PAGE_PATH}`);
    response.end();
  };

  /** What the frames' port does with a request. */
  const framesAnswerFor = async (request: IncomingMessage): Promise<FramesAnswer> => {
    const facts = factsOf(request);
    const answer = framesAnswer(facts, {
      isPublic: isPublicFile(server.config.publicDir, facts.path),
      isPageEntry: (await pageEntriesOnce()).has(facts.path),
      isServedAlike:
        isProxied(server.config.server.proxy, request.url ?? "/") ||
        sharedPaths.some((path) => facts.path.startsWith(path))
    });
    if (answer !== "ask-graph") return answer;
    const url = graphUrlOf(request.url ?? "/");
    if (url === undefined) return "refuse";
    const graph = server.environments.client.moduleGraph;
    const module = await graph.getModuleByUrl(url);
    if (module !== undefined && module.importers.size > 0) return "serve";
    // a worker's own file, the file a `?url` import or `new URL(…, import.meta.url)` gives: no module imports them,
    // the module that uses them names them in its code
    return isNamedInCode([...graph.idToModuleMap.values()], url) ? "serve" : "refuse";
  };

  const handleFrames = (request: IncomingMessage, response: ServerResponse): void => {
    framesRequests.add(request);
    framesAnswerFor(request)
      .then((answer) => {
        if (answer === "serve") server.middlewares(request, response);
        else turnDown(response, answer === "not-found" ? 404 : 403);
      })
      .catch((error: unknown) => {
        server.config.logger.error(
          `Forgebook's frames: ${error instanceof Error ? error.message : String(error)}`
        );
        turnDown(response, 403);
      });
  };

  const start = async (): Promise<FramesPlacement> => {
    const catalogue = server.httpServer?.address();
    if (frames.kind === "same-origin" || server.httpServer === null || typeof catalogue !== "object") {
      if (frames.kind === "isolated")
        server.config.logger.warn(
          "Forgebook's frames share the catalogue's origin: Vite runs without a server of its own (middleware " +
            "mode), so there is no port to give them, and a story's code can reach the catalogue"
        );
      settle(SAME_ORIGIN);
      return SAME_ORIGIN;
    }
    if (catalogue === null) throw new Error("Forgebook's frames start once the catalogue listens");
    const framesServer = framesHttpServer(server, server.httpServer, handleFrames);
    const wanted = frames.port ?? catalogue.port + 1;
    // a port the configuration gives is that port; the default moves on, as Vite's own does
    const tries =
      frames.port === undefined
        ? [...Array.from({ length: PORT_TRIES }, (_, index) => wanted + index), 0]
        : [wanted];
    const listened = await listenOnFirstFree(framesServer, tries, catalogue.address);
    if (listened === undefined)
      throw new Error(`Forgebook's frames: port ${wanted} is taken (frames.port, --frame-port)`);
    framesPort = listened;
    const placement = servedPlacement(frames, { catalogue: catalogue.port, frames: listened });
    settle(placement);
    return placement;
  };

  return { catalogueGuard, start, placement: () => placed };
};

/**
 * Gives the dev server's frames an origin of their own: the catalogue's guard first among the middlewares, the frames'
 * port opened as the catalogue's listens (a port that cannot be had fails the start), and its address printed with
 * the catalogue's.
 *
 * @param server - the dev server.
 * @param config - the catalogue's configuration.
 * @param place - receives where the frames run, for the pages' configuration.
 * @param framedPages - the server's pages another origin's page may frame (a client's inline preview).
 */
export const serveFrames = (
  server: ViteDevServer,
  config: ResolvedConfig,
  place: (placement: () => Promise<FramesPlacement>) => void,
  framedPages: ReadonlySet<string>
): void => {
  // the placement only changes the guard's inline script, never the entries this page is read for
  const frames = framesServing(
    server,
    config.frames,
    pageHtml("frame.html", config, SAME_ORIGIN),
    framedPages
  );
  place(frames.placement);
  server.middlewares.use(frames.catalogueGuard);
  // in middleware mode nothing listens here: the frames stay on the catalogue's origin, known at once
  if (server.httpServer === null) {
    void frames.start();
    return;
  }
  const listen = server.listen;
  server.listen = async (port?: number, isRestart?: boolean): Promise<ViteDevServer> => {
    const listening = await listen(port, isRestart);
    try {
      await frames.start();
    } catch (error) {
      // a catalogue whose frames cannot open must not keep serving pages that wait for them
      await server.close();
      throw error;
    }
    return listening;
  };
  const printUrls = server.printUrls;
  server.printUrls = (): void => {
    printUrls();
    void frames.placement().then((placement: FramesPlacement): void => {
      const origin = framesOriginOf(placement, server.resolvedUrls?.local[0]);
      if (origin !== undefined) server.config.logger.info(`  ➜  Frames:  ${origin}/`);
    });
  };
};
