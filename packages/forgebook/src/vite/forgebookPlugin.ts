/**
 * The Vite plugin an app adds to show a catalogue: the story files of every source, and the forced-states rewrite of
 * every style sheet.
 *
 * @remarks
 * A source names its story files with `import files from "<pattern>?forgebook-files"`: the plugin answers each with
 * one module (`storyFilesModule.ts`) holding every matched file's index, read from its source with Vite's parser, and
 * the loaders of its module, of its component's docs and of its code. Those loaders ask for
 * `?forgebook-docs`, answered with the component's props as the framework reads them (`adapter.ts`, in a worker) or
 * `{ error }` for the panel, `?forgebook-code`, answered with each story's `render` as written (`storyCode.ts`),
 * `?forgebook-page`, answered with the component's documentation file as HTML (`componentPage.ts`), and
 * `?forgebook-markdown`, a source's own Markdown file (its introduction on the home) as HTML. A source's docs pages
 * come the same way, with `?forgebook-docs-pages` (`docPagesModule.ts`), and the written home with `?forgebook-home`. It also sets Lightning CSS as the CSS transformer with the forced-states visitor (`forcedStates.ts`) and lets Sass resolve
 * `pkg:` URLs, which the library's style sheets use.
 *
 * A pattern's module watches its story files, so an edit renews it. Vite watches only its root for new files, and the
 * sources' story files live in other packages: `watch` names their folders, and a story file added or removed there
 * renews every pattern's module and reloads the page, so the sidebar lists it at once.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import {
  type ConfigEnv,
  isFileLoadingAllowed,
  type Logger,
  type Plugin,
  type UserConfig,
  type ViteDevServer
} from "vite";

import { type FramesPlacement, SAME_ORIGIN } from "../frameOrigins.ts";
import { createLiveErrors, isLiveErrorReport, LIVE_ERROR_EVENT } from "../liveErrors.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { agentMiddleware, FRAMED_AGENT_PAGES } from "./agentRoutes.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { axeAddress, axeBuildAsset } from "./axeScript.ts";
import { type BuiltTexts, textsWriter } from "./builtTexts.ts";
import { catalogueConfig } from "./catalogueConfig.ts";
import { currentCloseWatch } from "./closeWatch.ts";
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { codeStamp, type DiskCache, diskCache } from "./diskCache.ts";
import { createDocsExtractor, type DocsExtractor } from "./docsExtractor.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { builtPlacement } from "./framesConfig.ts";
import { serveFrames } from "./framesServer.ts";
import { missingHeightsMiddleware } from "./heightsRoute.ts";
import { FILES_MODULE_HOT, renewedModule, servedPatterns, storyFileHotHooks } from "./hotSnippets.ts";
import { type EmitAsset, inlineJson, type PackJson, packedJsonOf } from "./packedModule.ts";
import {
  AGENT_SOURCES_FILE,
  agentSourcesModule,
  configModule,
  frameEntry,
  PAGE_ENTRIES,
  PAGE_FILES,
  type PageFile,
  pageHtml,
  pageModuleOf,
  pageModulePath,
  shellEntry,
  storiesSourceModule
} from "./pages.ts";
import { CONFIG_ID, DOCS_PAGES_PREFIX, patternId, TOKENS_ID, virtualId } from "./pluginIds.ts";
import {
  docsModule,
  docsValue,
  FILES_PREFIX,
  patternModule,
  REACH_ID_PREFIX,
  reachModule,
  searchIndexes,
  USAGE_ID_PREFIX,
  usageModule
} from "./pluginModules.ts";
import { type IndexedStoryFile, isKeptIndex, type KeptIndex, storyFilesGroupOf } from "./storyFilesModule.ts";
import { tokensModule } from "./storylessRoutes.ts";
import { CODE_QUERY, DOCS_PAGE_QUERY, HOME_QUERY, MARKDOWN_QUERY, PAGE_QUERY } from "./textQueries.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** This module's folder, in the core's package: the core's own dependencies resolve from here, not the project's. */
const PACKAGE_DIR: string = import.meta.dirname;

/**
 * Sass's `pkg:` importer, when the project installs Sass (`sass-embedded`, an optional peer): a library's styles
 * import its packages' with `pkg:` URLs. Without Sass, Vite compiles no `.scss` and needs none.
 */
const sassOptions = async (): Promise<NonNullable<UserConfig["css"]>> => {
  if (packageResolver(PACKAGE_DIR)("sass-embedded") === undefined) return {};
  const { NodePackageImporter } = await import("sass-embedded");
  return { preprocessorOptions: { scss: { importers: [new NodePackageImporter()] } } };
};

/** A docs page, whose file added or removed changes what the sidebar lists. */
const DOCS_PAGE_FILE = /\.md$/;

/** A TypeScript source file, whose edit may change a component's docs. */
const SOURCE_FILE = /\.tsx?$/;

/** The query that asks for a story file's component docs. */
const DOCS_QUERY = "?forgebook-docs";

/** The queries `textModules.ts` answers. */
const TEXT_QUERIES: readonly string[] = [CODE_QUERY, PAGE_QUERY, MARKDOWN_QUERY];

/** The queries of a story file's modules the shell reads, which hand an edit to it in place on a dev server. */
const RENEWED_QUERIES: readonly string[] = [DOCS_QUERY, CODE_QUERY, PAGE_QUERY];

/** The queries the plugin answers with a file's text, so each read keeps to what the dev server may serve. */
const FILE_QUERIES: readonly string[] = [
  DOCS_QUERY,
  CODE_QUERY,
  PAGE_QUERY,
  MARKDOWN_QUERY,
  DOCS_PAGE_QUERY,
  HOME_QUERY
];

/**
 * Whether a dev server may read the file a query names: a plugin's answer never passes Vite's own check of
 * `server.fs`, so without this any file could be asked for by adding a query to its address.
 *
 * @param id - the module's id.
 * @param server - the dev server; none in a build, which reads only what the sources import.
 */
const isReadable = (id: string, server: ViteDevServer | undefined): boolean =>
  server === undefined ||
  !FILE_QUERIES.some((query) => id.endsWith(query)) ||
  isFileLoadingAllowed(server.config, id.slice(0, id.lastIndexOf("?")));

/** The plugin's options. */
export type ForgebookPluginOptions = {
  /**
   * A catalogue's configuration already read (the `forgebook` command passes it). Without it, the plugin reads the
   * `forgebook.config.ts` in Vite's root when there is one, and then makes the catalogue's two pages.
   */
  readonly config?: ResolvedConfig;
  /**
   * The framework the stories are written for, where there is no configuration: a package's own test page of the
   * frame, which the plugin only indexes and documents (`react()` of `@forgebook/react/vite`).
   */
  readonly framework?: FrameworkAdapter;
  /** Folders outside the app the dev server watches for new story files, beside the configuration's `watch`. */
  readonly watch?: readonly string[];
};

/**
 * Renews modules in every environment that loaded them: the agents' routes load them on the server too.
 *
 * @param server - the dev server.
 * @param ids - the modules' ids.
 */
const invalidateEverywhere = (server: ViteDevServer, ids: Iterable<string>): void => {
  for (const environment of Object.values(server.environments)) {
    for (const id of ids) {
      const module = environment.moduleGraph.getModuleById(id);
      if (module !== undefined) environment.moduleGraph.invalidateModule(module);
    }
  }
};

/**
 * The page a request names, when it names one: `/` is the shell's.
 *
 * @param url - the request's address.
 */
const requestedPage = (url: string): PageFile | undefined => {
  const path = url.split("?")[0] ?? "";
  const name = path === "/" ? "index.html" : path.replace(/^\//, "");
  return PAGE_FILES.find((page) => page === name);
};

/**
 * A docs pages' module, when the id is a pattern's, a page's or the written home's. The Markdown reader loads with the
 * first: a catalogue may have no docs pages, and a story's page reads none.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param isServing - whether a dev server runs.
 * @param plugins - the catalogue's plugins, whose fences a page may draw.
 */
const docsModuleOf = async (
  id: string,
  watch: (file: string) => void,
  isServing: boolean,
  plugins: ResolvedConfig["plugins"]
): Promise<{ code: string; moduleType: "js" } | undefined> => {
  const isHome = id.endsWith(HOME_QUERY);
  const isPage = id.endsWith(DOCS_PAGE_QUERY);
  if (!isHome && !isPage && !id.startsWith(DOCS_PAGES_PREFIX)) return undefined;
  const { docPageModule, docPagesModule, homeModule } = await import("./docPagesModule.ts");
  if (isHome)
    return { code: homeModule(id.slice(0, -HOME_QUERY.length), watch, isServing, plugins), moduleType: "js" };
  if (isPage) {
    const file = id.slice(0, -DOCS_PAGE_QUERY.length);
    return { code: docPageModule(file, watch, isServing, plugins), moduleType: "js" };
  }
  const { root, pattern } = storyFilesGroupOf(id.slice(DOCS_PAGES_PREFIX.length));
  return { code: docPagesModule(root, pattern, watch, isServing, plugins), moduleType: "js" };
};

/**
 * A module the plugin generates for a catalogue's pages, when the id names one: an entry, the project's own stories'
 * source, or a page's HTML (unless the folder has one of its own). The configuration's data waits for the frames'
 * placement, so the plugin's `load` makes it.
 *
 * @param id - the module's id.
 * @param config - the catalogue's configuration.
 * @param command - whether a dev server runs, or a build: where the frame finds axe's script.
 */
const generatedModule = (
  id: string,
  config: ResolvedConfig,
  command: ConfigEnv["command"]
): { code: string; moduleType: "js" } | string | undefined => {
  const named = pageModuleOf(id, config.dir);
  if (named === undefined) return undefined;
  if (named.kind === "entry") {
    const code =
      named.page === "index.html" ? shellEntry(config) : frameEntry(config, axeAddress(command, PACKAGE_DIR));
    return { code, moduleType: "js" };
  }
  if (named.kind === "stories-source") return { code: storiesSourceModule(config), moduleType: "js" };
  if (named.kind === "agent-sources") return { code: agentSourcesModule(config), moduleType: "js" };
  return existsSync(id) ? undefined : pageHtml(named.page, config, builtPlacement(config.frames));
};

/**
 * The id of a module the plugin generates for a catalogue's pages, when an import names one: a page or an entry by
 * its address (`/index.html`, `/.forgebook-shell.ts`) or by its path, a source by its path.
 *
 * @param source - the import's specifier.
 * @param dir - the configuration's folder.
 */
const generatedId = (source: string, dir: string): string | undefined => {
  const byAddress = PAGE_FILES.find((page) => source === `/${PAGE_ENTRIES[page]}`);
  if (byAddress !== undefined) return pageModulePath(dir, PAGE_ENTRIES[byAddress]);
  const pageByAddress = PAGE_FILES.find((page) => source === `/${page}`);
  if (pageByAddress !== undefined) return pageModulePath(dir, pageByAddress);
  return pageModuleOf(source, dir) === undefined ? undefined : VITE_PATHS.normalize(source);
};

/**
 * The catalogue's Vite plugin: the story index, the docs, the code and the Markdown of the stories, the forced-states
 * rewrite of every style sheet and, with a configuration, the catalogue's two pages.
 *
 * @param options - the configuration (read from Vite's root when not given), or the framework alone, and the folders
 * to watch.
 * @returns the plugin, for the app's `plugins`.
 */
export const forgebookPlugin = (options: ForgebookPluginOptions = {}): Plugin => {
  /** The modules of the patterns, renewed when a story file is added or removed. */
  const filesModules = new Set<string>();
  // what each pattern's module was served with: an edit of a story file that changes its list reloads the pages
  const served = servedPatterns();
  /** The groups' "Used in" modules, renewed when a source file changes: any edit may change what reaches what. */
  const usageModules = new Set<string>();
  /** The docs pages' modules, renewed when a Markdown file is added or removed. */
  const docsModules = new Set<string>();
  /** The groups' search indexes: any edit may change what a component's docs say. */
  const searchModules = new Set<string>();
  /** The errors the open frames report, for `forgebook errors` and the agents. */
  const live = createLiveErrors();
  /** Where the frames run: the dev server's second port once it listens, the configuration's choice in a build. */
  let framesPlacement = async (): Promise<FramesPlacement> =>
    config === undefined ? SAME_ORIGIN : builtPlacement(config.frames);
  let config = options.config;
  /**
   * A module the plugin generates for the catalogue's pages: the configuration's data, once the frames are placed, or
   * one `generatedModule` makes; none without a configuration or for another id.
   *
   * @param id - the module's id.
   */
  const pagesModule = async (
    id: string
  ): Promise<{ code: string; moduleType: "js" } | string | undefined> => {
    if (config === undefined) return undefined;
    if (id === CONFIG_ID) return { code: configModule(config, await framesPlacement()), moduleType: "js" };
    return generatedModule(id, config, command);
  };
  /** The dev server; none in a build. */
  let devServer: ViteDevServer | undefined;
  /** The files followed one by one, so an edit reaches the dev server at once. */
  const watching = currentCloseWatch();
  /** Whether a dev server runs, or a build: tools ask only the former. */
  let command: ConfigEnv["command"] = "serve";
  const isServing = (): boolean => command === "serve";
  // the search's indexes, a build reading each component's docs once for its page and its index
  const search = searchIndexes({
    extract: (storyFile: string) => extractor().extract(storyFile),
    isServing,
    track: (id: string, isPages: boolean) => (isPages ? docsModules : searchModules).add(id)
  });
  // whether an edited story file is drawn anew in its open frames: a dev server's, unless the framework cannot
  const isRedrawing = (): boolean =>
    isServing() && (config?.framework ?? options.framework)?.redrawsEditedStories !== false;
  /**
   * Whether the server runs tests (Vitest's mode): no person waits for a page, so no docs program is warmed. A worker
   * still loading TypeScript when the tests end is stopped by Node mid-parse, which aborts the process.
   */
  let isTestRun = false;
  /** Where answers are kept between starts (`diskCache.ts`): in Vite's cache folder, so what clears it clears them. */
  let cacheFolder: string | undefined;
  /** The stamp of the plugin's own code, which makes the kept indexes and code: another version is a miss. */
  let pluginCode: string | undefined;
  const keptCache = <TValue>(
    kind: string,
    isValue: (value: unknown) => value is TValue & {}
  ): DiskCache<TValue> | undefined => {
    if (cacheFolder === undefined) return undefined;
    // the plugin's own folder holds the code that makes them, with the parser and the highlighter it reads with: an
    // edit or another version of any is a miss; a stamp that cannot be read keeps nothing
    try {
      const resolvePackage = packageResolver(PACKAGE_DIR);
      const tools = ["vite", "typescript-6", "highlight.js"].flatMap((name) => resolvePackage(name) ?? []);
      pluginCode ??= codeStamp([PACKAGE_DIR], tools);
    } catch {
      return undefined;
    }
    return diskCache(join(cacheFolder, kind), pluginCode, isValue);
  };
  const indexCache = (): DiskCache<KeptIndex> | undefined => keptCache("index", isKeptIndex);
  // the docs are read in a worker, made once the framework is known: a package's TypeScript program takes seconds to
  // build and would hold every other answer of the dev server meanwhile
  let docs: DocsExtractor | undefined;
  const extractor = (): DocsExtractor => {
    const framework = config?.framework ?? options.framework;
    if (framework === undefined)
      throw new Error("Forgebook has no framework: add forgebook.config.ts, or give the plugin `framework`");
    // a build reads every story's docs, a dev server one component at a time
    docs ??= createDocsExtractor(framework.docsModule, {
      readsEverything: !isServing(),
      ...(cacheFolder === undefined ? {} : { cacheFolder })
    });
    return docs;
  };
  /**
   * Renews what an edited source file may change: the docs' programs, and every group's "Used in" and search index.
   *
   * @param server - the dev server.
   * @param file - the edited file.
   */
  const renewOnChange = (server: ViteDevServer, file: string): void => {
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    if (!SOURCE_FILE.test(file) && componentFiles?.extension !== extname(file)) return;
    docs?.changed();
    invalidateEverywhere(server, [...usageModules, ...searchModules]);
  };
  /**
   * A pattern's module, or a group's "Used in" or reach module, when the id is one.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @param pack - writes a module's JSON as its value: as it is, or kept out of a build's JavaScript.
   * @param writeTexts - a build's: writes a pattern's docs, code and pages as data; none imports each.
   * @throws when a story file cannot be indexed.
   */
  const storiesModule = async (
    id: string,
    watch: (file: string) => void,
    pack: PackJson,
    writeTexts: ((files: readonly IndexedStoryFile[]) => Promise<BuiltTexts>) | undefined
  ): Promise<{ code: string; moduleType: "js" } | undefined> => {
    if (id.startsWith(USAGE_ID_PREFIX)) {
      usageModules.add(id);
      return usageModule(id, watch, extractor().usage, indexCache(), pack);
    }
    // what each story reaches is for the dev server's tools only: a build ships none of it
    if (id.startsWith(REACH_ID_PREFIX)) {
      usageModules.add(id);
      return isServing()
        ? reachModule(id, watch, extractor().usage, indexCache())
        : { code: "export default [];", moduleType: "js" };
    }
    if (!id.startsWith(FILES_PREFIX)) return undefined;
    filesModules.add(id);
    const hasUsage = config?.lists.usedIn !== false;
    // the worker starts while Vite loads the pages, unless the disk keeps the docs; a test run asks for no page
    const { files, code } = await patternModule(
      id,
      watch,
      { hasUsage, hasReach: hasUsage && isServing() },
      indexCache(),
      isTestRun ? undefined : extractor().warm,
      writeTexts
    );
    if (!isRedrawing()) return { code, moduleType: "js" };
    served.keep(id, files);
    return { code: `${code}\n${FILES_MODULE_HOT}`, moduleType: "js" };
  };
  /**
   * Tells the docs a source file was added or removed: it may be what an import now finds, so no kept docs are read
   * again this session.
   *
   * @param file - the file.
   */
  const noteListing = (file: string): void => {
    const framework = config?.framework ?? options.framework;
    if (framework === undefined) return;
    if (SOURCE_FILE.test(file) || framework.componentFiles?.extension === extname(file)) extractor().listed();
  };
  /**
   * The modules a file added or removed changes; none when it changes no list.
   *
   * @param file - the file.
   */
  const modulesListing = (file: string): readonly string[] | undefined => {
    // the patterns' modules list the story files; the groups' "Used in" read them
    if (STORY_FILE.test(file)) return [...filesModules, ...usageModules, ...searchModules];
    return DOCS_PAGE_FILE.test(file) && docsModules.size > 0 ? [...docsModules] : undefined;
  };
  /**
   * A module a story file's query asks for (`?forgebook-docs`, `-code`, `-page`, `-markdown`), when the id is one.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @param resolveImport - resolves an import of a file as the app resolves it.
   */
  const queryModule = async (
    id: string,
    watch: (file: string) => void,
    resolveImport: (specifier: string, importer: string) => Promise<string | undefined>
  ): Promise<{ code: string; moduleType: "js" } | undefined> => {
    if (id === TOKENS_ID && config !== undefined) {
      // a source's tokens are found from its module, imported as the generated pages import it
      const importer = pageModulePath(config.dir, AGENT_SOURCES_FILE);
      return tokensModule(config, watch, (specifier: string) => resolveImport(specifier, importer));
    }
    if (id.endsWith(DOCS_QUERY)) {
      return docsModule(await search.docsOf(id.slice(0, -DOCS_QUERY.length)), watch);
    }
    if (id.startsWith(DOCS_PAGES_PREFIX)) docsModules.add(id);
    const docsPages = await docsModuleOf(id, watch, isServing(), config?.plugins ?? []);
    if (docsPages !== undefined) return docsPages;
    if (!TEXT_QUERIES.some((query) => id.endsWith(query))) return undefined;
    // loaded on the first of these queries: the highlighter, the Markdown reader and what they need stay out of a
    // server whose pages never ask
    const { isKeptCode, textModule } = await import("./textModules.ts");
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    return textModule(id, { watch, resolveImport, componentFiles, cache: keptCache("code", isKeptCode) });
  };
  /**
   * A group's module (a pattern's, its search index, its "Used in"), when the id names one.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @param resolveImport - resolves an import of a file as the app resolves it.
   * @param emit - a build's browser files': writes a packed file; none keeps the JSON in the modules.
   * @throws when a story file cannot be indexed.
   */
  const groupModule = async (
    id: string,
    watch: (file: string) => void,
    resolveImport: (specifier: string, importer: string) => Promise<string | undefined>,
    emit: EmitAsset | undefined
  ): Promise<{ code: string; moduleType: "js" } | null> => {
    const pack = emit === undefined ? inlineJson : packedJsonOf(emit);
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    const docsOf = async (storyFile: string): Promise<unknown> =>
      docsValue(await search.docsOf(storyFile), watch);
    const writeTexts =
      emit === undefined ? undefined : textsWriter({ docsOf, watch, resolveImport, componentFiles }, emit);
    return (
      (await search.moduleOf(id, watch, pack)) ?? (await storiesModule(id, watch, pack, writeTexts)) ?? null
    );
  };
  return {
    name: "forgebook",
    enforce: "pre",
    config: async (userConfig: UserConfig, environment: ConfigEnv): Promise<UserConfig> => {
      command = environment.command;
      isTestRun = environment.mode === "test";
      if (config === undefined && options.framework === undefined) {
        const file = findConfigFile(resolve(userConfig.root ?? process.cwd()));
        if (file !== undefined) config = await loadConfigFile(file);
      }
      const pages = config === undefined ? {} : catalogueConfig(config, userConfig);
      return {
        ...pages,
        css: {
          transformer: "lightningcss",
          lightningcss: { visitor: FORCED_STATES_VISITOR },
          ...(await sassOptions())
        }
      };
    },
    resolveId(source: string, importer: string | undefined): string | null {
      const virtual = virtualId(source);
      if (virtual !== undefined) return virtual;
      const generated = config === undefined ? undefined : generatedId(source, config.dir);
      if (generated !== undefined) return generated;
      return importer === undefined ? null : patternId(source, VITE_PATHS.dirname(importer));
    },
    // a warning and not a failure: a theme a reader can still use must not stop a catalogue from building
    configResolved: (resolved: { readonly logger: Logger; readonly cacheDir: string }): void => {
      // a dev server's answers only: a build reads everything once, and stamping each answer's files costs it more than
      // a later build would save
      if (isServing()) cacheFolder = join(resolved.cacheDir, "forgebook");
      for (const problem of config?.shell.problems ?? [])
        resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
    },
    configureServer: (server: ViteDevServer): void => {
      devServer = server;
      // no person waits for a page in a test run
      watching.serve(isTestRun ? undefined : server);
      server.httpServer?.on("close", (): void => void docs?.close());
      // first: the frames' own origin, and the guard that keeps every other origin's page from reading this one
      if (config !== undefined)
        serveFrames(server, config, (placement) => (framesPlacement = placement), FRAMED_AGENT_PAGES);
      // an edited component or type file changes its docs: the worker renews its programs on their next read
      server.watcher.on("change", (file: string): void => renewOnChange(server, file));
      // the answers to tools and agents (`forgebook stories`, `forgebook mcp`), from the same sources as the pages
      if (config !== undefined)
        server.middlewares.use(agentMiddleware(server, config, live, () => framesPlacement()));
      if (config?.heights !== undefined) {
        const file = {
          heights: config.heights,
          base: server.config.base,
          publicDir: server.config.publicDir
        };
        server.middlewares.use(missingHeightsMiddleware(file));
      }
      server.ws.on(LIVE_ERROR_EVENT, (report: unknown): void => {
        if (isLiveErrorReport(report)) live.add(report, new Date());
      });
      // the catalogue's pages, made here: no HTML file is written
      server.middlewares.use((request, response, next): void => {
        const page = requestedPage(request.url ?? "/");
        const served = config;
        if (served === undefined || page === undefined) {
          next();
          return;
        }
        framesPlacement()
          .then((placement) =>
            server.transformIndexHtml(request.url ?? "/", pageHtml(page, served, placement))
          )
          .then((html: string): void => {
            response.setHeader("Content-Type", "text/html");
            response.end(html);
          })
          .catch(next);
      });
      // folders outside the configuration's are watched only when named; a story file added or removed anywhere the
      // server watches (its own folder, a story file it loaded) renews the lists either way
      const watched = [...(config?.watch ?? []), ...(options.watch ?? [])];
      if (watched.length > 0) server.watcher.add(watched);
      const refresh = (file: string): void => {
        noteListing(file);
        const renewed = modulesListing(file);
        if (renewed === undefined) return;
        invalidateEverywhere(server, renewed);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
    generateBundle(): void {
      // axe's script, for the frames' Accessibility card: loaded by the frame, never imported; the browser's build only
      if (this.environment.name !== "client") return;
      const axe = config === undefined ? undefined : axeBuildAsset(PACKAGE_DIR);
      if (axe !== undefined) this.emitFile({ type: "asset", fileName: axe.fileName, source: axe.source });
    },
    // a dev server without an HTTP server of its own (middleware mode) ends its close watch here only
    closeServer: (context: { readonly reason: "restart" | "close" }): void => {
      if (context.reason === "close") watching.close();
    },
    closeBundle: async (): Promise<void> => {
      await docs?.close();
    },
    ...storyFileHotHooks(isRedrawing, served.changedBy, watching),
    async load(id: string): Promise<{ code: string; moduleType: "js" } | string | null> {
      const generated = await pagesModule(id);
      if (generated !== undefined) return generated;
      // an answer, not an error: an error would raise Vite's overlay on every reader's open page
      if (!isReadable(id, devServer)) return { code: "export default null;", moduleType: "js" };
      // in Vite's form, the text Vite's module graph knows a file by: a Node path on Windows (`C:\app\x.md`) is another
      const watch = (file: string): void => this.addWatchFile(VITE_PATHS.normalize(file));
      const resolveImport = async (specifier: string, importer: string): Promise<string | undefined> => {
        const resolved = await this.resolve(specifier, importer);
        return resolved?.id;
      };
      const answered = await queryModule(id, watch, resolveImport);
      if (answered !== undefined) return renewedModule(id, answered, RENEWED_QUERIES, isServing());
      // a build's browser files only: a server environment's output is no page's to fetch
      const emit =
        isServing() || this.environment.name !== "client"
          ? undefined
          : (asset: Parameters<EmitAsset>[0]): unknown => this.emitFile(asset);
      try {
        return await groupModule(id, watch, resolveImport, emit);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    }
  };
};
