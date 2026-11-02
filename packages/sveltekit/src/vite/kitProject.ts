/**
 * A SvelteKit project, as the catalogue reads it: SvelteKit's options, from the project's own Vite configuration
 * (SvelteKit 3 keeps them there) or from `svelte.config.js` (SvelteKit 2), and the project's other Vite plugins.
 *
 * @remarks
 * The project's `vite.config` is loaded, not run as a server: SvelteKit's plugin, made there, holds the options it read
 * and checked (`api.options`), whichever version wrote them, so the catalogue reads what SvelteKit itself does. Its own
 * plugins are left out, since they build an app; the project's other plugins (Tailwind CSS, an i18n compiler) are kept,
 * so its components are drawn as the app draws them.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Options as SveltePluginOptions } from "@sveltejs/vite-plugin-svelte";
import { loadConfigFromFile, type Plugin, type PluginOption } from "vite";

/** What the catalogue reads of a SvelteKit project. */
export type KitProject = {
  /** The project's folder. */
  readonly dir: string;
  /** SvelteKit's options, as SvelteKit 3 writes them (SvelteKit 2's `kit` key, read the same). */
  readonly kit: Readonly<Record<string, unknown>>;
  /** Svelte's options (`preprocess`, `compilerOptions`, `extensions`) for Svelte's Vite plugin; none to read `svelte.config.js`. */
  readonly svelte: Partial<SveltePluginOptions> | undefined;
  /** The project's other Vite plugins. */
  readonly plugins: readonly PluginOption[];
  /** Why the project's configuration could not be read; none when it was. */
  readonly problem: string | undefined;
};

/** SvelteKit's plugin that holds the options it read. */
const SETUP_PLUGIN = "vite-plugin-sveltekit-setup";

/** The plugins SvelteKit's `sveltekit()` makes: its own, and Svelte's, which the catalogue makes itself. */
const KIT_PLUGIN = /^vite-plugin-svelte(kit)?([-:]|$)/;

/** The names `svelte.config` may have, in the order SvelteKit 2 looks for them. */
const SVELTE_CONFIGS = ["svelte.config.js", "svelte.config.mjs", "svelte.config.ts", "svelte.config.mts"];

/** The options of Svelte's Vite plugin read from SvelteKit's. */
const SVELTE_KEYS = ["preprocess", "compilerOptions", "extensions"];

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
 * SvelteKit's options held by its setup plugin.
 *
 * @param plugins - the project's plugins.
 */
const setupOptions = (plugins: readonly Plugin[]): Readonly<Record<string, unknown>> | undefined => {
  const setup = plugins.find((plugin) => plugin.name === SETUP_PLUGIN);
  const api: unknown = setup?.api;
  return isRecord(api) && isRecord(api["options"]) ? api["options"] : undefined;
};

/**
 * The options of Svelte's Vite plugin a SvelteKit configuration gives, read as they are: Svelte's plugin reads no
 * `svelte.config.js` then, since the configuration was it.
 *
 * @param options - SvelteKit's options, or `svelte.config.js`'s default export.
 */
const svelteOptionsOf = (options: Readonly<Record<string, unknown>>): Partial<SveltePluginOptions> => ({
  configFile: false,
  ...Object.fromEntries(
    SVELTE_KEYS.filter((key) => options[key] !== undefined).map((key) => [key, options[key]])
  )
});

/**
 * SvelteKit's options from a SvelteKit 2 `svelte.config.js`, loaded as Node loads a module.
 *
 * @param dir - the project's folder.
 */
const svelteConfigOptions = async (
  dir: string
): Promise<{ readonly kit: Readonly<Record<string, unknown>>; readonly problem: string | undefined }> => {
  const file = SVELTE_CONFIGS.map((name) => join(dir, name)).find((path) => existsSync(path));
  if (file === undefined) return { kit: {}, problem: undefined };
  try {
    const loaded: unknown = await import(pathToFileURL(file).href);
    const config = isRecord(loaded) && isRecord(loaded["default"]) ? loaded["default"] : {};
    return { kit: isRecord(config["kit"]) ? config["kit"] : {}, problem: undefined };
  } catch (error) {
    return {
      kit: {},
      problem: `${file} could not be loaded: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Reads a SvelteKit project.
 *
 * @param dir - the project's folder.
 * @param viteConfig - its Vite configuration, from the folder; the one Vite would find by default; `false` reads none.
 */
export const loadKitProject = async (
  dir: string,
  viteConfig: string | false | undefined
): Promise<KitProject> => {
  const root = resolve(dir);
  let loaded: Awaited<ReturnType<typeof loadConfigFromFile>> = null;
  let problem: string | undefined;
  if (viteConfig !== false) {
    try {
      loaded = await loadConfigFromFile(
        { command: "serve", mode: "development" },
        viteConfig === undefined ? undefined : resolve(root, viteConfig),
        root,
        "silent"
      );
    } catch (error) {
      problem = `The project's Vite configuration could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  const plugins = await flatPlugins(loaded?.config.plugins);
  const options = setupOptions(plugins);
  const others = plugins.filter((plugin) => !KIT_PLUGIN.test(plugin.name));
  // SvelteKit 2's options hold SvelteKit's under `kit`, beside Svelte's; SvelteKit 3's are SvelteKit's alone
  if (options !== undefined)
    return {
      dir: root,
      kit: isRecord(options["kit"]) ? options["kit"] : options,
      svelte: svelteOptionsOf(options),
      plugins: others,
      problem
    };
  const fromSvelteConfig = await svelteConfigOptions(root);
  return {
    dir: root,
    kit: fromSvelteConfig.kit,
    svelte: undefined,
    plugins: others,
    problem: problem ?? fromSvelteConfig.problem
  };
};
