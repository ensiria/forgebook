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
 * come the same way, with `?forgebook-docs-pages` (`docPagesModule.ts`). It also sets Lightning CSS as the CSS transformer with the forced-states visitor (`forcedStates.ts`) and lets Sass resolve
 * `pkg:` URLs, which the library's style sheets use.
 *
 * A pattern's module watches its story files, so an edit renews it. Vite watches only its root for new files, and the
 * sources' story files live in other packages: `watch` names their folders, and a story file added or removed there
 * renews every pattern's module and reloads the page, so the sidebar lists it at once.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import {
  type ConfigEnv,
  isFileLoadingAllowed,
  type Logger,
  type Plugin,
  type UserConfig,
  type ViteDevServer
} from "vite";

import { createLiveErrors, isLiveErrorReport, LIVE_ERROR_EVENT } from "../liveErrors.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { agentMiddleware } from "./agentRoutes.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { axeAddress, axeBuildAsset } from "./axeScript.ts";
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { type DiskCache, diskCache } from "./diskCache.ts";
import { createDocsExtractor, type DocsExtractor, type DocsResult } from "./docsExtractor.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { missingHeightsMiddleware } from "./heightsRoute.ts";
import { FILES_MODULE_HOT, renewedModule, storyFileHotHooks } from "./hotSnippets.ts";
import { inlineJson, type PackJson, packedJsonOf } from "./packedModule.ts";
import {
  agentSourcesModule,
  CONFIG_MODULE,
  configModule,
  frameEntry,
  PAGE_ENTRIES,
  PAGE_FILES,
  type PageFile,
  pageHtml,
  pageModuleOf,
  pageModulePath,
  shellEntry,
  storiesSourceModule,
  TOKENS_MODULE
} from "./pages.ts";
import { pluginFences } from "./pluginConfig.ts";
import {
  DOCS_PAGES_PREFIX,
  docsModule,
  docsModuleOf,
  FILES_PREFIX,
  patternModule,
  USAGE_ID_PREFIX,
  usageModule
} from "./pluginModules.ts";
import { prebundled, scannedEntries } from "./prebundled.ts";
import {
  type KeptIndex,
  SEARCH_PREFIX,
  storyFileIndex,
  storyFilesGroupOf,
  storyFilesGroupText,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { tokensModule } from "./storylessRoutes.ts";
import {
  CODE_QUERY,
  DOCS_PAGE_QUERY,
  MARKDOWN_QUERY,
  PAGE_QUERY,
  PAGES_SEARCH_PREFIX
} from "./textQueries.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/**
 * A file's text, or none when it cannot be read.
 *
 * @param file - the file.
 */
const readTextFile = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

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

/** What made a kept index: this package's build, so a new version reads the files again. */
const INDEX_STAMP = String(statSync(new URL(import.meta.url)).mtimeMs);

/** Whether what a cache file holds is a pattern's index. */
const isKeptIndex = (value: unknown): value is KeptIndex => typeof value === "object" && value !== null;

/** The query that asks for the story files a pattern matches (`../src/**\/*.stories.tsx?forgebook-files`). */
const FILES_QUERY = "?forgebook-files";

/** The query that asks for the docs pages a pattern matches (`./docs/*.md?forgebook-docs-pages`). */
const DOCS_PAGES_QUERY = "?forgebook-docs-pages";

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
const FILE_QUERIES: readonly string[] = [DOCS_QUERY, CODE_QUERY, PAGE_QUERY, MARKDOWN_QUERY, DOCS_PAGE_QUERY];

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
 * The id of a `?forgebook-files` module: its prefix, then its group (`storyFilesGroupText`), which holds no `..`.
 *
 * @param folder - the importing module's folder.
 * @param pattern - the pattern as the import writes it.
 */
const filesId = (folder: string, pattern: string): string =>
  `${FILES_PREFIX}${storyFilesGroupText(folder, pattern)}`;

/**
 * The id of a pattern's module, when an import asks for one: its story files, or its docs pages.
 *
 * @param source - the import's specifier.
 * @param folder - the importing module's folder.
 */
const patternId = (source: string, folder: string): string | null => {
  if (source.endsWith(FILES_QUERY)) return filesId(folder, source.slice(0, -FILES_QUERY.length));
  if (!source.endsWith(DOCS_PAGES_QUERY)) return null;
  const pattern = source.slice(0, -DOCS_PAGES_QUERY.length);
  return `${DOCS_PAGES_PREFIX}${storyFilesGroupText(folder, pattern)}`;
};

/** The resolved id of a group of story files' search index. */
const SEARCH_ID_PREFIX = `\0${SEARCH_PREFIX}`;

/** The resolved id of a group of docs pages' search index. */
const PAGES_SEARCH_ID_PREFIX = `\0${PAGES_SEARCH_PREFIX}`;

/**
 * The id of a virtual module the plugin makes (the configuration's data, a group's "Used in" or search index), when the
 * import names one.
 *
 * @param source - the import's specifier.
 */
const virtualId = (source: string): string | undefined => {
  if (source === CONFIG_MODULE) return CONFIG_ID;
  if (source === TOKENS_MODULE) return TOKENS_ID;
  return [USAGE_PREFIX, SEARCH_PREFIX, PAGES_SEARCH_PREFIX].some((prefix) => source.startsWith(prefix))
    ? `\0${source}`
    : undefined;
};

/** The resolved id of the configuration's data module. */
const CONFIG_ID = `\0${CONFIG_MODULE}`;

/** The resolved id of the design tokens' module. */
const TOKENS_ID = `\0${TOKENS_MODULE}`;

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
 * A module the plugin generates for a catalogue's pages, when the id names one: the configuration's data, an entry,
 * the project's own stories' source, or a page's HTML (unless the folder has one of its own).
 *
 * @param id - the module's id.
 * @param config - the catalogue's configuration.
 * @param command - whether a dev server runs, or a build.
 */
const generatedModule = (
  id: string,
  config: ResolvedConfig,
  command: ConfigEnv["command"]
): { code: string; moduleType: "js" } | string | undefined => {
  if (id === CONFIG_ID) return { code: configModule(config), moduleType: "js" };
  const named = pageModuleOf(id, config.dir);
  if (named === undefined) return undefined;
  if (named.kind === "entry") {
    const code =
      named.page === "index.html" ? shellEntry(config) : frameEntry(config, axeAddress(command, PACKAGE_DIR));
    return { code, moduleType: "js" };
  }
  if (named.kind === "stories-source") return { code: storiesSourceModule(config), moduleType: "js" };
  if (named.kind === "agent-sources") return { code: agentSourcesModule(config), moduleType: "js" };
  return existsSync(id) ? undefined : pageHtml(named.page, config);
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
  /** Each pattern's story files, by path, with the index its module was served with: an edit changing one reloads. */
  const servedFiles = new Map<
    string,
    ReadonlyMap<string, { readonly key: string; readonly index: string }>
  >();
  /** The groups' "Used in" modules, renewed when a source file changes: any edit may change what reaches what. */
  const usageModules = new Set<string>();
  /** The docs pages' modules, renewed when a Markdown file is added or removed. */
  const docsModules = new Set<string>();
  /** The groups' search indexes: any edit may change what a component's docs say. */
  const searchModules = new Set<string>();
  /** A build's component docs, by story file: the page's module and the search index both read them, once. */
  const builtDocs = new Map<string, Promise<DocsResult>>();
  /** The errors the open frames report, for `forgebook errors` and the agents. */
  const live = createLiveErrors();
  let config = options.config;
  /** The dev server; none in a build. */
  let devServer: ViteDevServer | undefined;
  /** Whether a dev server runs, or a build: tools ask only the former. */
  let command: ConfigEnv["command"] = "serve";
  const isServing = (): boolean => command === "serve";
  // the docs are read in a worker, made once the framework is known: a package's TypeScript program takes seconds to
  // build and would hold every other answer of the dev server meanwhile
  let docs: DocsExtractor | undefined;
  /** Where the answers worth keeping between starts live: inside Vite's cache folder, once Vite has resolved it. */
  let cacheFolder: string | undefined;
  const indexCache = (): DiskCache<KeptIndex> | undefined =>
    cacheFolder === undefined ? undefined : diskCache(join(cacheFolder, "index"), INDEX_STAMP, isKeptIndex);
  const extractor = (): DocsExtractor => {
    const framework = config?.framework ?? options.framework;
    if (framework === undefined)
      throw new Error("Forgebook has no framework: add forgebook.config.ts, or give the plugin `framework`");
    docs ??= createDocsExtractor(framework.docsModule, { cacheFolder, readsEverything: !isServing() });
    return docs;
  };
  /**
   * A story file's component docs: a dev server reads them again each time, as they change while it runs.
   *
   * @param storyFile - the story file.
   */
  const docsOf = (storyFile: string): Promise<DocsResult> => {
    if (isServing()) return extractor().extract(storyFile);
    const read = builtDocs.get(storyFile) ?? extractor().extract(storyFile);
    builtDocs.set(storyFile, read);
    return read;
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
    const graph = server.environments.client.moduleGraph;
    for (const id of [...usageModules, ...searchModules]) {
      const module = graph.getModuleById(id);
      if (module !== undefined) graph.invalidateModule(module);
    }
  };
  /**
   * A pattern's module or a group's "Used in" module or search index, when the id is one.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @param resolveSource - finds the file of a source's module.
   * @param pack - writes a module's JSON as its value.
   * @throws when a story file cannot be indexed.
   */
  const storiesModule = async (
    id: string,
    watch: (file: string) => void,
    resolveSource: (specifier: string) => Promise<string | undefined>,
    pack: PackJson
  ): Promise<{ code: string; moduleType: "js" } | undefined> => {
    if (id === TOKENS_ID && config !== undefined) return tokensModule(config, watch, resolveSource);
    if (id.startsWith(USAGE_ID_PREFIX)) {
      usageModules.add(id);
      return usageModule(id, watch, extractor().usage, isServing(), pack);
    }
    if (id.startsWith(SEARCH_ID_PREFIX)) {
      searchModules.add(id);
      const { root, pattern } = storyFilesGroupOf(id.slice(SEARCH_ID_PREFIX.length));
      const { storySearchModule } = await import("./searchModule.ts");
      return {
        code: await storySearchModule(root, pattern, watch, docsOf, isServing(), pack),
        moduleType: "js"
      };
    }
    if (id.startsWith(PAGES_SEARCH_ID_PREFIX)) {
      docsModules.add(id);
      const { root, pattern } = storyFilesGroupOf(id.slice(PAGES_SEARCH_ID_PREFIX.length));
      const { pagesSearchModule } = await import("./searchModule.ts");
      return { code: pagesSearchModule(root, pattern, watch, pack), moduleType: "js" };
    }
    if (!id.startsWith(FILES_PREFIX)) return undefined;
    filesModules.add(id);
    const { files, ...module } = filesModule(id, watch);
    if (!isServing()) return module;
    servedFiles.set(
      id,
      new Map(files.map((file) => [file.file, { key: file.key, index: JSON.stringify(file.index) }]))
    );
    return { ...module, code: `${module.code}\n${FILES_MODULE_HOT}` };
  };
  /**
   * A pattern's module.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   */
  const filesModule = (id: string, watch: (file: string) => void): ReturnType<typeof patternModule> =>
    patternModule(id, watch, config?.lists.usedIn !== false, indexCache(), isServing());
  /**
   * The patterns' modules an edit of a story file changed (a story added or renamed, a title), which the open pages
   * read once: the file alone is indexed again. One that cannot be read yet (an edit half typed) changes nothing: its
   * module shows the error, and the next edit is read again.
   *
   * @param file - the edited story file.
   */
  const changedFilesModules = (file: string): readonly string[] =>
    [...servedFiles]
      .filter(([id, served]) => {
        const kept = served.get(file);
        if (kept === undefined) return false;
        const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
        const index = storyFileIndex(root, pattern, kept.key);
        return typeof index !== "string" && JSON.stringify(index) !== kept.index;
      })
      .map(([id]) => id);
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
  const packFor = (context: { readonly emitFile: Parameters<typeof packedJsonOf>[0] }): PackJson =>
    isServing() ? inlineJson : packedJsonOf((asset) => context.emitFile(asset));
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
    if (id.endsWith(DOCS_QUERY)) {
      return docsModule(await docsOf(id.slice(0, -DOCS_QUERY.length)), watch);
    }
    if (TEXT_QUERIES.some((query) => id.endsWith(query))) {
      // imported here: the highlighter and the TypeScript compiler it splits code with are the server's heaviest
      // modules, and a story's page never asks for one of these
      const { textModule } = await import("./textModules.ts");
      return textModule(
        id,
        watch,
        resolveImport,
        cacheFolder,
        (config?.framework ?? options.framework)?.componentFiles
      );
    }
    if (id.startsWith(DOCS_PAGES_PREFIX)) docsModules.add(id);
    return docsModuleOf(id, watch, isServing(), pluginFences(config?.plugins ?? []));
  };
  return {
    name: "forgebook",
    enforce: "pre",
    config: async (userConfig: UserConfig, environment: ConfigEnv): Promise<UserConfig> => {
      command = environment.command;
      if (config === undefined && options.framework === undefined) {
        const file = findConfigFile(resolve(userConfig.root ?? process.cwd()));
        if (file !== undefined) config = await loadConfigFile(file);
      }
      const pages =
        config === undefined
          ? {}
          : {
              root: config.dir,
              // the pages are generated, so Vite's scanner cannot find what they import: it is named here, and the
              // story files (the project's and the sources') are scanned for what their components import
              optimizeDeps: {
                include: prebundled(config, packageResolver(config.dir)),
                entries: scannedEntries(config, packageResolver(config.dir), readTextFile)
              },
              build: {
                rolldownOptions: {
                  input: {
                    index: pageModulePath(config.dir, "index.html"),
                    frame: pageModulePath(config.dir, "frame.html")
                  },
                  // a catalogue names each file several times over, once per loader: a name of its hash alone is a
                  // tenth of what the index weighs; a catalogue whose builds are read by name keeps Vite's names
                  ...(config.build.readableNames ? {} : { output: { chunkFileNames: "assets/[hash].js" } })
                }
              }
            };
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
      cacheFolder = join(resolved.cacheDir, "forgebook");
      for (const problem of config?.shell.problems ?? [])
        resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
    },
    configureServer: (server: ViteDevServer): void => {
      devServer = server;
      server.httpServer?.on("close", (): void => void docs?.close());
      // an edited component or type file changes its docs: the worker renews its programs on their next read
      server.watcher.on("change", (file: string): void => renewOnChange(server, file));
      // the answers to tools and agents (`forgebook stories`, `forgebook mcp`), from the same sources as the pages
      if (config !== undefined) server.middlewares.use(agentMiddleware(server, config, live));
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
        if (config === undefined || page === undefined) {
          next();
          return;
        }
        server
          .transformIndexHtml(request.url ?? "/", pageHtml(page, config))
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
        // a source added or removed changes what an import resolves to
        renewOnChange(server, file);
        const renewed = modulesListing(file);
        if (renewed === undefined) return;
        const graph = server.environments.client.moduleGraph;
        for (const id of renewed) {
          const module = graph.getModuleById(id);
          if (module !== undefined) graph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
    generateBundle(): void {
      const file = config === undefined ? undefined : axeBuildAsset(PACKAGE_DIR);
      if (file !== undefined) this.emitFile({ type: "asset", ...file });
    },
    closeBundle: async (): Promise<void> => {
      await docs?.close();
    },
    ...storyFileHotHooks(isServing, changedFilesModules),
    async load(id: string): Promise<{ code: string; moduleType: "js" } | string | null> {
      const generated = config === undefined ? undefined : generatedModule(id, config, command);
      if (generated !== undefined) return generated;
      // an answer, not an error: an error would raise Vite's overlay on every reader's open page
      if (!isReadable(id, devServer)) return { code: "export default null;", moduleType: "js" };
      // in Vite's form, the text Vite's module graph knows a file by: a Node path on Windows (`C:\app\x.md`) is another
      const watch = (file: string): void => this.addWatchFile(VITE_PATHS.normalize(file));
      const answered = await queryModule(id, watch, async (specifier: string, importer: string) => {
        const resolved = await this.resolve(specifier, importer);
        return resolved?.id;
      });
      if (answered !== undefined) return renewedModule(id, answered, RENEWED_QUERIES, isServing());
      try {
        const resolveSource = async (specifier: string): Promise<string | undefined> =>
          (await this.resolve(specifier))?.id;
        return (await storiesModule(id, watch, resolveSource, packFor(this))) ?? null;
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    }
  };
};
