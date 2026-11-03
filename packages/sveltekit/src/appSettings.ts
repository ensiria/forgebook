/**
 * What the SvelteKit project gives the page: its base path, its assets' path, its version and its routes, read by the
 * Vite plugin and written in the frame's page before any module runs.
 *
 * @remarks
 * Written in the page, not compiled into a module, so a stand-in pre-bundled by Vite reads the same values as the
 * project's own code. A server render has no page: there the plugin writes the same settings into the code it
 * compiles (`SETTINGS_CONSTANT`). Only what SvelteKit itself sends to the browser is there: no environment variable
 * (the public ones are modules of their own, `$env/static/public` and `$app/env/public`).
 *
 * @module
 */

/** The key the frame's page writes the settings under, on `globalThis`. */
export const APP_SETTINGS_KEY = "forgebook.sveltekit.app";

/** The name the plugin replaces with the settings in the code it compiles (Vite's `define`), for a server render. */
export const SETTINGS_CONSTANT = "__FORGEBOOK_SVELTEKIT_SETTINGS__";

/** The settings the plugin compiled in; a `typeof` of it is safe where the plugin did not compile the code. */
declare const __FORGEBOOK_SVELTEKIT_SETTINGS__: unknown;

/** A route of the project, as `$app/manifest` lists it. */
export type AppRoute = {
  /** The route's id (`/blog/[slug]`). */
  readonly id: string;
  /** Whether it has a page (`+page.svelte`). */
  readonly page: boolean;
  /** Whether it has an endpoint (`+server.ts`). */
  readonly endpoint: boolean;
};

/** What the project's configuration and folders give the page. */
export type KitAppSettings = {
  /** `paths.base`: what SvelteKit puts before every path of the app (`/docs`); empty by default. */
  readonly base: string;
  /** `paths.assets`: where the static files are served from, an absolute URL; empty for the base path. */
  readonly assets: string;
  /** `version.name`, as `$app/env` gives it. */
  readonly version: string;
  /** The project's routes, from `src/routes`. */
  readonly routes: readonly AppRoute[];
  /** The project's static files, from `static`, as paths without their leading slash. */
  readonly staticFiles: readonly string[];
};

/** The settings of a page the plugin did not write (a test's): no base path, no routes. */
export const NO_SETTINGS: KitAppSettings = { base: "", assets: "", version: "", routes: [], staticFiles: [] };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A text read from the settings, or empty.
 *
 * @param value - the value.
 */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * A route read from the settings, or none.
 *
 * @param value - the value.
 */
const routeOf = (value: unknown): AppRoute[] =>
  isRecord(value) && typeof value["id"] === "string"
    ? [{ id: value["id"], page: value["page"] === true, endpoint: value["endpoint"] === true }]
    : [];

/** The settings the frame's page holds, or those the plugin compiled in. */
export const appSettings = (): KitAppSettings => {
  const inPage: unknown = Reflect.get(globalThis, Symbol.for(APP_SETTINGS_KEY));
  const settings: unknown =
    inPage === undefined && typeof __FORGEBOOK_SVELTEKIT_SETTINGS__ !== "undefined"
      ? __FORGEBOOK_SVELTEKIT_SETTINGS__
      : inPage;
  if (!isRecord(settings)) return NO_SETTINGS;
  const { routes, staticFiles } = settings;
  return {
    base: textOf(settings["base"]),
    assets: textOf(settings["assets"]),
    version: textOf(settings["version"]),
    routes: Array.isArray(routes) ? routes.flatMap(routeOf) : [],
    staticFiles: Array.isArray(staticFiles) ? staticFiles.filter((file) => typeof file === "string") : []
  };
};

/** The ids of the project's routes that have a page: where a link or `goto` can land. */
export const pageRouteIds = (): string[] =>
  appSettings()
    .routes.filter((route) => route.page)
    .map((route) => route.id);
