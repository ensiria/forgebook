/**
 * `$app/paths` in a catalogue: the project's base path and assets' path, and the paths SvelteKit writes from them, for
 * SvelteKit 2 (`base`, `assets`, `resolveRoute`) and 3 (`asset`, `resolve`, `match`).
 *
 * @module
 */
import { appSettings, pageRouteIds } from "../appSettings.ts";
import { PAGE_ORIGIN, routePath } from "../kitParameters.ts";
import { filledRoute, isRouteId, matchRoute, type RouteMatch, type RouteParams } from "../routeIds.ts";

/** What SvelteKit puts before every path of the app (`paths.base`); empty by default. */
export const base: string = appSettings().base;

/** Where the static files are served from (`paths.assets`), or the base path. */
export const assets: string = appSettings().assets === "" ? appSettings().base : appSettings().assets;

/**
 * A path with one leading slash, as a base path is joined to it.
 *
 * @param path - a path, with or without its leading slash (SvelteKit 3 writes none).
 */
const rooted = (path: string): string => (path.startsWith("/") ? path : `/${path}`);

/**
 * The address of a static file.
 *
 * @param file - the file, from the `static` folder (`favicon.png`).
 */
export const asset = (file: string): string => `${assets}${rooted(file)}`;

/**
 * A route id or a path written as the app's path: a route's params filled in, the base path before it.
 *
 * @param target - a route id (`/blog/[slug]`) or a path, with a search or a hash.
 * @param params - the route's params.
 */
export const resolve = (target: string, params: RouteParams = {}): string => {
  const end = target.search(/[?#]/);
  const path = end === -1 ? target : target.slice(0, end);
  const rest = end === -1 ? "" : target.slice(end);
  const filled = isRouteId(path) ? filledRoute(path, params) : rooted(path);
  return `${base}${filled}${rest}`;
};

/**
 * A route id written as the app's path (SvelteKit 2).
 *
 * @param id - the route id.
 * @param params - its params.
 */
export const resolveRoute = (id: string, params: RouteParams = {}): string => resolve(id, params);

/**
 * The project's route an address matches, with its params.
 *
 * @param url - the address, or a path.
 * @returns the route, or `null` when none matches.
 */
export const match = async (url: URL | string): Promise<RouteMatch | null> => {
  await Promise.resolve();
  const address = new URL(url, PAGE_ORIGIN);
  return matchRoute(pageRouteIds(), routePath(address.pathname, base)) ?? null;
};
