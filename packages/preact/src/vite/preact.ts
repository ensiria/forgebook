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

/** How a configuration names its JSX runtime: what Prefresh fills in for every file when the user did not. */
type JsxNaming = Partial<Record<"importSource" | "pragma" | "pragmaFrag", string>>;

/**
 * The naming a JSX setting holds.
 *
 * @param jsx - Oxc's `jsx` setting, or Rolldown's.
 */
const namingOf = (jsx: unknown): JsxNaming => {
  if (typeof jsx !== "object" || jsx === null) return {};
  const naming: JsxNaming = {};
  for (const key of ["importSource", "pragma", "pragmaFrag"] as const) {
    const value: unknown = Reflect.get(jsx, key);
    if (typeof value === "string") naming[key] = value;
  }
  return naming;
};

/**
 * A JSX setting with the user's own naming in place of Prefresh's.
 *
 * @param jsx - the setting Prefresh left.
 * @param naming - the user's naming; none leaves each file's to its `tsconfig.json`.
 */
const withNaming = <TJsx extends object>(jsx: TJsx, naming: JsxNaming): TJsx => {
  const kept = { ...jsx };
  for (const key of ["importSource", "pragma", "pragmaFrag"] as const) Reflect.deleteProperty(kept, key);
  return { ...kept, ...naming };
};

/**
 * Leaves each file's JSX to its own `tsconfig.json`, keeping Preact's refresh, and names refresh's runtime where the
 * project can pre-bundle it.
 *
 * @remarks
 * `@prefresh/vite` sets one JSX runtime for every file (`preact`), which would turn the shell's React into Preact's
 * when the core is linked as sources. Without the runtime set, Vite reads each file's `jsxImportSource` from its own
 * `tsconfig.json`, as a Preact project writes it, and the shell keeps React's. A runtime the user names in the Vite
 * configuration itself is kept, for the pages and the pre-bundled dependencies alike. Fast Refresh's markers are
 * written for every file but the core's and this package's, and the files the user leaves out stay out.
 *
 * @returns the plugins: one that notes the user's naming before Prefresh, one that restores it after.
 */
const jsxPerFile = (): readonly Plugin[] => {
  let pages: JsxNaming = {};
  let dependencies: JsxNaming = {};
  return [
    {
      name: "forgebook:preact-jsx-naming",
      enforce: "pre",
      config: (config: UserConfig): void => {
        pages = namingOf(typeof config.oxc === "object" ? config.oxc.jsx : undefined);
        dependencies = namingOf(config.optimizeDeps?.rolldownOptions?.transform?.jsx);
      }
    },
    {
      name: "forgebook:preact-jsx",
      enforce: "post",
      config: (config: UserConfig): void => {
        if (config.oxc === false) return;
        const oxc: OxcOptions = config.oxc ?? {};
        const jsx = typeof oxc.jsx === "object" ? oxc.jsx : {};
        const userExcluded = oxc.jsxRefreshExclude;
        const excluded = [...NOT_REFRESHED, ...(userExcluded === undefined ? [] : [userExcluded].flat())];
        config.oxc = {
          ...oxc,
          jsx: withNaming({ ...jsx, runtime: "automatic" as const }, pages),
          jsxRefreshExclude: excluded
        };
        const optimizeDeps = config.optimizeDeps ?? {};
        const transform = optimizeDeps.rolldownOptions?.transform;
        const dependenciesJsx = transform?.jsx;
        config.optimizeDeps = {
          ...optimizeDeps,
          ...(optimizeDeps.include === undefined
            ? {}
            : { include: optimizeDeps.include.map((name) => REFRESH_RUNTIME[name] ?? name) }),
          ...(typeof dependenciesJsx === "object"
            ? {
                rolldownOptions: {
                  ...optimizeDeps.rolldownOptions,
                  transform: { ...transform, jsx: withNaming(dependenciesJsx, dependencies) }
                }
              }
            : {})
        };
      }
    }
  ];
};

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
    return [await prefresh({ exclude: NOT_REFRESHED }), ...jsxPerFile()];
  }
});
