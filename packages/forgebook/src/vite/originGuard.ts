/**
 * What the dev server's two origins answer a browser's request, from what the browser says of it (`Sec-Fetch-*`):
 * the catalogue's origin refuses what another origin's page asks, and the frames' origin serves only the frame page,
 * the public folder and the modules the catalogue imports. Pure: a request's facts in, an answer out.
 *
 * @remarks
 * Vite's CORS lets any page on `localhost` or `127.0.0.1` read the dev server, whatever its port: a frame on a second
 * port would read the catalogue's agent API and files as before. So the catalogue refuses a request another origin
 * sends, unless it is a navigation (a link, an embed), which shows a page but lets nobody read it.
 *
 * The frames' origin would otherwise serve everything the catalogue's does, and a story's script would read the
 * project from there. It serves a script or a `fetch` (whose body a script reads) only for a module that another
 * module of the catalogue imports: the browser learns a module's address only from its importer, which Vite reads and
 * records before answering, so a story's own modules always qualify and a file nothing imports (`/@fs/…?raw`) never
 * does. A request whose body a script cannot read as text (an image, a font, a style sheet, a worker's script, whose
 * exports stay in the worker) is left to Vite: the asset a style sheet names and a worker's file are not modules
 * another module imports.
 *
 * A request without `Sec-Fetch-*` comes from a tool (a command, an agent, `curl`) or an older browser: the `Origin`
 * header then tells another origin's page, and the frames' origin answers it as a script's.
 *
 * @module
 */

/** What a browser says of a request, from its headers. */
export type RequestFacts = {
  /** Its path, without the query (`/frame.html`). */
  readonly path: string;
  /** Its query, with its `?` (`?raw`); empty without one. */
  readonly query: string;
  /** `Sec-Fetch-Site`: whose page sent it (`same-origin`, `same-site`, `cross-site`, `none`); none from a tool. */
  readonly site: string | undefined;
  /** `Sec-Fetch-Mode`: `navigate` for a page or a frame opened. */
  readonly mode: string | undefined;
  /** `Sec-Fetch-Dest`: what the response becomes (`document`, `iframe`, `script`, `empty` for a `fetch`…). */
  readonly dest: string | undefined;
  /** `Origin`: the origin of the page that sent it, on a `fetch` or a module script; none on a plain navigation. */
  readonly origin: string | undefined;
  /** `Host`: the host and port the request was sent to. */
  readonly host: string | undefined;
};

/** The frame page's path. */
export const FRAME_PAGE_PATH = "/frame.html";

/** What becomes a document: a navigation, or something that opens one. */
const DOCUMENT_DESTS: ReadonlySet<string> = new Set(["document", "iframe", "frame", "object", "embed"]);

/**
 * What a script cannot read as text: drawn, played or applied as styles. Not a worker's or a worklet's script: a
 * module worker's own imports are sent as `worker` (an audio worklet's as `audioworklet`) and its exports go back to
 * the page, so they are served as a script is.
 */
const OPAQUE_DESTS: ReadonlySet<string> = new Set([
  "image",
  "font",
  "style",
  "audio",
  "video",
  "track",
  "manifest"
]);

/** The queries that ask Vite for a module made from a file (its text, its address…), never a file as it is. */
const TRANSFORM_QUERY = /[?&](?:raw|import|inline|url|worker|worker_file|sharedworker)(?:[&=]|$)/;

/** The dev server's own routes (`/__forgebook/api/`, `/__open-in-editor`): never a story's. */
const SERVER_ROUTE_PREFIX = "/__";

/**
 * Whether a request's `Origin` names another host than the one it was sent to: for a browser that sends no
 * `Sec-Fetch-Site`. Never asked of one that does, so a proxy that rewrites `Host` does not turn a page away from itself.
 *
 * @param request - what the browser says of it.
 */
const isOriginForeign = (request: RequestFacts): boolean => {
  if (request.origin === undefined) return false;
  try {
    return new URL(request.origin).host !== request.host;
  } catch {
    // `null`, from a sandboxed or opaque document
    return true;
  }
};

/**
 * Whether another origin's page sent a request that is not a navigation.
 *
 * @param request - what the browser says of it.
 */
const isFromAnotherOrigin = (request: RequestFacts): boolean => {
  if (request.mode === "navigate") return false;
  if (request.site === undefined) return isOriginForeign(request);
  return request.site === "same-site" || request.site === "cross-site";
};

/**
 * Whether another origin's page sent a request, a navigation included.
 *
 * @param request - what the browser says of it.
 */
const isAnyFromAnotherOrigin = (request: RequestFacts): boolean =>
  request.site === undefined
    ? isOriginForeign(request)
    : request.site === "same-site" || request.site === "cross-site";

/**
 * Whether a request opens a document: a navigation, or something that opens one.
 *
 * @param request - what the browser says of it.
 */
const isDocumentRequest = (request: RequestFacts): boolean =>
  request.mode === "navigate" || DOCUMENT_DESTS.has(request.dest ?? "");

/** What the catalogue's origin does with a request. */
export type CatalogueAnswer = "serve" | "refuse" | "to-frames";

/**
 * What the catalogue's origin does with a request: the frame page goes to the frames' origin, another origin's
 * request is refused, the rest is served.
 *
 * @param request - what the browser says of it.
 * @param framedPages - the server's routes that are pages made to be framed by another origin's page (a client's
 *   inline preview), which only show a story and act on nothing.
 */
export const catalogueAnswer = (request: RequestFacts, framedPages: ReadonlySet<string>): CatalogueAnswer => {
  if (isFromAnotherOrigin(request)) return "refuse";
  const isFramedPage = framedPages.has(request.path) && isDocumentRequest(request);
  // a route of the server acts when it is opened (`/__open-in-editor` opens a file): not on another page's say
  if (request.path.startsWith(SERVER_ROUTE_PREFIX) && !isFramedPage && isAnyFromAnotherOrigin(request))
    return "refuse";
  return request.path === FRAME_PAGE_PATH ? "to-frames" : "serve";
};

/** What the frames' origin does with a request: `ask-graph` serves it when another module imports it. */
export type FramesAnswer = "serve" | "refuse" | "not-found" | "ask-graph";

/** What the frames' origin knows of a request's path. */
export type FramesPaths = {
  /** Whether it names a file of the public folder. */
  readonly isPublic: boolean;
  /** Whether the frame page names it (its scripts, its head's tags). */
  readonly isPageEntry: boolean;
  /**
   * Whether the frames' origin serves it as the catalogue's does: the project's API through Vite's proxy, or a path
   * the configuration names (`frames.paths`, an API a plugin answers).
   */
  readonly isServedAlike: boolean;
};

/** Vite's own client and helpers, which the project's code does not hold. */
const VITE_PREFIXES = ["/@vite/", "/@id/__x00__vite/"];

/**
 * Whether the frames' origin serves a request as it is, without asking the graph: what a script cannot read as text,
 * the paths the server knows for the frames, and Vite's own client.
 *
 * @param request - what the browser says of it.
 * @param paths - what the server knows of its path.
 */
const isServedAsIs = (request: RequestFacts, paths: FramesPaths): boolean =>
  (OPAQUE_DESTS.has(request.dest ?? "") && !TRANSFORM_QUERY.test(request.query)) ||
  paths.isPublic ||
  paths.isPageEntry ||
  paths.isServedAlike ||
  VITE_PREFIXES.some((prefix) => request.path.startsWith(prefix));

/**
 * What the frames' origin does with a request.
 *
 * @param request - what the browser says of it.
 * @param paths - what the server knows of its path.
 */
export const framesAnswer = (request: RequestFacts, paths: FramesPaths): FramesAnswer => {
  if (isFromAnotherOrigin(request)) return "refuse";
  // the catalogue's page is the catalogue origin's alone; the frame page holds nothing a script could use
  if (request.path === "/" || request.path === "/index.html") return "not-found";
  if (request.path === FRAME_PAGE_PATH) return "serve";
  if (isDocumentRequest(request)) return paths.isPublic || paths.isServedAlike ? "serve" : "not-found";
  if (request.path.startsWith(SERVER_ROUTE_PREFIX)) return "refuse";
  return isServedAsIs(request, paths) ? "serve" : "ask-graph";
};

/**
 * The paths a page's HTML names: its scripts' and links' addresses, and the modules its inline scripts import.
 *
 * @param html - the page's HTML, as Vite transformed it.
 */
export const pageEntries = (html: string): ReadonlySet<string> =>
  new Set(
    [...html.matchAll(/["'](\/[^"'\s?#]*)/g)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
  );

/** How Vite writes a module id that is no path (a virtual module's) in an address. */
const ID_PREFIX = "/@id/";

/**
 * A request's address as Vite's module graph names the module, as Vite's own transform reads it: decoded, a virtual
 * module's id unwrapped (`/@id/__x00__virtual:…` is `\0virtual:…`); none when it cannot be decoded.
 *
 * @param url - the request's address, with its query.
 */
export const graphUrlOf = (url: string): string | undefined => {
  let decoded: string;
  try {
    decoded = decodeURI(url).replace("__x00__", "\0");
  } catch {
    return undefined;
  }
  return decoded.startsWith(ID_PREFIX) ? decoded.slice(ID_PREFIX.length) : decoded;
};
