/**
 * What a Nuxt project's modules give its components, as a catalogue takes it: their Vite plugins (Tailwind CSS through
 * Nuxt UI, UnoCSS) and the style sheets they add, read by loading the project with Nuxt itself, without building it.
 *
 * @remarks
 * A module does its work when Nuxt loads it: it registers Vite plugins on Nuxt's hooks, adds style sheets to `css`, and
 * writes templates that the app's plugins import. The catalogue loads the project with the project's own Nuxt
 * (`loadNuxt` of `@nuxt/kit`), calls the hooks a build calls before it makes Vite's configuration (`build:before`,
 * `vite:extend`, `vite:extendConfig` for the client), and takes the plugins and the style sheets that came of it. Nothing
 * is built and nothing is served by Nuxt. This runs the project's modules, which is project code, as `nuxt dev` does; a
 * module may also fetch from the network (a fonts module does). `nuxt({ loadModules: false })`, or the catalogue's `appBuild: false`, turns it off.
 *
 * What a module adds to Nuxt's own runtime is left out: what its plugins do to Nuxt's server, Nuxt's own plugins (by their names: a module's that only borrows
 * the `nuxt:` prefix, as `nuxt:fonts:` does, stays), devtools and inspectors, and
 * the framework's own plugin, which the adapter brings. A style sheet a module's app plugin imports (`import 'uno.css'`)
 * is taken too, since the app's plugins are not run. Templates a module writes are read from Nuxt's build folder, which
 * `nuxt prepare` writes; a template not written yet is named, and that step with it.
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Import } from "unimport";
import { type Logger, normalizePath, type Plugin } from "vite";

import type { ProjectComponent } from "./componentNames.ts";
import { resolvedPath } from "./nuxtConfig.ts";

/** What is Nuxt's own runtime, its tools, or the framework's plugin, by a plugin's name. */
const LEFT_OUT =
  /^(?:nuxt:(?:import-protection|components|component-name|prehydrate|layer-aliasing|devtools|head|lazy-hydration|imports-transform|pages-macros|nitro|virtual|remove-plugin-metadata|route-injection|navigate-to|composable-keys|tree-shake|async-context|keyed-functions|chunk|dev-server|runtime-paths|app)|nuxt-server-component-hmr|nuxtjs:i18n|unhead|@unhead|i18n:|unplugin-vue-i18n|vite-plugin-inspect|vite-plugin-vue-tracer|vite:vue|vite-plugin-checker|vite-plugin-pwa)/;

/** A style sheet a template imports for what it loads. */
const IMPORTED_SHEET = /^\s*import\s+["']([^"'\n]+\.css)["']/gm;

/** What a catalogue takes of a Nuxt project's modules. */
export type NuxtModules = {
  /** The Vite plugins they registered that a catalogue runs. */
  readonly plugins: readonly Plugin[];
  /** The names of those left out, each once. */
  readonly leftOut: readonly string[];
  /** Every style sheet the app loads, the config's and the modules', as imports write them; none when Nuxt could not load. */
  readonly css: readonly string[] | undefined;
  /** Nuxt's build folder, in Vite's form. */
  readonly buildDir: string | undefined;
  /** Whether what Nuxt wrote there is newer than the project's configs, so that its app config can be read. */
  readonly isFresh: boolean;
  /** Nuxt's own package folder, which the files it writes import their packages from (`defu`); none without Nuxt. */
  readonly nuxtDir: string | undefined;
  /** The scripts Nuxt keeps in memory rather than writing them (`#build/i18n-options.mjs`), by file name. */
  readonly builtScripts: ReadonlyMap<string, string>;
  /** What the modules give a file without an import (`useToast`), from what Nuxt wrote of its auto-imports. */
  readonly imports: readonly Import[];
  /** The components the modules give a template by name (`UButton`), from what Nuxt wrote of its components. */
  readonly components: readonly ProjectComponent[];
  /** What could not be done, each with what to do. */
  readonly problems: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is one of Vite's plugins. */
const isPlugin = (value: unknown): value is Plugin => isRecord(value) && typeof value["name"] === "string";

/** A configuration's plugins as one list: Vite takes nested lists and promises of plugins. */
const flatPlugins = async (plugins: unknown): Promise<Plugin[]> => {
  const value: unknown = await plugins;
  if (Array.isArray(value)) return (await Promise.all(value.map(flatPlugins))).flat();
  return isPlugin(value) ? [value] : [];
};

/** A loaded Nuxt, as this module uses it. */
type LoadedNuxt = {
  readonly options: Readonly<Record<string, unknown>>;
  readonly ready: () => Promise<void>;
  readonly callHook: (name: string, ...args: readonly unknown[]) => Promise<void>;
  readonly close: () => Promise<void>;
};

/** Whether a value is a loaded Nuxt. */
const isNuxt = (value: unknown): value is LoadedNuxt =>
  isRecord(value) &&
  isRecord(value["options"]) &&
  typeof value["ready"] === "function" &&
  typeof value["callHook"] === "function" &&
  typeof value["close"] === "function";

/**
 * The folder of the project's `nuxt` package; none without one.
 *
 * @param rootDir - the project's folder.
 */
const nuxtFolder = (rootDir: string): string | undefined => {
  try {
    return dirname(createRequire(join(rootDir, "package.json")).resolve("nuxt/package.json"));
  } catch {
    return undefined;
  }
};

/** `@nuxt/kit`'s `loadNuxt`. */
type LoadNuxt = (options: Readonly<Record<string, unknown>>) => Promise<unknown>;

/**
 * The project's `loadNuxt`, from the `@nuxt/kit` its `nuxt` brings; none without Nuxt.
 *
 * @param rootDir - the project's folder.
 */
const projectLoadNuxt = async (rootDir: string): Promise<LoadNuxt | undefined> => {
  try {
    const nuxtDir = nuxtFolder(rootDir);
    if (nuxtDir === undefined) return undefined;
    const kit: unknown = await import(
      pathToFileURL(createRequire(join(nuxtDir, "package.json")).resolve("@nuxt/kit")).href
    );
    const loadNuxt = isRecord(kit) ? kit["loadNuxt"] : undefined;
    return typeof loadNuxt === "function"
      ? (options: Readonly<Record<string, unknown>>): Promise<unknown> =>
          Reflect.apply(loadNuxt, undefined, [options])
      : undefined;
  } catch {
    return undefined;
  }
};

/** A record field of an object, empty when it is none. */
const recordAt = (
  value: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> => {
  const field = value[key];
  return isRecord(field) ? field : {};
};

/**
 * The Vite configuration a build would hand the modules' hooks: Nuxt's `vite` option with the fields they write to.
 *
 * @param vite - Nuxt's `vite` option.
 */
const viteConfigOf = (vite: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  ...vite,
  plugins: Array.isArray(vite["plugins"]) ? [...vite["plugins"]] : [],
  define: { ...recordAt(vite, "define") },
  resolve: { ...recordAt(vite, "resolve"), alias: { ...recordAt(recordAt(vite, "resolve"), "alias") } },
  css: { ...recordAt(vite, "css") },
  optimizeDeps: { include: [], exclude: [], ...recordAt(vite, "optimizeDeps") },
  build: { ...recordAt(vite, "build") },
  server: { ...recordAt(vite, "server") }
});

/**
 * The style sheets the modules' app plugins import, from the templates that write those plugins.
 *
 * @param nuxt - the loaded Nuxt.
 */
const pluginSheets = async (nuxt: LoadedNuxt): Promise<readonly string[]> => {
  const build = recordAt(nuxt.options, "build");
  const templates = Array.isArray(build["templates"]) ? build["templates"] : [];
  const sheets: string[] = [];
  for (const template of templates) {
    if (!isRecord(template) || typeof template["filename"] !== "string") continue;
    if (!/\.[cm]?js$/.test(template["filename"])) continue;
    const text = await templateText(nuxt, template);
    if (text !== undefined) sheets.push(...[...text.matchAll(IMPORTED_SHEET)].map((match) => match[1] ?? ""));
  }
  return sheets.filter((sheet) => sheet !== "");
};

/**
 * A style sheet of `css` as an import a catalogue can write: a path as Nuxt resolves it, `#build/` to Nuxt's build
 * folder, or none for a template not written yet.
 *
 * @param sheet - the entry.
 * @param paths - the project's folders.
 */
const sheetImport = (
  sheet: string,
  paths: { readonly rootDir: string; readonly srcDir: string; readonly buildDir: string }
): string | undefined => {
  if (!sheet.startsWith("#build/")) return resolvedPath(sheet, paths.rootDir, paths.srcDir);
  const file = join(paths.buildDir, sheet.slice("#build/".length));
  return existsSync(file) ? normalizePath(file) : undefined;
};

/**
 * A template's text, as Nuxt writes it; none for one that needs the whole app, which `nuxt prepare` writes.
 *
 * @param nuxt - the loaded Nuxt.
 * @param template - the template.
 */
const templateText = async (
  nuxt: LoadedNuxt,
  template: Readonly<Record<string, unknown>>
): Promise<string | undefined> => {
  const getContents = template["getContents"];
  if (typeof getContents !== "function") return undefined;
  try {
    const text: unknown = await Reflect.apply(getContents, template, [
      { nuxt, app: {}, options: template["options"] ?? {} }
    ]);
    return typeof text === "string" ? text : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Writes the templates modules ask Nuxt to write, as `nuxt prepare` does: a module's style sheet reads its neighbours by
 * relative path (`@source "./ui"`), so they go where Nuxt puts them. A file already holding the same text is left alone.
 *
 * @param nuxt - the loaded Nuxt.
 * @param buildDir - Nuxt's build folder.
 */
const writeTemplates = async (nuxt: LoadedNuxt, buildDir: string): Promise<void> => {
  const build = recordAt(nuxt.options, "build");
  const templates = Array.isArray(build["templates"]) ? build["templates"] : [];
  for (const template of templates) {
    if (!isRecord(template) || template["write"] !== true) continue;
    const filename = template["filename"];
    const text = await templateText(nuxt, template);
    if (typeof filename !== "string" || filename.includes("..") || text === undefined) continue;
    const file = join(buildDir, filename);
    if (existsSync(file) && readFileSync(file, "utf8") === text) continue;
    mkdirSync(dirname(file), { recursive: true });
    // a `nuxt dev` reading the folder meanwhile sees the old file or the new, never half of one
    writeFileSync(`${file}.forgebook`, text);
    renameSync(`${file}.forgebook`, file);
  }
};

/** A script a template writes, not a declaration. */
const SCRIPT_TEMPLATE = /(?<!\.d)\.(?:mjs|js|ts)$/;

/**
 * The scripts Nuxt keeps in memory rather than writing them: a module's runtime imports them (`#build/i18n-options.mjs`).
 * One that needs the whole app to be written is left out, and a story that imports it is told so.
 *
 * @param nuxt - the loaded Nuxt.
 * @param buildDir - Nuxt's build folder, where a written one is read instead.
 */
const builtScriptsOf = async (nuxt: LoadedNuxt, buildDir: string): Promise<ReadonlyMap<string, string>> => {
  const build = recordAt(nuxt.options, "build");
  const templates = Array.isArray(build["templates"]) ? build["templates"] : [];
  const scripts = new Map<string, string>();
  for (const template of templates) {
    if (!isRecord(template)) continue;
    const filename = template["filename"];
    if (
      typeof filename !== "string" ||
      !SCRIPT_TEMPLATE.test(filename) ||
      existsSync(join(buildDir, filename))
    )
      continue;
    const text = await templateText(nuxt, template);
    if (text !== undefined) scripts.set(filename, text);
  }
  return scripts;
};

/** Runs a function with what is written to stdout sent to stderr: a command's stdout is its answer. */
const onStderr = async <TResult>(run: () => Promise<TResult>): Promise<TResult> => {
  // two loads at once share one swap: the first saves stdout's own `write`, the last puts it back
  if (swaps === 0) savedWrite = process.stdout.write;
  swaps += 1;
  Object.assign(process.stdout, { write: process.stderr.write.bind(process.stderr) });
  try {
    return await run();
  } finally {
    swaps -= 1;
    if (swaps === 0 && savedWrite !== undefined) Object.assign(process.stdout, { write: savedWrite });
  }
};

/** How many loads have stdout sent to stderr now. */
let swaps = 0;

/** Stdout's own `write`, while a load has it sent to stderr. */
let savedWrite: typeof process.stdout.write | undefined;

/** The empty answer, with what to say. */
const none = (problems: readonly string[]): NuxtModules => ({
  plugins: [],
  leftOut: [],
  css: undefined,
  buildDir: undefined,
  isFresh: false,
  nuxtDir: undefined,
  builtScripts: new Map(),
  imports: [],
  components: [],
  problems
});

/** A module of Nuxt's own, Vue's or the router's, which the adapter gives through its stand-ins. */
const isNuxtOwn = (from: string): boolean =>
  from === "vue" ||
  from === "vue-router" ||
  from.startsWith("#") ||
  /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:nuxt|@nuxt\/kit|vue|vue-router|@unhead\/vue)\//.test(
    from
  );

/** A path Nuxt wrote in its build folder, absolute. */
const fromBuildDir = (buildDir: string, path: string): string =>
  path.startsWith(".") ? normalizePath(resolve(buildDir, path)) : path;

/** A name a module can export. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A path with nothing a module's code could read as more than a path. */
const PLAIN_PATH = /^[\w@./:+~-][\w@./:+~ -]*$/;

/** An `export { a, b as c } from "x";` line of Nuxt's `imports.d.ts`. */
const EXPORT_LINE = /^export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;

/**
 * The auto-imports Nuxt wrote that come from its modules, not from Nuxt, Vue or the router.
 *
 * @param text - the text of `imports.d.ts`.
 * @param buildDir - Nuxt's build folder, its paths relative to.
 * @param canLoad - whether a source can be loaded from the project; every one by default.
 */
export const moduleImports = (
  text: string,
  buildDir: string,
  canLoad: (from: string) => boolean = (): boolean => true
): readonly Import[] =>
  [...text.matchAll(EXPORT_LINE)].flatMap((match) => {
    const from = fromBuildDir(buildDir, match[2] ?? "");
    // `#imports` exports them all, so one that cannot load would stop every story
    if (isNuxtOwn(from) || !canLoad(from)) return [];
    // the names and the path go into `#imports`' code as they are: anything but plain names and a plain path is refused
    if (!PLAIN_PATH.test(from)) return [];
    return (match[1] ?? "").split(",").flatMap((part) => {
      const [name, as] = part.trim().split(/\s+as\s+/);
      const alias = as ?? name;
      return name !== undefined && alias !== undefined && IDENTIFIER.test(name) && IDENTIFIER.test(alias)
        ? [{ name, as: alias, from }]
        : [];
    });
  });

/** A component line of Nuxt's `components.d.ts`. */
const COMPONENT_LINE = /^export const ([A-Z]\w*): typeof import\("([^"]+)"\)(?:\['default'\]|\.default)/gm;

/**
 * The components Nuxt wrote that come from its modules.
 *
 * @param text - the text of `components.d.ts`.
 * @param buildDir - Nuxt's build folder, its paths relative to.
 */
export const moduleComponents = (text: string, buildDir: string): readonly ProjectComponent[] =>
  [...text.matchAll(COMPONENT_LINE)].flatMap((match) => {
    const file = fromBuildDir(buildDir, match[2] ?? "");
    // absolute on the running system: on Windows a file Nuxt wrote starts with its drive (`D:/`)
    return match[1] === undefined || isNuxtOwn(file) || !isAbsolute(file) ? [] : [{ name: match[1], file }];
  });

/** The extensions a source Nuxt wrote without one may have. */
const SOURCE_EXTENSIONS = ["", ".js", ".mjs", ".ts", ".mts", ".vue", "/index.js", "/index.mjs", "/index.ts"];

/**
 * Whether a source an import names can be loaded from the project: a file with one of its extensions, or a package it
 * has installed.
 *
 * @param rootDir - the project's folder.
 */
const loadableFrom =
  (rootDir: string) =>
  (from: string): boolean => {
    if (isAbsolute(from)) return SOURCE_EXTENSIONS.some((extension) => existsSync(`${from}${extension}`));
    const parts = from.split("/");
    const name = parts.slice(0, from.startsWith("@") ? 2 : 1).join("/");
    let dir = rootDir;
    while (true) {
      if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
      const parent = dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  };

/** The names of the configs Nuxt's written files are made from. */
const CONFIG_NAMES = [
  "nuxt.config.ts",
  "nuxt.config.js",
  "nuxt.config.mjs",
  "app.config.ts",
  "app.config.js"
];

/**
 * Whether a file Nuxt wrote is newer than every config it is made from.
 *
 * @param file - the file.
 * @param rootDir - the project's folder.
 * @param srcDir - its sources' folder, where `app.config` is.
 */
const isNewerThanConfig = (file: string, rootDir: string, srcDir: string): boolean => {
  if (!existsSync(file)) return false;
  const written = statSync(file).mtimeMs;
  return [rootDir, srcDir]
    .flatMap((dir) => CONFIG_NAMES.map((name) => join(dir, name)))
    .every((config) => !existsSync(config) || statSync(config).mtimeMs <= written);
};

/** A file of the build folder's text; empty when Nuxt has not written it. */
const builtText = (buildDir: string, name: string): string => {
  const file = join(buildDir, name);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

/**
 * Loads a Nuxt project's modules, and takes what a catalogue takes of them.
 *
 * @param rootDir - the project's folder.
 */
export const loadNuxtModules = (rootDir: string): Promise<NuxtModules> =>
  onStderr(() => loadModules(rootDir));

/**
 * A module's plugin without what it does to a server: it expects Nuxt's own (an h3 app, its handlers), which a catalogue
 * does not run, and one crashed every command it ran in. Its transforms, which give components their looks, stay.
 *
 * @param plugin - the plugin.
 */
const withoutServer = ({
  configureServer: _server,
  configurePreviewServer: _preview,
  ...rest
}: Plugin): Plugin => rest;

/**
 * What the project's files say Nuxt still has to write: `nuxt prepare` is the step for each.
 *
 * @param missing - the style sheets listed and not written.
 * @param isPrepared - whether Nuxt wrote its components and auto-imports.
 * @param isFresh - whether those are newer than the configs.
 */
const preparedProblems = (
  missing: readonly string[],
  isPrepared: boolean,
  isFresh: boolean
): readonly string[] =>
  [
    ...(missing.length === 0
      ? []
      : [`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} written by Nuxt and not there yet`]),
    ...(isPrepared
      ? []
      : ["The modules' components and auto-imports are read from what Nuxt writes, which is not there yet"]),
    ...(isPrepared && !isFresh
      ? [
          "What Nuxt wrote of the modules' components and auto-imports is older than nuxt.config or app.config"
        ]
      : [])
  ].map((problem) => `${problem}: run \`nuxt prepare\`, then start the catalogue again`);

/**
 * What a catalogue takes of a loaded Nuxt: its modules' plugins, style sheets, written files, components and imports.
 *
 * @param nuxt - the loaded Nuxt, its hooks called.
 * @param rootDir - the project's folder.
 * @param written - the plugins the hooks gave.
 */
const takenFrom = async (
  nuxt: LoadedNuxt,
  rootDir: string,
  written: readonly Plugin[]
): Promise<NuxtModules> => {
  const { options } = nuxt;
  const paths = {
    rootDir: normalizePath(rootDir),
    srcDir: normalizePath(String(options["srcDir"] ?? rootDir)),
    buildDir: normalizePath(String(options["buildDir"] ?? join(rootDir, ".nuxt")))
  };
  await writeTemplates(nuxt, paths.buildDir);
  const listed = [
    ...(Array.isArray(options["css"]) ? options["css"] : []).filter((sheet) => typeof sheet === "string"),
    ...(await pluginSheets(nuxt))
  ];
  const importsText =
    builtText(paths.buildDir, "imports.d.ts") || builtText(paths.buildDir, "types/imports.d.ts");
  const componentsText = builtText(paths.buildDir, "components.d.ts");
  const isPrepared = importsText !== "" && componentsText !== "";
  const isFresh = isNewerThanConfig(join(paths.buildDir, "components.d.ts"), rootDir, paths.srcDir);
  const isLeftOut = (plugin: Plugin): boolean => LEFT_OUT.test(plugin.name);
  return {
    plugins: written.filter((plugin) => !isLeftOut(plugin)).map(withoutServer),
    leftOut: [...new Set(written.filter(isLeftOut).map((plugin) => plugin.name))],
    css: [...new Set(listed.flatMap((sheet) => sheetImport(sheet, paths) ?? []))],
    buildDir: paths.buildDir,
    isFresh: isPrepared && isFresh,
    builtScripts: await builtScriptsOf(nuxt, paths.buildDir),
    nuxtDir: nuxtFolder(rootDir),
    imports: moduleImports(importsText, paths.buildDir, loadableFrom(rootDir)),
    components: moduleComponents(componentsText, paths.buildDir),
    problems: preparedProblems(
      listed.filter((sheet) => sheetImport(sheet, paths) === undefined),
      isPrepared,
      isFresh
    )
  };
};

/** Does the work of `loadNuxtModules`. */
const loadModules = async (rootDir: string): Promise<NuxtModules> => {
  const loadNuxt = await projectLoadNuxt(rootDir);
  if (loadNuxt === undefined) return none([]);
  let nuxt: LoadedNuxt | undefined;
  try {
    const loaded = await loadNuxt({
      cwd: rootDir,
      dev: true,
      ready: false,
      overrides: { logLevel: "silent", devtools: { enabled: false }, telemetry: false }
    });
    if (!isNuxt(loaded)) return none([]);
    nuxt = loaded;
    await nuxt.ready();
    await nuxt.callHook("build:before");
    const config = viteConfigOf(recordAt(nuxt.options, "vite"));
    await nuxt.callHook("vite:extend", { nuxt, config });
    await nuxt.callHook("vite:extendConfig", config, { isClient: true, isServer: false });
    return await takenFrom(nuxt, rootDir, await flatPlugins(config["plugins"]));
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return none([
      `The project's Nuxt modules could not be loaded, so their plugins and style sheets are not in the catalogue: ${reason}. Set nuxt({ loadModules: false }) to leave them out`
    ]);
  } finally {
    await nuxt?.close().catch(() => undefined);
  }
};

/**
 * The file a `#build/` import names in Nuxt's build folder, when Nuxt wrote it.
 *
 * @param id - the import.
 * @param buildDir - the build folder; none when the modules were not loaded.
 */
export const builtFile = (id: string, buildDir: string | undefined): string | undefined => {
  if (buildDir === undefined || !id.startsWith("#build/") || id.split("/").includes("..")) return undefined;
  const file = join(buildDir, id.slice("#build/".length));
  // an import may leave out the extension Nuxt wrote (`#build/app.config`)
  const found = ["", ".mjs", ".js", ".ts"]
    .map((extension) => `${file}${extension}`)
    .find((path) => existsSync(path) && !path.endsWith("/"));
  return found === undefined ? undefined : normalizePath(found);
};

/**
 * The name of a script Nuxt keeps in memory that an import names, extension or not.
 *
 * @param id - the import.
 * @param scripts - the scripts, by file name.
 */
export const builtScriptName = (id: string, scripts: ReadonlyMap<string, string>): string | undefined => {
  if (!id.startsWith("#build/")) return undefined;
  const name = id.slice("#build/".length);
  return [name, `${name}.mjs`, `${name}.js`, `${name}.ts`].find((each) => scripts.has(each));
};

/**
 * Says what the catalogue took of the modules, and what it could not.
 *
 * @param logger - Vite's logger.
 * @param modules - what they gave; none when they were not loaded.
 */
export const sayModules = (logger: Logger, modules: NuxtModules | undefined): void => {
  if (modules === undefined) return;
  if (modules.plugins.length > 0)
    logger.info(
      `[forgebook] Drawing with the Nuxt modules' plugins: ${modules.plugins.map(({ name }) => name).join(", ")}`
    );
  for (const problem of modules.problems) logger.error(`[forgebook] ${problem}`);
};

/**
 * Whether an importer is a file Nuxt wrote, whose packages are Nuxt's own dependencies (`defu`), which a strict install
 * keeps out of the project's reach.
 *
 * @param importer - the importer's id.
 * @param modules - what the modules gave.
 */
export const isWrittenByNuxt = (importer: string | undefined, modules: NuxtModules | undefined): boolean =>
  importer !== undefined &&
  modules?.buildDir !== undefined &&
  (normalizePath(importer).startsWith(`${modules.buildDir}/`) || importer.includes("kept:"));
