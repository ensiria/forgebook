/**
 * JSX in a project's `.js` files, compiled as Vite compiles it in `.jsx` ones, so a library that writes its components
 * and stories in JavaScript with JSX (as Storybook's webpack builder lets it) draws with no configuration.
 *
 * @remarks
 * Vite compiles JSX only in `.jsx` and `.tsx` files, and its `oxc` option takes one language for every file it
 * includes, so a configuration cannot add `.js` without breaking TypeScript. Forgebook's plugin compiles such a file
 * itself as it loads it, with the project's own JSX options (`oxc.jsx`: the runtime and the import
 * source), before Vite's plugins read it. Only the project's files that hold a closing tag (`</` or `/>`) are compiled: every JSX
 * element has one, an installed package is never touched, and a plain `.js` file costs one search of its text. JSX
 * is a superset of what a `.js` module may hold, so a file the search takes wrongly compiles to the same program. A
 * project that turns `oxc` off compiles its scripts its own way, and none is compiled here; neither is any for a
 * framework whose adapter does not ask for it (`compilesJsxInScripts`). Vite's dependency scan
 * reads `.js` files as JSX too (`prebundled.ts`).
 *
 * @module
 */
import { readFile } from "node:fs/promises";

import { type ResolvedConfig, type Rollup, transformWithOxc } from "vite";

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

/**
 * Whether a module is one of the project's `.js` files that may hold JSX.
 *
 * @param id - the module's id, with any query Vite gave it.
 * @param code - its text.
 */
export const mayHoldJsx = (id: string, code: string): boolean => isProjectScript(id) && TAG_END.test(code);

/**
 * Whether a module is one of the project's `.js` files, by its id alone.
 *
 * @param id - the module's id, with any query Vite gave it.
 */
const isProjectScript = (id: string): boolean => {
  const [file = id] = id.split("?");
  return !id.startsWith("\0") && PLAIN_SCRIPT.test(file) && !INSTALLED.test(file);
};

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
 * Compiles one of the project's `.js` files that holds JSX; leaves any other module to Vite.
 *
 * @param config - Vite's resolved configuration, for the project's JSX options.
 * @param code - the module's text.
 * @param id - its id.
 * @returns the compiled module, or none when it is not such a file.
 */
export const jsxInScript = async (
  config: ResolvedConfig,
  code: string,
  id: string
): Promise<CompiledScript | null> => {
  if (config.oxc === false || !mayHoldJsx(id, code)) return null;
  const [file = id] = id.split("?");
  const result = await transformWithOxc(code, file, jsxOptions(config.oxc), undefined, config);
  return { code: result.code, map: result.map ?? null };
};

/** The plugin's hooks for JSX in the project's `.js` files. */
export type JsxInScripts = {
  /** Keeps Vite's resolved configuration, for the project's JSX options. */
  readonly remember: (config: ResolvedConfig) => void;
  /**
   * Loads one of the project's `.js` files that holds JSX, compiled; none for any other module, and for all before
   * `remember`, which Vite then loads itself.
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
 * @param isAsked - whether the catalogue's framework asks for it (`compilesJsxInScripts`), read on each module since the
 * catalogue's configuration is read once Vite starts.
 */
export const jsxInScripts = (isAsked: () => boolean): JsxInScripts => {
  let viteConfig: ResolvedConfig | undefined;
  return {
    remember: (config: ResolvedConfig): void => {
      viteConfig = config;
    },
    load: async (id: string): Promise<CompiledScript | null> => {
      if (viteConfig === undefined || !isAsked() || !isProjectScript(id)) return null;
      const [file = id] = id.split("?");
      // a file that cannot be read is Vite's to report
      const code = await readFile(file, "utf8").catch(() => undefined);
      return code === undefined ? null : jsxInScript(viteConfig, code, id);
    }
  };
};
