/**
 * The project's PostCSS, as Next.js runs it on every style sheet: Tailwind CSS (`@tailwindcss/postcss`), Autoprefixer
 * or any plugin its `postcss.config` names.
 *
 * @remarks
 * A catalogue's style sheets go through Lightning CSS (the forced states are a rewrite of it), which leaves PostCSS's
 * configuration unread: the Next.js plugin runs PostCSS first, with the project's configuration, so Lightning CSS receives
 * what Next.js would have produced. The configuration is read as Next.js reads it: a file exporting `{ plugins }`, the
 * plugins an object of names and options (`false` turns one off) or a list. PostCSS itself is the project's, or the
 * one the project's `next` brings: the catalogue adds none.
 *
 * @module
 */
import { existsSync, globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The names of a PostCSS configuration Next.js reads, in its order. */
const CONFIG_FILES = [
  ".postcssrc.json",
  ".postcssrc",
  "postcss.config.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
  "postcss.config.mts"
] as const;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What PostCSS's `process` gives, as this module reads it. */
export type Processed = {
  /** The style sheet. */
  readonly css: string;
  /** What the plugins said: among them, the files they read. */
  readonly messages: readonly unknown[];
};

/** PostCSS's processor, as this module uses it. */
type Processor = {
  /** Runs the plugins on a style sheet. */
  readonly process: (
    css: string,
    options: { readonly from: string; readonly to: string }
  ) => PromiseLike<Processed>;
};

/** PostCSS, as this module uses it: a processor made from plugins. */
type PostCss = (plugins: readonly unknown[]) => Processor;

/** Whether a value is PostCSS's function. */
const isPostCss = (value: unknown): value is PostCss => typeof value === "function";

/**
 * The files PostCSS's plugins said they read: each `dependency`, and each file of a `dir-dependency`'s glob.
 *
 * @param messages - the messages of PostCSS's result.
 */
export const watchedFiles = (messages: readonly unknown[]): string[] =>
  messages.flatMap((message) => {
    if (!isRecord(message)) return [];
    if (message["type"] === "dependency" && typeof message["file"] === "string") return [message["file"]];
    if (message["type"] !== "dir-dependency" || typeof message["dir"] !== "string") return [];
    const { dir } = message;
    const glob = typeof message["glob"] === "string" ? message["glob"] : "**/*";
    return globSync(glob, { cwd: dir, exclude: ["**/node_modules/**"] }).map((file) => resolve(dir, file));
  });

/**
 * The project's PostCSS configuration file, or none.
 *
 * @param dir - the project's folder.
 */
export const postcssConfigFile = (dir: string): string | undefined =>
  CONFIG_FILES.map((name) => join(dir, name)).find((file) => existsSync(file));

/**
 * The entries of a configuration's `plugins`: each plugin (a name, or a plugin already made) with its options.
 *
 * @param plugins - an object of names and options, or a list of names, `[name, options]` pairs and plugins.
 */
const pluginEntries = (plugins: unknown): [unknown, unknown][] => {
  if (isRecord(plugins)) return Object.entries(plugins);
  if (!Array.isArray(plugins)) return [];
  return plugins.map((plugin: unknown): [unknown, unknown] =>
    Array.isArray(plugin) ? [plugin[0], plugin[1]] : [plugin, undefined]
  );
};

/**
 * A plugin made from its package: its factory called with its options (none for `true` or nothing).
 *
 * @param module - the package, loaded.
 * @param options - the plugin's options.
 */
const madePlugin = (module: unknown, options: unknown): unknown => {
  const factory = isRecord(module) && "default" in module ? module["default"] : module;
  if (typeof factory !== "function") return factory;
  return Reflect.apply(factory, undefined, options === undefined || options === true ? [] : [options]);
};

/**
 * The plugins a configuration names, each loaded from the project and given its options; one set to `false` is off.
 *
 * @param plugins - the configuration's `plugins`: an object of names and options, or a list.
 * @param load - loads a plugin's package by name.
 */
export const configuredPlugins = async (
  plugins: unknown,
  load: (name: string) => Promise<unknown>
): Promise<unknown[]> => {
  const loaded: unknown[] = [];
  for (const [plugin, options] of pluginEntries(plugins)) {
    if (options === false) continue;
    loaded.push(typeof plugin === "string" ? madePlugin(await load(plugin), options) : plugin);
  }
  return loaded;
};

/**
 * A module of the project, loaded as Node loads it: from the project's folder, else from the project's `next`.
 *
 * @param dir - the project's folder.
 * @param name - the package.
 */
const projectModule = async (dir: string, name: string): Promise<unknown> => {
  const fromProject = createRequire(join(dir, "package.json"));
  let file: string;
  try {
    file = fromProject.resolve(name);
  } catch {
    file = createRequire(fromProject.resolve("next/package.json")).resolve(name);
  }
  return import(pathToFileURL(file).href);
};

/**
 * The project's configuration, loaded.
 *
 * @param file - its file.
 */
const loadConfig = async (file: string): Promise<unknown> => {
  if (file.endsWith(".json") || file.endsWith(".postcssrc")) return JSON.parse(readFileSync(file, "utf8"));
  const module: unknown = await import(pathToFileURL(file).href);
  return isRecord(module) && "default" in module ? module["default"] : module;
};

/** Runs the project's PostCSS on a style sheet. */
export type PostcssRunner = (css: string, file: string) => Promise<Processed>;

/**
 * The project's PostCSS, ready to run: its configuration and plugins loaded on the first style sheet.
 *
 * @param dir - the project's folder.
 * @returns the runner, or none for a project without a PostCSS configuration.
 */
export const projectPostcss = (dir: string): PostcssRunner | undefined => {
  const file = postcssConfigFile(dir);
  if (file === undefined) return undefined;
  let processor: Promise<Processor> | undefined;
  const ready = async (): Promise<Processor> => {
    const config = await loadConfig(file);
    const plugins = await configuredPlugins(isRecord(config) ? config["plugins"] : undefined, (name) =>
      projectModule(dir, name)
    );
    const module = await projectModule(dir, "postcss");
    const postcss = isRecord(module) && "default" in module ? module["default"] : module;
    if (!isPostCss(postcss))
      throw new Error(`${file} names plugins, and PostCSS could not be loaded to run them`);
    return postcss(plugins);
  };
  return async (css: string, path: string): Promise<Processed> => {
    processor ??= ready();
    return (await processor).process(css, { from: path, to: path });
  };
};
