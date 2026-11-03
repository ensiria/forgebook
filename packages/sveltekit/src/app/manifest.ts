/**
 * `$app/manifest` in a catalogue (SvelteKit 3): the project's routes, from `src/routes`, and its static files, from
 * `static`. A catalogue builds no app, so nothing is immutable or prerendered.
 *
 * @module
 */
import { type AppRoute, appSettings } from "../appSettings.ts";

/** The app's built files: none, as a catalogue builds no app. */
export const immutable: readonly { readonly path: string }[] = [];

/** The project's static files. */
export const assets: readonly { readonly path: string }[] = appSettings().staticFiles.map((path) => ({
  path
}));

/** The prerendered pages: none. */
export const prerendered: readonly { readonly path: string }[] = [];

/** The project's routes, with whether each has a page and an endpoint. */
export const routes: readonly AppRoute[] = appSettings().routes;
