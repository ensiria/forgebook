/**
 * A project's PostCSS, as its own build runs it on every style sheet: Tailwind CSS (`@tailwindcss/postcss`, or
 * `tailwindcss` before 4), Autoprefixer or any plugin its configuration names.
 *
 * @remarks
 * A catalogue's style sheets go through Lightning CSS (the forced states are a rewrite of it), which leaves PostCSS's
 * configuration unread: what this module makes runs first, so Lightning CSS receives what the app's build would have
 * produced. A configuration is a file exporting `{ plugins }`, the plugins an object of names and options (`false` turns
 * one off) or a list, as PostCSS's loader reads it. Loading one runs the project's code, as its own build does, and
 * nothing loads until the first style sheet asks. The project's folders are searched up to its repository's root, where
 * a workspace keeps the one its packages share. PostCSS itself is the project's, or Vite's own: the catalogue adds none.
 *
 * @module
 */
import { existsSync, globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { inlineCssImports } from "./cssImports.ts";

/** The names of a PostCSS configuration, in the order they are read. */
const CONFIG_FILES = [
  ".postcssrc.json",
  ".postcssrc",
  "postcss.config.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
  "postcss.config.mts",
  "postcss.config.cts",
  ".postcssrc.js",
  ".postcssrc.cjs",
  ".postcssrc.mjs",
  ".postcssrc.ts"
] as const;

/** What marks a repository's root: a project's search for a configuration stops there. */
const ROOT_MARKS = [".git", "pnpm-workspace.yaml"];

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

/** The configuration in `package.json`'s `postcss`, or none. */
const packageConfig = (dir: string): unknown => {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return undefined;
  try {
    const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));
    return isRecord(manifest) ? manifest["postcss"] : undefined;
  } catch {
    return undefined;
  }
};

/** Where a project's configuration is. */
export type PostcssConfigPlace =
  | {
      /** A file of its own. */
      readonly kind: "file";
      /** Its absolute path. */
      readonly file: string;
    }
  | {
      /** The `postcss` key of a `package.json`. */
      readonly kind: "package";
      /** That file's absolute path. */
      readonly file: string;
      /** What the key holds. */
      readonly config: unknown;
    };

/**
 * Where a project's PostCSS configuration is, or none: in its folder, else in the ones above it, up to its repository's
 * root.
 *
 * @param dir - the project's folder.
 */
export const postcssConfigPlace = (dir: string): PostcssConfigPlace | undefined => {
  let current = resolve(dir);
  while (true) {
    const file = CONFIG_FILES.map((name) => join(current, name)).find((path) => existsSync(path));
    if (file !== undefined) return { kind: "file", file };
    const config = packageConfig(current);
    if (config !== undefined) return { kind: "package", file: join(current, "package.json"), config };
    const parent = dirname(current);
    const isLast = current === homedir() || ROOT_MARKS.some((mark) => existsSync(join(current, mark)));
    if (parent === current || isLast) return undefined;
    current = parent;
  }
};

/**
 * The project's PostCSS configuration file, or none.
 *
 * @param dir - the project's folder.
 */
export const postcssConfigFile = (dir: string): string | undefined => postcssConfigPlace(dir)?.file;

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
 * A module loaded as Node loads it, from the first of the places that has it.
 *
 * @param dirs - the folders to resolve it from, in order.
 * @param name - the package.
 */
const moduleFrom = async (dirs: readonly string[], name: string): Promise<unknown> => {
  let failure: unknown;
  for (const dir of dirs) {
    try {
      return await import(pathToFileURL(createRequire(join(dir, "package.json")).resolve(name)).href);
    } catch (error) {
      failure ??= error;
    }
  }
  throw failure;
};

/**
 * A configuration file, loaded.
 *
 * @param file - its file.
 */
const loadConfig = async (file: string): Promise<unknown> => {
  if (file.endsWith(".json") || file.endsWith(".postcssrc")) return JSON.parse(readFileSync(file, "utf8"));
  const module: unknown = await import(pathToFileURL(file).href);
  return isRecord(module) && "default" in module ? module["default"] : module;
};

/**
 * The folder of a package a project has, to resolve what it brings from there; none when it has none.
 *
 * @param dir - the project's folder.
 * @param name - the package.
 */
const packageFolder = (dir: string, name: string): string | undefined => {
  try {
    return dirname(createRequire(join(dir, "package.json")).resolve(`${name}/package.json`));
  } catch {
    return undefined;
  }
};

/** The folder of the Vite this module runs on, whose PostCSS a project without its own uses. */
const viteFolder = (): string | undefined => packageFolder(import.meta.dirname, "vite");

/** The `plugins` of a configuration, read from where it is. */
const pluginsOf = async (place: PostcssConfigPlace | undefined): Promise<unknown> => {
  if (place === undefined) return undefined;
  const loaded = place.kind === "package" ? place.config : await loadConfig(place.file);
  // PostCSS's loader calls a configuration that is a function, with what it runs for
  const config =
    typeof loaded === "function"
      ? await Reflect.apply(loaded, undefined, [{ cwd: dirname(place.file), env: "development" }])
      : loaded;
  return isRecord(config) ? config["plugins"] : undefined;
};

/**
 * A project's PostCSS configuration that could not be loaded, which is a different thing from a sheet it refuses: every
 * sheet would fail alike, so a catalogue goes on without it and says so once.
 */
export class PostcssConfigError extends Error {}

/** Runs the project's PostCSS on a style sheet. */
export type PostcssRunner = (css: string, file: string) => Promise<Processed>;

/** What a project's PostCSS is made from, when it is not read from a configuration of its own. */
export type PostcssOptions = {
  /** A package of the project that brings its own PostCSS and plugins (Next.js does), looked in after the project. */
  readonly bringsPostcss?: string;
  /** The plugins, already made (Vite's `css.postcss`): no file is looked for. */
  readonly plugins?: readonly unknown[];
};

/**
 * The project's PostCSS, ready to run: its configuration and plugins loaded on the first style sheet.
 *
 * @param dir - the project's folder.
 * @param options - where else to look, and plugins already made.
 * @returns the runner, or none for a project without a PostCSS configuration.
 */
export const projectPostcss = (dir: string, options: PostcssOptions = {}): PostcssRunner | undefined => {
  const place = options.plugins === undefined ? postcssConfigPlace(dir) : undefined;
  if (options.plugins === undefined && place === undefined) return undefined;
  let processor: Promise<Processor> | undefined;
  const ready = async (): Promise<Processor> => {
    const brought =
      options.bringsPostcss === undefined ? undefined : packageFolder(dir, options.bringsPostcss);
    const searched = [
      dir,
      ...(place === undefined ? [] : [dirname(place.file)]),
      ...(brought === undefined ? [] : [brought])
    ];
    const plugins =
      options.plugins ??
      (await configuredPlugins(await pluginsOf(place), (name) => moduleFrom(searched, name)));
    const vite = viteFolder();
    const module = await moduleFrom([...searched, ...(vite === undefined ? [] : [vite])], "postcss");
    const postcss = isRecord(module) && "default" in module ? module["default"] : module;
    if (!isPostCss(postcss))
      throw new Error(`${place?.file ?? dir} names plugins, and PostCSS could not be loaded to run them`);
    return postcss(plugins);
  };
  return async (css: string, path: string): Promise<Processed> => {
    processor ??= ready().catch((error: unknown) => {
      // read again on the next sheet: the configuration may be saved fixed while the server runs
      processor = undefined;
      throw new PostcssConfigError(error instanceof Error ? error.message : String(error));
    });
    const { css: inlined, files } = inlineCssImports(css, path);
    const result = await (await processor).process(inlined, { from: path, to: path });
    return {
      css: result.css,
      messages: [...result.messages, ...files.map((file) => ({ type: "dependency", file }))]
    };
  };
};
