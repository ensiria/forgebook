/**
 * The `frames` option of a catalogue's configuration: where its stories' frames run, checked and resolved, and the
 * placement the pages read from it on the dev server and in a build.
 *
 * @remarks
 * The frames get an origin of their own by default: on the dev server a second port, so a story's code cannot reach
 * the catalogue's page, the agent API or the project's files. A static build has one host unless the configuration
 * names two (`origins`), so it keeps the catalogue's origin otherwise. `"same-origin"` runs them on the catalogue's
 * origin everywhere, for a place that gives one port only (a container with one port open).
 *
 * @module
 */
import { type FramesPlacement, type PageOrigins, pageOrigins, SAME_ORIGIN } from "../frameOrigins.ts";

/** Where the stories' frames run, as `forgebook.config.ts` writes it. */
export type FramesOption =
  | "same-origin"
  | {
      /**
       * The dev server's port for the frames: the catalogue's port + 1 by default, the next free one when that is
       * taken. A port given here must be free.
       */
      readonly port?: number;
      /**
       * The catalogue's origin and the frames', as the browser reaches them, when the frames' is not the catalogue's
       * host on the frames' port: a static build served from two hosts (`https://frames.example.com`, a subdomain of
       * the catalogue's site), or a dev server behind a proxy that gives each port a host of its own.
       */
      readonly origins?: { readonly catalogue: string; readonly frames: string };
      /**
       * Paths the frames' port serves as the catalogue's does, for an API a Vite plugin answers (`["/api/"]`): the
       * frames' port serves only the frame page, the public folder, the modules the stories import and Vite's proxy.
       */
      readonly paths?: readonly string[];
    };

/** The `frames` option, resolved. */
export type ResolvedFrames =
  | {
      /** On the catalogue's origin. */
      readonly kind: "same-origin";
    }
  | {
      /** On an origin of their own. */
      readonly kind: "isolated";
      /** The dev server's port for the frames, when the configuration gives one. */
      readonly port: number | undefined;
      /** The two origins as the browser reaches them, when the configuration names them. */
      readonly origins: PageOrigins | undefined;
      /** The paths the frames' port serves as the catalogue's does. */
      readonly paths: readonly string[];
    };

/** The default: an origin of their own, on the next port. */
export const ISOLATED_FRAMES: ResolvedFrames = {
  kind: "isolated",
  port: undefined,
  origins: undefined,
  paths: []
};

/**
 * The origin a value names, when it is one: `http:` or `https:`, a host and maybe a port, nothing after but a slash.
 *
 * @param value - the value.
 */
const originOf = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const isBare = url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "";
    return (url.protocol === "http:" || url.protocol === "https:") && isBare ? url.origin : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Why a `frames.port` cannot be used, or none.
 *
 * @param port - the port, as the configuration gives it; none when it gives none.
 */
const portProblem = (port: unknown): string | undefined =>
  port === undefined || (typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535)
    ? undefined
    : "`frames.port` is a port number (1 to 65535)";

/**
 * Why `frames.origins` cannot be used, or none.
 *
 * @param origins - the origins, as the configuration gives them; none when it gives none.
 */
const originsProblem = (origins: unknown): string | undefined => {
  if (origins === undefined) return undefined;
  if (typeof origins !== "object" || origins === null || !("catalogue" in origins) || !("frames" in origins))
    return "`frames.origins` names both origins: `{ catalogue, frames }`";
  const catalogue = originOf(origins.catalogue);
  const frames = originOf(origins.frames);
  if (catalogue === undefined || frames === undefined)
    return "`frames.origins` are origins: a scheme, a host and a port (`https://frames.example.com`)";
  return catalogue === frames ? "`frames.origins` are two different origins" : undefined;
};

/**
 * Why `frames.paths` cannot be used, or none.
 *
 * @param paths - the paths, as the configuration gives them; none when it gives none.
 */
const pathsProblem = (paths: unknown): string | undefined => {
  if (paths === undefined) return undefined;
  const isPath = (path: unknown): boolean =>
    typeof path === "string" &&
    path.startsWith("/") &&
    path !== "/" &&
    !path.startsWith("/__") &&
    !path.startsWith("/@");
  return Array.isArray(paths) && paths.every(isPath)
    ? undefined
    : "`frames.paths` are paths of the server under the root (`/api/`), not Vite's or Forgebook's own (`/@…`, `/__…`)";
};

/**
 * Why a `frames` option cannot be used, or none.
 *
 * @param value - the option, as the configuration gives it.
 */
export const framesProblem = (value: unknown): string | undefined => {
  if (value === undefined || value === "same-origin") return undefined;
  if (typeof value !== "object" || value === null) return '`frames` is "same-origin" or `{ port, origins }`';
  return (
    portProblem("port" in value ? value.port : undefined) ??
    originsProblem("origins" in value ? value.origins : undefined) ??
    pathsProblem("paths" in value ? value.paths : undefined)
  );
};

/**
 * The `frames` option, resolved: the origins normalised as a browser writes them.
 *
 * @param option - the option, checked by `framesProblem`.
 */
export const resolvedFrames = (option: FramesOption | undefined): ResolvedFrames => {
  if (option === "same-origin") return { kind: "same-origin" };
  if (option === undefined) return ISOLATED_FRAMES;
  const catalogue = originOf(option.origins?.catalogue);
  const frames = originOf(option.origins?.frames);
  return {
    kind: "isolated",
    port: option.port,
    origins: catalogue === undefined || frames === undefined ? undefined : { catalogue, frames },
    paths: option.paths ?? []
  };
};

/**
 * Where a build's frames run: on the origins the configuration names, or on the catalogue's, the only host a build
 * can count on.
 *
 * @param frames - the resolved option.
 */
export const builtPlacement = (frames: ResolvedFrames): FramesPlacement =>
  frames.kind === "isolated" && frames.origins !== undefined
    ? { kind: "origins", ...frames.origins }
    : SAME_ORIGIN;

/**
 * Where the dev server's frames run, once both ports listen: on the origins the configuration names, or on the
 * catalogue's host at the frames' port.
 *
 * @param frames - the resolved option.
 * @param ports - the catalogue's port and the frames'.
 */
export const servedPlacement = (
  frames: ResolvedFrames,
  ports: { readonly catalogue: number; readonly frames: number }
): FramesPlacement => {
  if (frames.kind === "same-origin") return SAME_ORIGIN;
  return frames.origins === undefined ? { kind: "ports", ...ports } : { kind: "origins", ...frames.origins };
};

/**
 * The frames' origin for a catalogue reached at an address, for a line printed or an answer's link; none when they
 * share the catalogue's.
 *
 * @param placement - where the frames run.
 * @param catalogueUrl - the catalogue's address as it was reached (`http://localhost:5173/`); none when unknown.
 */
export const framesOriginOf = (
  placement: FramesPlacement,
  catalogueUrl: string | undefined
): string | undefined => {
  if (placement.kind === "same-origin" || catalogueUrl === undefined) return undefined;
  try {
    return pageOrigins(placement, new URL(catalogueUrl), "catalogue").frames;
  } catch {
    return undefined;
  }
};
