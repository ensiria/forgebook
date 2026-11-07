/**
 * JSX in a project's `.js` files, compiled as Vite compiles it in `.jsx` ones, so a library that writes its components
 * and stories in JavaScript with JSX (as Storybook's webpack builder lets it) draws with no configuration.
 *
 * @remarks
 * Vite compiles JSX only in `.jsx` and `.tsx` files, and its `oxc` option takes one language for every file it
 * includes, so a configuration cannot add `.js` without breaking TypeScript. Forgebook's plugin compiles such a file
 * itself as it loads it, with the project's own JSX options (`oxc.jsx`: the runtime and the import
 * source, `jsxInject`), before Vite's plugins read it. Only the catalogue's own files that hold a closing tag (`</`
 * or `/>`) are compiled: every JSX element has one, and a plain `.js` file costs one search of its text. Its own: in
 * its folder and in its package, so an installed package, or another package of a workspace (whose built files keep
 * their own source maps), is never touched. A module asked for with a query that wants something else of the file
 * (`?raw`, `?url`, `?worker`) is left to Vite. JSX is a superset of what a `.js` module may hold, so a file the search
 * takes wrongly compiles to the same program. A
 * project that turns `oxc` off compiles its scripts its own way, and none is compiled here; neither is any for a
 * framework whose adapter does not ask for it (`compilesJsxInScripts`). Vite's dependency scan
 * reads `.js` files as JSX too (`prebundled.ts`).
 *
 * @module
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { type ResolvedConfig, type Rollup, transformWithOxc } from "vite";

import type { FrameworkAdapter } from "./adapter.ts";
import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** A script whose extension says nothing about JSX, as a browser loads it. */
const PLAIN_SCRIPT = /\.m?js$/;

/** A file of an installed package. */
const INSTALLED = /[\\/]node_modules[\\/]/;

/** What every JSX element holds: a closing tag, or the end of one that closes itself. */
const TAG_END = /<\/|\/>/;

/** A `.js` file compiled: its JavaScript and the source map back to its JSX. */
export type CompiledScript = {
  /** The JavaScript. */
  readonly code: string;
  /** Its source map, back to the file's own text. */
  readonly map: Rollup.SourceMapInput;
};

/** Vite's options of its JSX and TypeScript compiler, when the project leaves it on. */
type OxcOptions = Exclude<ResolvedConfig["oxc"], false>;

/** The queries that still ask for the module itself: Vite's version stamp, its edit stamp, an import's mark. */
const MODULE_QUERIES = new Set(["v", "t", "import"]);

/**
 * The folder of the package a file belongs to: the nearest folder with a `package.json`; none outside any.
 *
 * @param file - the file, absolute in Vite's form.
 */
export type PackageOf = (file: string) => string | undefined;

/** Finds a file's package on disk, each folder looked at once. */
export const packageFinder = (): PackageOf => {
  const known = new Map<string, string | undefined>();
  const packageOf = (folder: string): string | undefined => {
    if (known.has(folder)) return known.get(folder);
    const parent = VITE_PATHS.dirname(folder);
    let found: string | undefined;
    if (existsSync(`${folder}/package.json`)) found = folder;
    // the system's root has no parent
    else if (parent !== folder) found = packageOf(parent);
    known.set(folder, found);
    return found;
  };
  return (file: string): string | undefined => packageOf(VITE_PATHS.dirname(file));
};

/**
 * The file of one of the catalogue's own `.js` files asked for as a module, from its id; none for any other id: an
 * installed package's, another package's, one outside the catalogue's folder, a virtual module's, or one whose query
 * asks for something else than the module (`?raw`).
 *
 * @param id - the module's id, with any query Vite gave it.
 * @param root - the catalogue's folder, in Vite's form.
 * @param packageOf - finds a file's package.
 * @param paths - the path functions, the running system's by default.
 */
export const ownScriptOf = (
  id: string,
  root: string,
  packageOf: PackageOf,
  paths: Pick<VitePaths, "normalize"> = VITE_PATHS
): string | undefined => {
  if (id.startsWith("\0")) return undefined;
  const [path = id, query = ""] = id.split("?");
  if ([...new URLSearchParams(query).keys()].some((key) => !MODULE_QUERIES.has(key))) return undefined;
  const file = paths.normalize(path);
  if (!PLAIN_SCRIPT.test(file) || INSTALLED.test(file) || !file.startsWith(`${root}/`)) return undefined;
  return packageOf(file) === packageOf(`${root}/package.json`) ? file : undefined;
};

/**
 * Whether a file's text may hold JSX: it has a closing tag.
 *
 * @param code - the text.
 */
export const mayHoldJsx = (code: string): boolean => TAG_END.test(code);

/**
 * The compiler's options for a `.js` file read as JSX: the project's own, without what only chooses Vite's files, and
 * without React's Fast Refresh, which Vite's own plugin adds to the compiled module as it does to any `.js` file the
 * project's refresh options include. Added here too, every component would be registered twice.
 *
 * @param oxc - the project's resolved `oxc` options.
 */
const jsxOptions = (oxc: OxcOptions): Parameters<typeof transformWithOxc>[2] => {
  const { include, exclude, jsxInject, jsxRefreshInclude, jsxRefreshExclude, ...rest } = oxc;
  const jsx = typeof rest.jsx === "object" ? { ...rest.jsx, refresh: false } : rest.jsx;
  return { ...rest, ...(jsx === undefined ? {} : { jsx }), lang: "jsx", sourcemap: true };
};

/**
 * Compiles a `.js` file's JSX, with the code the project's `jsxInject` puts first (a classic runtime's `React` import),
 * as Vite does for its `.jsx` files; leaves a file with no closing tag, and any file of a project that turns `oxc` off,
 * to Vite.
 *
 * @param config - Vite's resolved configuration, for the project's JSX options.
 * @param code - the file's text.
 * @param file - the file, absolute.
 * @returns the compiled module, or none when it is not compiled.
 */
export const jsxInScript = async (
  config: ResolvedConfig,
  code: string,
  file: string
): Promise<CompiledScript | null> => {
  if (config.oxc === false || !mayHoldJsx(code)) return null;
  const result = await transformWithOxc(code, file, jsxOptions(config.oxc), undefined, config);
  const inject = config.oxc.jsxInject;
  // on the compiled code's first line, so the source map's lines stay where they were
  return { code: inject === undefined ? result.code : `${inject};${result.code}`, map: result.map ?? null };
};

/** The plugin's hooks for JSX in the project's `.js` files. */
export type JsxInScripts = {
  /** Keeps Vite's resolved configuration, for the project's JSX options and folder. */
  readonly remember: (config: ResolvedConfig) => void;
  /**
   * Loads one of the catalogue's own `.js` files that holds JSX, compiled; none for any other module, and for all
   * before `remember`, which Vite then loads itself.
   */
  readonly load: (id: string) => Promise<CompiledScript | null>;
};

/**
 * The plugin's hooks for JSX in the project's `.js` files.
 *
 * @remarks
 * The file is compiled as it is loaded, not in a `transform` hook, so the plugin's other transforms (a story file's
 * hot code, `hotSnippets.ts`) read JavaScript and stay the plugin's one `transform`.
 *
 * @param frameworkOf - the catalogue's framework, whose adapter asks for it (`compilesJsxInScripts`); read on each module
 * since the catalogue's configuration is read once Vite starts.
 */
export const jsxInScripts = (
  frameworkOf: () => Pick<FrameworkAdapter, "compilesJsxInScripts"> | undefined
): JsxInScripts => {
  let viteConfig: ResolvedConfig | undefined;
  const packageOf = packageFinder();
  return {
    remember: (config: ResolvedConfig): void => {
      viteConfig = config;
    },
    load: async (id: string): Promise<CompiledScript | null> => {
      if (viteConfig === undefined || viteConfig.oxc === false) return null;
      if (frameworkOf()?.compilesJsxInScripts !== true) return null;
      const file = ownScriptOf(id, VITE_PATHS.normalize(viteConfig.root), packageOf);
      if (file === undefined) return null;
      // a file that cannot be read is Vite's to report
      const code = await readFile(file, "utf8").catch(() => undefined);
      return code === undefined ? null : jsxInScript(viteConfig, code, file);
    }
  };
};
