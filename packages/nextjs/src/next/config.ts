/**
 * `next/config` in a catalogue: `getConfig()` returns the project's `publicRuntimeConfig`, as Next.js returns it in the
 * browser, and an empty `serverRuntimeConfig`, which never reaches the browser.
 *
 * @remarks
 * Next.js 16 removed runtime configuration; a project on Next.js 15 may still read it.
 *
 * @module
 */
import { appSettings } from "../appSettings.ts";

/** What `getConfig()` returns. */
export type NextRuntimeConfig = {
  /** The project's `publicRuntimeConfig`. */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
  /** Empty: the server's configuration never reaches the browser. */
  readonly serverRuntimeConfig: Readonly<Record<string, unknown>>;
};

/** The runtime configuration, as the browser sees it. */
const getConfig = (): NextRuntimeConfig => ({
  publicRuntimeConfig: appSettings().publicRuntimeConfig,
  serverRuntimeConfig: {}
});

export default getConfig;

/** Sets the runtime configuration: Next.js's app does, a story does not need to. */
export const setConfig = (): void => undefined;
