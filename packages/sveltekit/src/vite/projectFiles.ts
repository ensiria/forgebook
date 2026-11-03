/**
 * The routes and static files of a SvelteKit project, read from its folders: what `$app/state` matches a story's
 * address against, and what `$app/manifest` lists.
 *
 * @module
 */
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { AppRoute } from "../appSettings.ts";

/** A route's page: `+page.svelte`, or another extension the project compiles as Svelte. */
const PAGE_FILE = /^\+page(@[^.]*)?\.[^.]+$/;

/** A route's endpoint: `+server.js` or `+server.ts`. */
const SERVER_FILE = /^\+server\.[cm]?[jt]s$/;

/** The most static files listed: a folder of thousands of images is listed no further. */
const MOST_STATIC_FILES = 5000;

/**
 * A folder's path from another, written with `/`.
 *
 * @param from - the folder it is relative to.
 * @param path - the path.
 */
const slashed = (from: string, path: string): string => relative(from, path).split(sep).join("/");

/**
 * The routes of a project's routes folder: every folder with a page or an endpoint.
 *
 * @param routesDir - the routes folder (`src/routes`).
 * @param extensions - the extensions of the project's Svelte components (`.svelte`).
 */
export const projectRoutes = (routesDir: string, extensions: readonly string[]): AppRoute[] => {
  if (!existsSync(routesDir)) return [];
  const routes: AppRoute[] = [];
  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const page = files.some(
      (file) => PAGE_FILE.test(file) && extensions.some((extension) => file.endsWith(extension))
    );
    const endpoint = files.some((file) => SERVER_FILE.test(file));
    if (page || endpoint) {
      const path = slashed(routesDir, dir);
      routes.push({ id: path === "" ? "/" : `/${path}`, page, endpoint });
    }
    for (const entry of entries) if (entry.isDirectory()) visit(join(dir, entry.name));
  };
  visit(routesDir);
  return routes.sort((first, second) => first.id.localeCompare(second.id));
};

/**
 * The files of a project's static folder, as paths from it.
 *
 * @param staticDir - the folder (`static`).
 */
export const projectStaticFiles = (staticDir: string): string[] => {
  if (!existsSync(staticDir)) return [];
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= MOST_STATIC_FILES) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(slashed(staticDir, path));
    }
  };
  visit(staticDir);
  return files.sort();
};
