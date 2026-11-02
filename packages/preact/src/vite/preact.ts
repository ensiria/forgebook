/**
 * Forgebook's adapter for Preact, for the Vite plugin: `forgebookPlugin({ framework: preact() })`.
 *
 * @module
 */
import { dirname, extname, join } from "node:path";

import { FORGEBOOK_FILES, type FrameworkAdapter, filesUnder } from "forgebook/vite/adapter";
import type { Plugin, PluginOption, UserConfig } from "vite";

/** This package's own files: its renderer is Preact, but no component of a library to refresh. */
const OWN_FILES: RegExp = filesUnder(join(dirname(import.meta.dirname), ".."));

/** The files Preact's refresh leaves alone: the core's (its shell is React) and this package's. */
const NOT_REFRESHED: readonly RegExp[] = [FORGEBOOK_FILES, OWN_FILES];

/**
 * Refresh's own runtime, which the frame imports, named through this package: a project resolves only what it installs
 * itself, and a package Vite cannot pre-bundle before the first page is found while the page loads, which reloads it.
 */
const REFRESH_RUNTIME: Readonly<Record<string, string>> = {
  "@prefresh/core": "@forgebook/preact > @prefresh/vite > @prefresh/core",
  "@prefresh/utils": "@forgebook/preact > @prefresh/vite > @prefresh/utils"
};

/** A Vite configuration's Oxc options, as far as this plugin reads them. */
type OxcOptions = Exclude<NonNullable<UserConfig["oxc"]>, false>;

/**
 * Leaves each file's JSX to its own `tsconfig.json`, keeping Preact's refresh, and names refresh's runtime where the
 * project can pre-bundle it.
 *
 * @remarks
 * `@prefresh/vite` sets one JSX runtime for every file (`preact`), which would turn the shell's React into Preact's
 * when the core is linked as sources. Without the runtime set, Vite reads each file's `jsxImportSource` from its own
 * `tsconfig.json`, as a Preact project writes it, and the shell keeps React's; Fast Refresh's markers are written for
 * every file but the core's and this package's.
 *
 * @returns the plugin, after Prefresh's.
 */
const jsxPerFile = (): Plugin => ({
  name: "forgebook:preact-jsx",
  enforce: "post",
  config: (config: UserConfig): void => {
    const oxc: OxcOptions = typeof config.oxc === "object" ? config.oxc : {};
    const jsx = typeof oxc.jsx === "object" ? oxc.jsx : {};
    const { importSource: _importSource, pragma: _pragma, pragmaFrag: _pragmaFrag, ...rest } = jsx;
    config.oxc = { ...oxc, jsx: { ...rest, runtime: "automatic" }, jsxRefreshExclude: NOT_REFRESHED };
    const include = config.optimizeDeps?.include;
    if (include !== undefined)
      config.optimizeDeps = {
        ...config.optimizeDeps,
        include: include.map((name) => REFRESH_RUNTIME[name] ?? name)
      };
  }
});

/**
 * Preact, as the plugin reads its components: the docs module the docs' worker loads is this package's `extractDocs.ts`
 * (the props from the first parameter's type, events as `on*` props); the generated pages draw with its renderer, on
 * Preact itself, and write code with the JSX writer; Vite gets Preact's refresh, so an edited component updates in its
 * frame and the story keeps its state.
 *
 * @returns the adapter.
 */
export const preact = (): FrameworkAdapter => ({
  name: "preact",
  // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
  docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
  pages: { frame: "@forgebook/preact/frame", code: "@forgebook/preact/code" },
  // the server render is named too: the page never runs it, but Vite meets its import in the renderer and would reload
  browserDependencies: [
    "preact",
    "preact/hooks",
    "preact/jsx-runtime",
    "preact/jsx-dev-runtime",
    "preact-render-to-string"
  ],
  vitePlugins: async (): Promise<readonly PluginOption[]> => {
    const { default: prefresh } = await import("@prefresh/vite");
    return [await prefresh({ exclude: NOT_REFRESHED }), jsxPerFile()];
  }
});
