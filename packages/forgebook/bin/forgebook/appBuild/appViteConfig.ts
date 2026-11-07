/**
 * The app's Vite configuration, as a catalogue reads it: loaded as `vite dev` loads it, then what is about how modules
 * and style sheets resolve and compile is kept, and what is about the app's page, server and output is not.
 *
 * @remarks
 * Loading it runs the project's code, and later its plugins' hooks. That is on purpose: every command that starts a
 * catalogue already runs the project's `forgebook.config.ts` and its components, and this is the file the person runs
 * with `vite dev` every day. `forgebook init` never loads it; `appBuild: false` turns it off.
 *
 * A plugin stays unless it is on one of two lists. The framework's own plugin is the adapter's to give, and two of them
 * compile each file twice. The others build or serve an app, not components: a route table, a service worker, a
 * source-map upload, a certificate, a type checker. A person who needs one back names it in `appBuild.keepPlugins`.
 *
 * The lists go by name in this package rather than through the adapters, so a project whose adapter is a version older
 * than this core still never runs its framework's plugin twice.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, join, resolve } from "node:path";

import type {
  ConfigEnv,
  IndexHtmlTransformContext,
  IndexHtmlTransformResult,
  Plugin,
  UserConfig
} from "vite";

import type { ResolvedAppBuild } from "../../../src/vite/appBuildOption.ts";

/** The names a Vite configuration may have, in the order Vite looks for them. */
const VITE_CONFIG_FILES = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
  "vite.config.mts",
  "vite.config.cts"
];

/** The plugins each framework's adapter gives itself, by the adapter's name. */
const FRAMEWORK_PLUGINS: Readonly<Record<string, RegExp>> = {
  react: /^(?:vite:react|@vitejs\/plugin-react|@rolldown\/plugin-babel$)/,
  "react-native-web": /^(?:vite:react|@vitejs\/plugin-react)/,
  preact: /^(?:preact:|vite:preact|prefresh)/,
  vue: /^vite:vue$/,
  svelte: /^vite-plugin-svelte(?:[-:]|$)/,
  solid: /^solid$/
};

/** What builds or serves an app and has no part in drawing a component, by its plugin's name. */
const APP_ONLY_PLUGINS =
  /^(?:react-router|remix|tanstack|@tanstack|vinext|vike|vite-plugin-ssr|vite-plugin-pwa|vite:legacy|vite-plugin-checker|vite-plugin-inspect|vite-plugin-vue-devtools|vite-plugin-vue-inspector|visualizer|rollup-plugin-visualizer|sentry|@sentry|codecov|vite-plugin-compression|vite-plugin-dts|dts$|unplugin-dts|vite-plugin-electron|electron|laravel|vite-plugin-ruby|@cloudflare|cloudflare|vercel|netlify|nitro|vite-plugin-node|vite:basic-ssl|vite-plugin-mkcert|vite-plugin-eslint|vite-plugin-stylelint|vite-plugin-static-copy|vite-plugin-html|vite-plugin-mock-dev-server|forgebook)/;

/** What reads a project's `paths` a second way: Vite's own reading takes its place. */
const TSCONFIG_PATHS_PLUGIN = /^vite-tsconfig-paths$|^vite:tsconfig-paths$/;

/** What a `vite.config` can import and still give a catalogue nothing: Vite's, and the framework's own plugin. */
const FRAMEWORK_IMPORTS = new Set([
  "vite",
  "vitest/config",
  "@vitejs/plugin-react",
  "@vitejs/plugin-react-swc",
  "@vitejs/plugin-vue",
  "@sveltejs/vite-plugin-svelte",
  "vite-plugin-solid",
  "@preact/preset-vite"
]);

/** A module a script loads, by `from`, a bare `import`, `import()` or `require()`. */
const LOADED_MODULE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`]([^"'`\n]+)["'`]/g;

/** A word naming one of the settings a catalogue takes. */
const TAKEN_SETTING =
  /\b(?:resolve|alias|css|define|esbuild|oxc|optimizeDeps|envPrefix|envDir|publicDir|assetsInclude|json|dedupe|conditions|mainFields|extensions|tsconfigPaths|name|transform|load|resolveId|configureServer|enforce|jsxImportSource|babel)\b/;

/**
 * Whether a `vite.config` can hold nothing for a catalogue, as its text shows: it loads only Vite and the framework's
 * plugin, and names none of the settings taken nor anything a plugin written in the file would hold.
 *
 * @remarks
 * The usual configuration of a new project is exactly this, and loading it means bundling it and starting the module
 * graph it imports, which a project with nothing to read must not pay. The check only ever errs towards loading: a word
 * in a comment loads a file that gives nothing.
 *
 * @param text - the file's text.
 */
export const holdsNothingForCatalogue = (text: string): boolean =>
  !TAKEN_SETTING.test(text) &&
  [...text.matchAll(LOADED_MODULE)].every((match) => {
    const name = match[1] ?? "";
    return FRAMEWORK_IMPORTS.has(name) || isBuiltin(name);
  });

/** The app's Vite configuration, as a catalogue takes it. */
export type AppViteConfig = {
  /** The file, from the catalogue's folder. */
  readonly file: string;
  /** What is about how its modules and style sheets resolve and compile. */
  readonly fields: UserConfig;
  /** The plugins kept. */
  readonly plugins: readonly Plugin[];
  /** The names of the plugins left out, each once. */
  readonly leftOut: readonly string[];
  /** The PostCSS plugins its `css.postcss` makes; none when it makes none. */
  readonly postcssPlugins: readonly unknown[] | undefined;
  /** What it sets that a catalogue cannot do, each said. */
  readonly notes: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is one of Vite's plugins. */
const isPlugin = (value: unknown): value is Plugin => isRecord(value) && typeof value["name"] === "string";

/**
 * A configuration's plugins as one list: Vite takes nested lists and promises of plugins.
 *
 * @param plugins - the plugins, as the configuration writes them.
 */
const flatPlugins = async (plugins: unknown): Promise<Plugin[]> => {
  const value: unknown = await plugins;
  if (Array.isArray(value)) return (await Promise.all(value.map(flatPlugins))).flat();
  return isPlugin(value) ? [value] : [];
};

/**
 * The app's Vite configuration file, from the catalogue's folder, or none.
 *
 * @param dir - the catalogue's folder.
 * @param asked - `appBuild.viteConfig`.
 */
export const viteConfigFile = (dir: string, asked: string | false | undefined): string | undefined => {
  if (asked === false) return undefined;
  if (asked !== undefined) return asked;
  return VITE_CONFIG_FILES.find((name) => existsSync(join(dir, name)));
};

/**
 * Whether the app's Vite configuration is worth loading.
 *
 * @param dir - the catalogue's folder.
 * @param file - the file, from there.
 */
export const isWorthLoading = (dir: string, file: string): boolean => {
  try {
    return !holdsNothingForCatalogue(readFileSync(resolve(dir, file), "utf8"));
  } catch {
    // loading it says why it cannot be read, in the words the person is told
    return true;
  }
};

/**
 * Whether one of the app's plugins goes into the catalogue.
 *
 * @param name - the plugin's name.
 * @param framework - the adapter's name.
 * @param options - what the catalogue's configuration asks.
 * @param isReadingPaths - whether Vite reads `tsconfig` paths here, which a plugin that does the same is then not needed for.
 */
export const keepsAppPlugin = (
  name: string,
  framework: string,
  options: ResolvedAppBuild,
  isReadingPaths = true
): boolean => {
  if (options.skipPlugins.includes(name)) return false;
  if (options.keepPlugins.includes(name)) return true;
  if (FRAMEWORK_PLUGINS[framework]?.test(name) === true) return false;
  return !APP_ONLY_PLUGINS.test(name) && !(isReadingPaths && TSCONFIG_PATHS_PLUGIN.test(name));
};

/** What is taken of `resolve`. */
const resolveFields = (given: NonNullable<UserConfig["resolve"]>): NonNullable<UserConfig["resolve"]> => ({
  ...(given.alias === undefined ? {} : { alias: given.alias }),
  ...(given.dedupe === undefined ? {} : { dedupe: given.dedupe }),
  ...(given.conditions === undefined ? {} : { conditions: given.conditions }),
  ...(given.mainFields === undefined ? {} : { mainFields: given.mainFields }),
  ...(given.extensions === undefined ? {} : { extensions: given.extensions }),
  ...(given.tsconfigPaths === undefined ? {} : { tsconfigPaths: given.tsconfigPaths })
});

/** Lightning CSS's options but its visitor. */
const withoutVisitor = ({
  visitor: _visitor,
  ...rest
}: NonNullable<NonNullable<UserConfig["css"]>["lightningcss"]>): NonNullable<
  NonNullable<UserConfig["css"]>["lightningcss"]
> => rest;

/** What is taken of `css`: its visitor stays Forgebook's, since the forced states are a rewrite of the style sheets. */
const cssFields = (given: NonNullable<UserConfig["css"]>): NonNullable<UserConfig["css"]> => ({
  ...(given.preprocessorOptions === undefined ? {} : { preprocessorOptions: given.preprocessorOptions }),
  ...(given.preprocessorMaxWorkers === undefined
    ? {}
    : { preprocessorMaxWorkers: given.preprocessorMaxWorkers }),
  ...(given.lightningcss === undefined ? {} : { lightningcss: withoutVisitor(given.lightningcss) })
});

/** What is taken of `optimizeDeps`. */
const optimizeFields = (
  given: NonNullable<UserConfig["optimizeDeps"]>
): NonNullable<UserConfig["optimizeDeps"]> => ({
  ...(given.include === undefined ? {} : { include: given.include }),
  ...(given.exclude === undefined ? {} : { exclude: given.exclude })
});

/** The `define` names that replace a whole environment. */
const WHOLE_ENVIRONMENT = new Set(["process.env", "import.meta.env"]);

/**
 * Whether a `define` value is empty: `process.env: {}` is a common way to keep code that reads it from failing, and holds
 * nothing.
 */
const isEmptyDefine = (value: unknown): boolean =>
  value === "{}" || (typeof value === "object" && value !== null && Object.keys(value).length === 0);

/**
 * A `define` without a whole environment written out: a catalogue bundles code the app does not (Testing Library reads
 * `process.env`), so what the app kept out of its bundles would reach the catalogue's.
 *
 * @param define - the configuration's.
 */
export const withoutWholeEnvironment = (
  define: NonNullable<UserConfig["define"]>
): NonNullable<UserConfig["define"]> =>
  Object.fromEntries(
    Object.entries(define).filter(([name, value]) => !WHOLE_ENVIRONMENT.has(name) || isEmptyDefine(value))
  );

/** What is taken of how code compiles and what it reads. */
const compileFields = (config: UserConfig): UserConfig => ({
  ...(config.define === undefined ? {} : { define: withoutWholeEnvironment(config.define) }),
  ...(config.assetsInclude === undefined ? {} : { assetsInclude: config.assetsInclude }),
  ...(config.json === undefined ? {} : { json: config.json }),
  ...(config.esbuild === undefined ? {} : { esbuild: config.esbuild }),
  ...(config.oxc === undefined ? {} : { oxc: config.oxc }),
  ...(config.envPrefix === undefined ? {} : { envPrefix: config.envPrefix })
});

/** The folders it names, absolute: the catalogue's root is not the one they are written against. */
const folderFields = ({ envDir, publicDir }: UserConfig, root: string): UserConfig => ({
  ...(typeof envDir === "string" ? { envDir: resolve(root, envDir) } : {}),
  ...(typeof publicDir === "string" ? { publicDir: resolve(root, publicDir) } : {}),
  ...(publicDir === false ? { publicDir: false } : {})
});

/**
 * What a catalogue takes of the app's configuration besides its plugins: what decides how a module resolves and
 * compiles. `root`, `base`, `build`, `server`, `preview` and `test` are about the app's page and output.
 *
 * @param config - the configuration, loaded.
 * @param dir - the catalogue's folder, which its relative paths are read against when it names no root.
 */
export const appConfigFields = (config: UserConfig, dir: string): UserConfig => {
  const resolved = resolveFields(config.resolve ?? {});
  const css = cssFields(config.css ?? {});
  const optimizeDeps = optimizeFields(config.optimizeDeps ?? {});
  return {
    ...(Object.keys(resolved).length === 0 ? {} : { resolve: resolved }),
    ...(Object.keys(css).length === 0 ? {} : { css }),
    ...(Object.keys(optimizeDeps).length === 0 ? {} : { optimizeDeps }),
    ...compileFields(config),
    ...folderFields(config, resolve(dir, config.root ?? "."))
  };
};

/**
 * The PostCSS plugins of a configuration's `css.postcss`, when it writes them there rather than in a file.
 *
 * @param config - the configuration, loaded.
 */
const inlinePostcssPlugins = (config: UserConfig): readonly unknown[] | undefined => {
  const postcss = config.css?.postcss;
  return isRecord(postcss) && Array.isArray(postcss["plugins"]) ? postcss["plugins"] : undefined;
};

/** A hook's function, from the function or the function with its order. */
const handlerOf = <THandler>(hook: THandler | { readonly handler: THandler }): THandler =>
  typeof hook === "object" && hook !== null && "handler" in hook ? hook.handler : hook;

/** A hook's order, when it names one. */
const orderOf = (hook: unknown): { readonly order?: "pre" | "post" | null } => {
  const order: unknown =
    typeof hook === "object" && hook !== null && "order" in hook ? hook.order : undefined;
  return order === "pre" || order === "post" ? { order } : {};
};

/** A plugin's `config`, what it returns filtered. */
const guardedConfig = (hook: NonNullable<Plugin["config"]>, dir: string): NonNullable<Plugin["config"]> => {
  const handler = handlerOf(hook);
  return {
    ...orderOf(hook),
    async handler(this: unknown, config: UserConfig, env: ConfigEnv): Promise<UserConfig | null> {
      const returned: UserConfig | null | undefined = await Reflect.apply(handler, this, [config, env]);
      return returned === null || returned === undefined ? null : appConfigFields(returned, dir);
    }
  };
};

/** A plugin's `transformIndexHtml`, for the frames' page alone. */
const guardedHtml = (
  hook: NonNullable<Plugin["transformIndexHtml"]>
): NonNullable<Plugin["transformIndexHtml"]> => {
  const handler = handlerOf(hook);
  return {
    ...orderOf(hook),
    handler(this: unknown, html: string, context: IndexHtmlTransformContext): IndexHtmlTransformResult {
      return context.path.endsWith("frame.html") ? Reflect.apply(handler, this, [html, context]) : html;
    }
  };
};

/**
 * One of the app's plugins, kept from reaching past what a catalogue takes of an app.
 *
 * @remarks
 * What its `config` returns goes through the same filter as the file's, or a plugin could set the host, `fs.strict` or the
 * output. Its `configureServer` runs at the normal time, after the middlewares that keep each origin to itself: `order: "pre"`
 * would answer ahead of them. Its `transformIndexHtml` reaches the frames and not the catalogue's page, whose origin holds the
 * agent API: a story's frame is what the app's page stands for. A one-shot command's server runs no `configureServer` at all:
 * that hook is where a plugin starts a backend or a watcher of its own, whose output on an inherited stdout would break a
 * command's `--json`, and nothing a story asks for in the moment it is checked needs what it sets up for edits.
 *
 * @param plugin - the plugin.
 * @param dir - the folder its relative paths are read against.
 * @param isOneShot - whether the server is a one-shot command's.
 */
export const guardedAppPlugin = (plugin: Plugin, dir: string, isOneShot = false): Plugin => {
  const { config, configureServer: serverHook, transformIndexHtml, ...rest } = plugin;
  return {
    ...rest,
    ...(config === undefined ? {} : { config: guardedConfig(config, dir) }),
    ...(serverHook === undefined || isOneShot ? {} : { configureServer: handlerOf(serverHook) }),
    ...(transformIndexHtml === undefined ? {} : { transformIndexHtml: guardedHtml(transformIndexHtml) })
  };
};

/**
 * What a configuration sets that a catalogue cannot do: stories would differ from the app without a word otherwise.
 *
 * @param config - the configuration, loaded.
 * @param environment - what it was loaded for.
 * @param text - the file's text.
 */
const configNotes = (config: UserConfig, environment: ConfigEnv, text: string): readonly string[] => [
  ...(config.css?.modules !== undefined && config.css.modules !== false
    ? [
        "css.modules is not read: a catalogue compiles CSS modules with Lightning CSS, so localsConvention and the like do not apply; set css.lightningcss.cssModules"
      ]
    : []),
  ...(/\bjsxImportSource\b/.test(text)
    ? [
        "jsxImportSource is not read from the framework's plugin, which the adapter makes itself: give it to the adapter in the catalogue's configuration (react({ jsxImportSource }))"
      ]
    : []),
  ...(environment.command === "build" &&
  Object.keys(config.define ?? {}).some((name) => WHOLE_ENVIRONMENT.has(name)) &&
  Object.keys(withoutWholeEnvironment(config.define ?? {})).length !== Object.keys(config.define ?? {}).length
    ? ["define writes out a whole environment (process.env), which is left out of the catalogue's build"]
    : [])
];

/**
 * Loads the app's Vite configuration, and takes what a catalogue takes of it.
 *
 * @param dir - the catalogue's folder.
 * @param file - the file, from there.
 * @param environment - the command and the mode it is loaded for: a configuration may be a function of them.
 * @param framework - the adapter's name.
 * @param options - what the catalogue's configuration asks.
 * @param isReadingPaths - whether Vite reads `tsconfig` paths here.
 * @param isOneShot - whether the server is a one-shot command's.
 * @throws what the file throws when it loads.
 */
export const loadAppViteConfig = async (
  dir: string,
  file: string,
  environment: ConfigEnv,
  framework: string,
  options: ResolvedAppBuild,
  isReadingPaths: boolean,
  isOneShot: boolean
): Promise<AppViteConfig> => {
  const { loadConfigFromFile } = await import("vite");
  const path = resolve(dir, file);
  const loaded = await loadConfigFromFile(environment, path, dir, "silent");
  const config = loaded?.config ?? {};
  const written = await flatPlugins(config.plugins);
  const isKept = (plugin: Plugin): boolean => keepsAppPlugin(plugin.name, framework, options, isReadingPaths);
  const home = dirname(path);
  return {
    file,
    fields: appConfigFields(config, home),
    plugins: written.filter(isKept).map((plugin) => guardedAppPlugin(plugin, home, isOneShot)),
    leftOut: [...new Set(written.filter((plugin) => !isKept(plugin)).map((plugin) => plugin.name))],
    postcssPlugins: inlinePostcssPlugins(config),
    notes: configNotes(config, environment, readFileSync(path, "utf8"))
  };
};
