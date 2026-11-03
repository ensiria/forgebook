/**
 * What the Next.js project's configuration gives the page: the base path and the public runtime configuration, read
 * from `next.config` by the Vite plugin and written in the frame's page before any module runs.
 *
 * @remarks
 * Written in the page, not compiled into a module, so a dependency pre-bundled by Vite reads the same values as the
 * project's own code. Only what Next.js itself sends to the browser is there.
 *
 * @module
 */

/** The key the frame's page writes the settings under, on `globalThis`. */
export const APP_SETTINGS_KEY = "forgebook.nextjs.app";

/** What the project's `next.config` gives the page. */
export type NextAppSettings = {
  /** `basePath`: what Next.js puts before every path of the app; empty by default. */
  readonly basePath: string;
  /** `publicRuntimeConfig`, as `next/config` returns it. */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
};

/** The settings of a page the plugin did not write (a test's). */
const NO_SETTINGS: NextAppSettings = { basePath: "", publicRuntimeConfig: {} };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The settings the frame's page holds. */
export const appSettings = (): NextAppSettings => {
  const settings: unknown = Reflect.get(globalThis, Symbol.for(APP_SETTINGS_KEY));
  if (!isRecord(settings)) return NO_SETTINGS;
  const { basePath, publicRuntimeConfig } = settings;
  return {
    basePath: typeof basePath === "string" ? basePath : "",
    publicRuntimeConfig: isRecord(publicRuntimeConfig) ? publicRuntimeConfig : {}
  };
};
