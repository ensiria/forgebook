/**
 * The project's `nuxt.config`, as far as a catalogue reads it: its folders, its aliases, its components' and
 * auto-imports' folders, its style sheets, its public runtime config and its app config.
 *
 * @remarks
 * The file is loaded as Node loads a module (a `nuxt.config.ts` with its types stripped), with `defineNuxtConfig`
 * given as Nuxt gives it, a function that returns its argument; what it returns is read, never trusted: a field of the
 * wrong type is left out. Everything else in it (modules, Nitro, the server's routes, the build) concerns Nuxt's server
 * or its own build, so a story does not need it. A file that cannot be loaded is a warning, not a failure: the
 * catalogue still opens with Nuxt's defaults.
 *
 * The runtime config keeps its `public` part only, since that is all Nuxt sends to the browser; a `NUXT_PUBLIC_`
 * variable of the environment or the `.env` files replaces the value it names, as Nuxt's does.
 *
 * @module
 */
import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** A folder of components, as the catalogue reads it. */
export type ComponentsDir = {
  /** The folder, absolute. */
  readonly path: string;
  /** What every name in it starts with; none by default. */
  readonly prefix: string;
  /** Whether a component's folders are part of its name (`base/Button.vue` is `BaseButton`); `true` by default. */
  readonly pathPrefix: boolean;
};

/** What a catalogue reads of a Nuxt project. */
export type NuxtProjectConfig = {
  /** The file read, or none. */
  readonly file: string | undefined;
  /** The project's folder. */
  readonly rootDir: string;
  /** Its sources' folder: `app/` in Nuxt 4's layout, the project's folder in Nuxt 3's. */
  readonly srcDir: string;
  /** Its pages' folder. */
  readonly pagesDir: string;
  /** The aliases, by name, each to an absolute path or a package. */
  readonly alias: Readonly<Record<string, string>>;
  /** Its components' folders. */
  readonly componentsDirs: readonly ComponentsDir[];
  /** The folders whose exports are auto-imported. */
  readonly importsDirs: readonly string[];
  /** Whether auto-imports are on; `imports.autoImport: false` turns them off. */
  readonly isAutoImport: boolean;
  /** The style sheets every page loads (`css`), as paths or packages. */
  readonly css: readonly string[];
  /** The runtime config's `public` part, before the environment's variables. */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
  /** The app's base path; `/` by default. */
  readonly baseURL: string;
  /** Where Nuxt serves its built files from; `/_nuxt/` by default. */
  readonly buildAssetsDir: string;
  /** `appConfig`: the app config's values `nuxt.config` gives. */
  readonly appConfig: Readonly<Record<string, unknown>>;
  /** The project's `app.config` file, or none. */
  readonly appConfigFile: string | undefined;
};

/** The names `nuxt.config` may have, in the order Nuxt looks for them. */
export const NUXT_CONFIG_FILES = [
  "nuxt.config.ts",
  "nuxt.config.mts",
  "nuxt.config.js",
  "nuxt.config.mjs",
  "nuxt.config.cjs"
] as const;

/** The names `app.config` may have. */
const APP_CONFIG_FILES = ["app.config.ts", "app.config.mts", "app.config.js", "app.config.mjs"] as const;

/** The global function a `nuxt.config` calls without importing it. */
const DEFINE_CONFIG = "defineNuxtConfig";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An object field, or an empty object.
 *
 * @param config - the object.
 * @param name - the field.
 */
const objectField = (
  config: Readonly<Record<string, unknown>>,
  name: string
): Readonly<Record<string, unknown>> => {
  const value = config[name];
  return isRecord(value) ? value : {};
};

/**
 * A text field, or none.
 *
 * @param config - the object.
 * @param name - the field.
 */
const textField = (config: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = config[name];
  return typeof value === "string" ? value : undefined;
};

/** Whether a path is a folder. */
const isFolder = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/**
 * A path as Nuxt resolves one written in its config: `~`, `@`, `~~` and `@@` replaced, a relative path from the
 * project's folder, a package left as it is.
 *
 * @param path - the path.
 * @param rootDir - the project's folder.
 * @param srcDir - its sources' folder.
 */
export const resolvedPath = (path: string, rootDir: string, srcDir: string): string => {
  const root = /^(~~|@@)(?=\/|$)/.exec(path);
  if (root !== null) return join(rootDir, path.slice(root[0].length));
  const src = /^(~|@)(?=\/|$)/.exec(path);
  if (src !== null) return join(srcDir, path.slice(src[0].length));
  if (isAbsolute(path)) return path;
  if (path.startsWith(".")) return resolve(rootDir, path);
  return path;
};

/**
 * A folder of `imports.dirs`: an alias as Nuxt resolves it, anything else from the sources' folder, as Nuxt reads it.
 *
 * @param path - the folder, as written.
 * @param rootDir - the project's folder.
 * @param srcDir - its sources' folder.
 */
const importsDir = (path: string, rootDir: string, srcDir: string): string => {
  const resolved = resolvedPath(path, rootDir, srcDir);
  return isAbsolute(resolved) && resolved !== resolve(rootDir, path) ? resolved : resolve(srcDir, path);
};

/**
 * The components' folders a config gives: `components/` of the sources by default, none for `false`, else each entry
 * of the list (or of `dirs`), a path or `{ path, prefix, pathPrefix }`.
 *
 * @param value - `components`.
 * @param rootDir - the project's folder.
 * @param srcDir - its sources' folder.
 */
const componentsDirsOf = (value: unknown, rootDir: string, srcDir: string): ComponentsDir[] => {
  if (value === false) return [];
  const entries: unknown = isRecord(value) ? value["dirs"] : value;
  // Nuxt's own: the islands' and the global folders inside the components' one, each scanned before it
  const list: readonly unknown[] = Array.isArray(entries)
    ? entries
    : ["~/components/islands", "~/components/global", "~/components"];
  return list.flatMap((entry: unknown): ComponentsDir[] => {
    if (typeof entry === "string")
      return [{ path: resolvedPath(entry, rootDir, srcDir), prefix: "", pathPrefix: true }];
    if (!isRecord(entry)) return [];
    const path = textField(entry, "path");
    if (path === undefined) return [];
    return [
      {
        path: resolvedPath(path, rootDir, srcDir),
        prefix: textField(entry, "prefix") ?? "",
        pathPrefix: entry["pathPrefix"] !== false
      }
    ];
  });
};

/**
 * What a catalogue reads of a configuration Nuxt would read.
 *
 * @param raw - what the file exported.
 * @param file - the file.
 * @param rootDir - the project's folder.
 */
export const readNuxtConfig = (
  raw: unknown,
  file: string | undefined,
  rootDir: string
): NuxtProjectConfig => {
  const config = isRecord(raw) ? raw : {};
  const srcGiven = textField(config, "srcDir");
  // Nuxt 4 keeps the sources in `app/`; a project laid out as Nuxt 3's has them at its root
  const nuxt4Dir = join(rootDir, "app");
  const defaultDir = isFolder(nuxt4Dir) ? nuxt4Dir : rootDir;
  const srcDir = srcGiven === undefined ? defaultDir : resolve(rootDir, srcGiven);
  const dir = objectField(config, "dir");
  const app = objectField(config, "app");
  const imports = objectField(config, "imports");
  const extraImports = imports["dirs"];
  const css = config["css"];
  const appConfigFile = APP_CONFIG_FILES.map((name) => join(srcDir, name)).find((path) => existsSync(path));
  return {
    file,
    rootDir,
    srcDir,
    pagesDir: join(srcDir, textField(dir, "pages") ?? "pages"),
    alias: {
      ...Object.fromEntries(
        Object.entries(objectField(config, "alias")).flatMap(([name, path]) =>
          typeof path === "string" ? [[name, resolvedPath(path, rootDir, srcDir)]] : []
        )
      )
    },
    componentsDirs: componentsDirsOf(config["components"], rootDir, srcDir),
    importsDirs: [
      join(srcDir, "composables"),
      join(srcDir, "utils"),
      join(rootDir, "shared", "utils"),
      ...(Array.isArray(extraImports)
        ? extraImports.flatMap((each: unknown) =>
            typeof each === "string" ? [importsDir(each, rootDir, srcDir)] : []
          )
        : [])
    ],
    isAutoImport: imports["autoImport"] !== false,
    css: Array.isArray(css)
      ? css.flatMap((each: unknown) =>
          typeof each === "string" ? [resolvedPath(each, rootDir, srcDir)] : []
        )
      : [],
    publicRuntimeConfig: objectField(objectField(config, "runtimeConfig"), "public"),
    baseURL: textField(app, "baseURL") ?? "/",
    buildAssetsDir: textField(app, "buildAssetsDir") ?? "/_nuxt/",
    appConfig: objectField(config, "appConfig"),
    appConfigFile
  };
};

/**
 * The project's `nuxt.config` file: the first Nuxt would find in its folder.
 *
 * @param rootDir - the project's folder.
 */
export const nuxtConfigFile = (rootDir: string): string | undefined =>
  NUXT_CONFIG_FILES.map((name) => join(rootDir, name)).find((file) => existsSync(file));

/**
 * Loads a project's `nuxt.config`.
 *
 * @param rootDir - the project's folder.
 * @returns what the catalogue reads of it, and why it could not be loaded when it could not.
 */
export const loadNuxtConfig = async (
  rootDir: string
): Promise<{ readonly config: NuxtProjectConfig; readonly problem: string | undefined }> => {
  const file = nuxtConfigFile(rootDir);
  if (file === undefined) return { config: readNuxtConfig({}, undefined, rootDir), problem: undefined };
  // Nuxt gives the file this function without an import; one the project already has (Nuxt's own) is left as it is
  const isGiven = !(DEFINE_CONFIG in globalThis);
  if (isGiven) Reflect.set(globalThis, DEFINE_CONFIG, (config: unknown): unknown => config);
  try {
    const loaded: unknown = await import(pathToFileURL(file).href);
    const exported = isRecord(loaded) && "default" in loaded ? loaded["default"] : loaded;
    const raw: unknown =
      typeof exported === "function" ? await Reflect.apply(exported, undefined, []) : exported;
    return { config: readNuxtConfig(raw, file, rootDir), problem: undefined };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { config: readNuxtConfig({}, file, rootDir), problem: `${file} could not be loaded (${reason})` };
  } finally {
    if (isGiven) Reflect.deleteProperty(globalThis, DEFINE_CONFIG);
  }
};

/**
 * A key as Nuxt writes it in a variable's name: `apiBase` as `API_BASE`.
 *
 * @param key - the key.
 */
const envName = (key: string): string =>
  key
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[-.]/g, "_")
    .toUpperCase();

/**
 * A variable's value as Nuxt reads it: JSON when it is (a number, a boolean, an object), else the text.
 *
 * @param value - the variable's value.
 */
const envValue = (value: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return value;
  }
};

/**
 * The public runtime config with the environment's variables over it: `NUXT_PUBLIC_API_BASE` replaces
 * `public.apiBase`, a nested key adding its name (`NUXT_PUBLIC_MAP_KEY` for `public.map.key`). Only a key the config
 * has is replaced, as Nuxt replaces it.
 *
 * @param config - the config's `public` part.
 * @param env - the variables, by name.
 * @param prefix - the variables' prefix for this level; `NUXT_PUBLIC_` at the top.
 */
export const withEnvironment = (
  config: Readonly<Record<string, unknown>>,
  env: Readonly<Record<string, string>>,
  prefix = "NUXT_PUBLIC_"
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      const name = `${prefix}${envName(key)}`;
      const given = env[name];
      if (given !== undefined) return [key, envValue(given)];
      return [key, isRecord(value) ? withEnvironment(value, env, `${name}_`) : value];
    })
  );
