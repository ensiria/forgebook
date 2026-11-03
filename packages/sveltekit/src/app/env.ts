/**
 * `$app/env` (SvelteKit 3) and `$app/environment` (SvelteKit 2) in a catalogue: in the browser in a frame, on the
 * server in a generated server test, in development under `forgebook dev`, never building.
 *
 * @module
 */
import { appSettings } from "../appSettings.ts";

/** Whether the code runs in the browser: `false` in a generated server test. */
export const browser: boolean = !import.meta.env.SSR;

/** Whether the catalogue's dev server runs, as SvelteKit's dev server would. */
export const dev: boolean = import.meta.env.DEV;

/** Whether the app is being built or prerendered: a catalogue never runs it there. */
export const building = false;

/** The project's `version.name`. */
export const version: string = appSettings().version;
