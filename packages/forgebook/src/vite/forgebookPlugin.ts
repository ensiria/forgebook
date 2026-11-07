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
 * A group's module watches its story files, so an edit renews it. Vite watches only its root for new files, and the
 * sources' story files live in other packages: `watch` names their folders, and a story file added or removed there
 * renews the modules of the groups whose list it changes and reloads the page, so the sidebar lists it at once; one no
 * group lists (a `!` pattern leaves it out) reloads nothing.
 *
 * @module
 */
import { extname, join, resolve } from "node:path";

import type { ConfigEnv, Plugin, UserConfig, ViteDevServer } from "vite";

import { checksA11y, offersUsedIn, readsComponentDocs } from "../catalogue.ts";
import { type FramesPlacement, SAME_ORIGIN } from "../frameOrigins.ts";
import { createLiveErrors } from "../liveErrors.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { agentMiddleware, FRAMED_AGENT_PAGES } from "./agentRoutes.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { axeBuildAsset } from "./axeScript.ts";
import { groupTexts, type TextSources } from "./builtTexts.ts";
import { catalogueConfig } from "./catalogueConfig.ts";
import { currentCloseWatch } from "./closeWatch.ts";
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { codeStamp, type DiskCache, diskCache } from "./diskCache.ts";
import { createDocsExtractor, type DocsExtractor, NO_DOCS_EXTRACTOR } from "./docsExtractor.ts";
import { sayEmptyStoryGlobs } from "./emptyStoryGlobs.ts";
import { devServerAccess, VITEST_HOOKS } from "./fileAccess.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { receiveFrameErrors } from "./frameErrors.ts";
import { builtPlacement } from "./framesConfig.ts";
import { serveFrames } from "./framesServer.ts";
import { generatedId, generatedModule } from "./generatedModules.ts";
import { missingHeightsMiddleware } from "./heightsRoute.ts";
import { filesModuleHot, renewedModule, servedPatterns, storyFileHotHooks } from "./hotSnippets.ts";
import { type EmitAsset, inlineJson, type PackJson, packedJsonOf } from "./packedModule.ts";
import {
  AGENT_SOURCES_FILE,
  configModule,
  PAGE_FILES,
  type PageFile,
  pageHtml,
  pageModulePath
} from "./pages.ts";
import { CONFIG_ID, DOCS_PAGES_PREFIX, patternId, TOKENS_ID, virtualId } from "./pluginIds.ts";
import {
  docsModule,
  docsValue,
  FILES_PREFIX,
  listingRenewals,
  patternModule,
  REACH_ID_PREFIX,
  reachModule,
  searchIndexes,
  USAGE_ID_PREFIX,
  usageModule
} from "./pluginModules.ts";
import { checkAtStart, type ResolvedVite } from "./runningVersions.ts";
import {
  type IndexedStoryFile,
  type IsFileKept,
  isKeptIndex,
  type KeptIndex,
  storyFilesGroupOf
} from "./storyFilesModule.ts";
import { tokensModule } from "./storylessRoutes.ts";
import { DOCS_PAGE_QUERY, DOCS_QUERY, HOME_QUERY, RENEWED_QUERIES, TEXT_QUERIES } from "./textQueries.ts";
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
 * @param isKept - whether a page its group lists may be read.
 */
const docsModuleOf = async (
  id: string,
  watch: (file: string) => void,
  isServing: boolean,
  plugins: ResolvedConfig["plugins"],
  isKept: IsFileKept
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
  const { root, patterns } = storyFilesGroupOf(id.slice(DOCS_PAGES_PREFIX.length));
  return { code: docPagesModule(root, patterns, watch, isServing, plugins, isKept), moduleType: "js" };
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
  /**
   * The modules of the groups of story files, with the files each listed when served (none while it could not be
   * made), renewed when a story file is added to or removed from what one lists.
   */
  const filesModules = new Map<string, ReadonlySet<string> | undefined>();
  // what each pattern's module was served with: an edit of a story file that changes its list reloads the pages
  const served = servedPatterns();
  /** The groups' "Used in" modules, renewed when a source file changes: any edit may change what reaches what. */
  const usageModules = new Set<string>();
  /** The docs pages' modules, renewed when a Markdown file is added or removed. */
  const docsModules = new Set<string>();
  /** The groups' search indexes: any edit may change what a component's docs say. */
  const searchModules = new Set<string>();
  /** What a client may read of a dev server. */
  const access = devServerAccess();
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
    if (id === CONFIG_ID)
      return { code: configModule(config, await framesPlacement(), isServing()), moduleType: "js" };
    return generatedModule(id, config, command);
  };
  /** The files followed one by one, so an edit reaches the dev server at once. */
  const watching = currentCloseWatch();
  /** Whether a dev server runs, or a build: tools ask only the former. */
  let command: ConfigEnv["command"] = "serve";
  const isServing = (): boolean => command === "serve";
  // the search's indexes, a build reading each component's docs once for its page and its index
  const search = searchIndexes({
    extract: (storyFile: string) => extractor().extract(storyFile),
    isServing,
    track: (id: string, isPages: boolean) => (isPages ? docsModules : searchModules).add(id),
    isKept: access.isKept
  });
  // a build's docs, code and pages of each group's story files, read while the build loads the stories
  const texts = groupTexts();
  // whether a story file that cannot be read is named while the rest draws: a build must fail on it, and a test run has
  // no page to name it on
  const isForgiving = (): boolean => isServing() && !isTestRun;
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
    // a catalogue that reads no component docs never starts the worker: its programs are most of the server's memory
    if (config !== undefined && !readsComponentDocs(config.lists)) return NO_DOCS_EXTRACTOR;
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
   * @param startTexts - a build's browser files': starts reading a pattern's docs, code and pages, which its module
   * imports from the group's texts module; none imports each from its query.
   * @throws when a story file cannot be indexed, and no person at a dev server is told instead (a build, a test run).
   */
  const storiesModule = async (
    id: string,
    watch: (file: string) => void,
    pack: PackJson,
    startTexts: ((files: readonly IndexedStoryFile[]) => void) | undefined
  ): Promise<{ code: string; moduleType: "js" } | undefined> => {
    if (id.startsWith(USAGE_ID_PREFIX)) {
      usageModules.add(id);
      return usageModule(id, watch, extractor().usage, indexCache(), pack, access.isKept);
    }
    // what each story reaches is for the dev server's tools only: a build ships none of it
    if (id.startsWith(REACH_ID_PREFIX)) {
      usageModules.add(id);
      return isServing()
        ? reachModule(id, watch, extractor().usage, indexCache(), access.isKept)
        : { code: "export default [];", moduleType: "js" };
    }
    if (!id.startsWith(FILES_PREFIX)) return undefined;
    filesModules.set(id, undefined);
    const lists = config?.lists ?? {};
    const hasUsage = offersUsedIn(lists);
    // the worker starts while Vite loads the pages, unless the disk keeps the docs; a test run asks for no page
    const { files, refused, code } = patternModule(
      id,
      watch,
      { hasDocs: readsComponentDocs(lists), hasUsage, hasReach: hasUsage && isServing() },
      indexCache(),
      isTestRun ? undefined : extractor().warm,
      startTexts,
      access.isKept,
      isForgiving(),
      config
    );
    filesModules.set(id, new Set([...files, ...refused].map((file) => file.file)));
    if (!isRedrawing()) return { code, moduleType: "js" };
    served.keep(id, { files, refused });
    return { code: `${code}\n${filesModuleHot(refused)}`, moduleType: "js" };
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
    // the groups' modules list the story files, their "Used in" and search indexes read them
    if (STORY_FILE.test(file))
      return listingRenewals(filesModules, file, [...usageModules, ...searchModules], access.isKept);
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
    const docsPages = await docsModuleOf(id, watch, isServing(), config?.plugins ?? [], access.isKept);
    if (docsPages !== undefined) return docsPages;
    if (!TEXT_QUERIES.some((query) => id.endsWith(query))) return undefined;
    // loaded on the first of these queries: the highlighter, the Markdown reader and what they need stay out of a
    // server whose pages never ask
    const { isKeptCode, textModule } = await import("./textModules.ts");
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    return textModule(id, { watch, resolveImport, componentFiles, cache: keptCache("code", isKeptCode) });
  };
  /**
   * A group's module (a pattern's, its search index, its "Used in", a build's texts), when the id names one.
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
    const hasDocs = config === undefined || readsComponentDocs(config.lists);
    const sources: TextSources = {
      docsOf: hasDocs ? docsOf : undefined,
      watch,
      resolveImport,
      componentFiles
    };
    // a build's browser files only: a dev server answers each text from its query, and no texts module
    const startTexts = emit === undefined ? undefined : texts.starter(id, sources);
    return (
      (emit === undefined ? undefined : await texts.moduleOf(id, sources, emit)) ??
      (await search.moduleOf(id, watch, pack)) ??
      (await storiesModule(id, watch, pack, startTexts)) ??
      null
    );
  };
  // whatever its mode: a run of Vitest has no page to name a file on, and must fail on it
  const vitestHooks = {
    configureVitest: (context: Parameters<typeof VITEST_HOOKS.configureVitest>[0]): void => {
      isTestRun = true;
      VITEST_HOOKS.configureVitest(context);
    }
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
      const isModule = access.isModule(importer);
      const virtual = virtualId(source);
      if (virtual !== undefined) {
        if (isModule) access.noteImported(virtual);
        return virtual;
      }
      const generated = config === undefined ? undefined : generatedId(source, config.dir);
      if (generated !== undefined) return generated;
      if (!access.isModule(importer)) return null;
      // the importer's file: its id may carry whatever query an address gave it
      const pattern = patternId(source, VITE_PATHS.dirname(importer.split("?")[0] ?? importer));
      if (pattern !== null) access.noteImported(pattern);
      return pattern;
    },
    configResolved: (resolved: ResolvedVite): void => {
      checkAtStart(resolved, config?.shell.problems ?? []);
      // a dev server's answers only: a build reads everything once, and stamping each answer's files costs it more than
      // a later build would save
      if (isServing()) cacheFolder = join(resolved.cacheDir, "forgebook");
      if (config !== undefined && !isTestRun) sayEmptyStoryGlobs(config, isServing(), resolved.logger);
    },
    configureServer: (server: ViteDevServer): void => {
      access.serve(server, config === undefined ? undefined : pageModulePath(config.dir, AGENT_SOURCES_FILE));
      server.middlewares.use((request, _response, next): void => {
        access.settle(request.url ?? "/").then(() => next(), next);
      });
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
      receiveFrameErrors(server, live);
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
      // server watches (its own folder, a story file it loaded) renews the lists that change either way
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
      // a catalogue that checks no accessibility ships none of it
      const axe = config === undefined || !checksA11y(config.lists) ? undefined : axeBuildAsset(PACKAGE_DIR);
      if (axe !== undefined) this.emitFile({ type: "asset", fileName: axe.fileName, source: axe.source });
    },
    // a dev server without an HTTP server of its own (middleware mode) ends its close watch here only
    closeServer: (context: { readonly reason: "restart" | "close" }): void => {
      if (context.reason === "close") watching.close();
    },
    closeBundle: async (): Promise<void> => {
      await docs?.close();
    },
    ...storyFileHotHooks(isRedrawing, served, watching),
    ...vitestHooks,
    async load(id: string): Promise<{ code: string; moduleType: "js" } | string | null> {
      const generated = await pagesModule(id);
      if (generated !== undefined) return generated;
      const refusal = access.refusal(id);
      if (refusal !== undefined) return refusal;
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
