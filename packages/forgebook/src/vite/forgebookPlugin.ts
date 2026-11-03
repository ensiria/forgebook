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
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

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
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { createDocsExtractor, type DocsExtractor } from "./docsExtractor.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { builtPlacement } from "./framesConfig.ts";
import { serveFrames } from "./framesServer.ts";
import { missingHeightsMiddleware } from "./heightsRoute.ts";
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
  storiesSourceModule
} from "./pages.ts";
import { docsModule } from "./pluginModules.ts";
import { prebundled, scannedEntries } from "./prebundled.ts";
import {
  indexedStoryFiles,
  storyFilesGroupOf,
  storyFilesGroupText,
  storyFilesModule,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { storyReach } from "./storyReach.ts";
import { CODE_QUERY, DOCS_PAGE_QUERY, MARKDOWN_QUERY, PAGE_QUERY } from "./textQueries.ts";
import { joinedUsage } from "./usageModule.ts";
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

/** The query that asks for the story files a pattern matches (`../src/**\/*.stories.tsx?forgebook-files`). */
const FILES_QUERY = "?forgebook-files";

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
const FILES_PREFIX = "\0forgebook-files:";

/** The query that asks for the docs pages a pattern matches (`./docs/*.md?forgebook-docs-pages`). */
const DOCS_PAGES_QUERY = "?forgebook-docs-pages";

/** The id of a pattern's docs pages: virtual, with the declaring module's folder and the pattern after it. */
const DOCS_PAGES_PREFIX = "\0forgebook-docs-pages:";

/** A docs page, whose file added or removed changes what the sidebar lists. */
const DOCS_PAGE_FILE = /\.md$/;

/** A TypeScript source file, whose edit may change a component's docs. */
const SOURCE_FILE = /\.tsx?$/;

/** The query that asks for a story file's component docs. */
const DOCS_QUERY = "?forgebook-docs";

/** The queries `textModules.ts` answers. */
const TEXT_QUERIES: readonly string[] = [CODE_QUERY, PAGE_QUERY, MARKDOWN_QUERY];

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

/**
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders.
 *
 * @param id - the module's id (`FILES_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param warm - builds the program that holds a story file, so the package's docs are ready before a page asks; none
 *   where no page will ask.
 * @param hasUsage - whether the group offers its "Used in" loader.
 * @throws when a story file cannot be indexed.
 */
const patternModule = (
  id: string,
  watch: (file: string) => void,
  warm: ((storyFile: string) => void) | undefined,
  hasUsage: boolean
): { code: string; moduleType: "js" } => {
  const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  let first: string | undefined;
  const code = storyFilesModule(
    root,
    pattern,
    (file: string): void => {
      first ??= file;
      watch(file);
    },
    hasUsage
  );
  if (first !== undefined) warm?.(first);
  return { code, moduleType: "js" };
};

/** The resolved id of a group's "Used in" module: Rollup's mark of a virtual module, then its import's specifier. */
const USAGE_ID_PREFIX = `\0${USAGE_PREFIX}`;

/**
 * The id of a virtual module the plugin makes (the configuration's data, a group's "Used in"), when the import names
 * one.
 *
 * @param source - the import's specifier.
 */
const virtualId = (source: string): string | undefined => {
  if (source === CONFIG_MODULE) return CONFIG_ID;
  return source.startsWith(USAGE_PREFIX) ? `\0${source}` : undefined;
};

/**
 * A group's "Used in" module: its story files indexed, what their stories render read in the docs worker, joined.
 *
 * @param id - the module's id (`USAGE_ID_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 */
const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"],
  isServing: boolean
): Promise<{ code: string; moduleType: "js" }> => {
  const { root, pattern } = storyFilesGroupOf(id.slice(USAGE_ID_PREFIX.length));
  const files = indexedStoryFiles(root, pattern, watch);
  const graph = await usage(
    files.map((file) => ({
      storyFile: file.file,
      exports: file.index.stories.map((story) => story.exportName)
    }))
  );
  const answer =
    typeof graph === "string"
      ? { error: graph }
      : joinedUsage(
          graph,
          files.map((file) => ({
            storyFile: file.file,
            title: file.index.title,
            related: file.index.related ?? []
          }))
        );
  // on the dev server only: a static build has no tools to ask, and this would ship every story's files to the reader
  const reach =
    isServing && typeof graph !== "string"
      ? storyReach(
          graph,
          files.map((file) => ({ storyFile: file.file, title: file.index.title }))
        )
      : [];
  const code = `export default ${JSON.stringify(answer)};\nexport const reach = ${JSON.stringify(reach)};`;
  return { code, moduleType: "js" };
};

/** The resolved id of the configuration's data module. */
const CONFIG_ID = `\0${CONFIG_MODULE}`;

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
 * A docs pages' module, when the id is a pattern's or a page's. The Markdown reader loads with the first: a catalogue
 * may have no docs pages, and a story's page reads none.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param isServing - whether a dev server runs.
 */
const docsModuleOf = async (
  id: string,
  watch: (file: string) => void,
  isServing: boolean
): Promise<{ code: string; moduleType: "js" } | undefined> => {
  const isPage = id.endsWith(DOCS_PAGE_QUERY);
  if (!isPage && !id.startsWith(DOCS_PAGES_PREFIX)) return undefined;
  const { docPageModule, docPagesModule } = await import("./docPagesModule.ts");
  if (isPage) {
    const file = id.slice(0, -DOCS_PAGE_QUERY.length);
    return { code: docPageModule(file, watch, isServing), moduleType: "js" };
  }
  const { root, pattern } = storyFilesGroupOf(id.slice(DOCS_PAGES_PREFIX.length));
  return { code: docPagesModule(root, pattern, watch, isServing), moduleType: "js" };
};

/**
 * A module the plugin generates for a catalogue's pages, when the id names one: an entry, the project's own stories'
 * source, or a page's HTML (unless the folder has one of its own). The configuration's data waits for the frames'
 * placement, so the plugin's `load` makes it.
 *
 * @param id - the module's id.
 * @param config - the catalogue's configuration.
 */
const generatedModule = (
  id: string,
  config: ResolvedConfig
): { code: string; moduleType: "js" } | string | undefined => {
  const named = pageModuleOf(id, config.dir);
  if (named === undefined) return undefined;
  if (named.kind === "entry") {
    const code = named.page === "index.html" ? shellEntry(config) : frameEntry(config);
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
  /** The groups' "Used in" modules, renewed when a source file changes: any edit may change what reaches what. */
  const usageModules = new Set<string>();
  /** The docs pages' modules, renewed when a Markdown file is added or removed. */
  const docsModules = new Set<string>();
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
    return generatedModule(id, config);
  };
  /** The dev server; none in a build. */
  let devServer: ViteDevServer | undefined;
  /** Whether a dev server runs, or a build: tools ask only the former. */
  let command: ConfigEnv["command"] = "serve";
  const isServing = (): boolean => command === "serve";
  /**
   * Whether the server runs tests (Vitest's mode): no person waits for a page, so no docs program is warmed. A worker
   * still loading TypeScript when the tests end is stopped by Node mid-parse, which aborts the process.
   */
  let isTestRun = false;
  // the docs are read in a worker, made once the framework is known: a package's TypeScript program takes seconds to
  // build and would hold every other answer of the dev server meanwhile
  let docs: DocsExtractor | undefined;
  const extractor = (): DocsExtractor => {
    const framework = config?.framework ?? options.framework;
    if (framework === undefined)
      throw new Error("Forgebook has no framework: add forgebook.config.ts, or give the plugin `framework`");
    docs ??= createDocsExtractor(framework.docsModule);
    return docs;
  };
  /**
   * Renews what an edited source file may change: the docs' programs, and every group's "Used in".
   *
   * @param server - the dev server.
   * @param file - the edited file.
   */
  const renewOnChange = (server: ViteDevServer, file: string): void => {
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    if (!SOURCE_FILE.test(file) && componentFiles?.extension !== extname(file)) return;
    docs?.changed();
    const graph = server.environments.client.moduleGraph;
    for (const id of usageModules) {
      const module = graph.getModuleById(id);
      if (module !== undefined) graph.invalidateModule(module);
    }
  };
  /**
   * A pattern's module or a group's "Used in" module, when the id is one.
   *
   * @param id - the module's id.
   * @param watch - adds a file whose edit renews the module.
   * @throws when a story file cannot be indexed.
   */
  const storiesModule = async (
    id: string,
    watch: (file: string) => void
  ): Promise<{ code: string; moduleType: "js" } | undefined> => {
    if (id.startsWith(USAGE_ID_PREFIX)) {
      usageModules.add(id);
      return usageModule(id, watch, extractor().usage, isServing());
    }
    if (!id.startsWith(FILES_PREFIX)) return undefined;
    filesModules.add(id);
    return patternModule(id, watch, isTestRun ? undefined : extractor().warm, config?.lists.usedIn !== false);
  };
  /**
   * The modules a file added or removed changes; none when it changes no list.
   *
   * @param file - the file.
   */
  const modulesListing = (file: string): readonly string[] | undefined => {
    // the patterns' modules list the story files; the groups' "Used in" read them
    if (STORY_FILE.test(file)) return [...filesModules, ...usageModules];
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
    if (id.endsWith(DOCS_QUERY)) {
      return docsModule(await extractor().extract(id.slice(0, -DOCS_QUERY.length)), watch);
    }
    if (id.startsWith(DOCS_PAGES_PREFIX)) docsModules.add(id);
    const docsPages = await docsModuleOf(id, watch, isServing());
    if (docsPages !== undefined) return docsPages;
    if (!TEXT_QUERIES.some((query) => id.endsWith(query))) return undefined;
    // loaded on the first of these queries: the highlighter, the Markdown reader and what they need stay out of a
    // server whose pages never ask
    const { textModule } = await import("./textModules.ts");
    const componentFiles = (config?.framework ?? options.framework)?.componentFiles;
    return textModule(id, { watch, resolveImport, componentFiles });
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
      const pages =
        config === undefined
          ? {}
          : {
              root: config.dir,
              // the pages are generated, so Vite's scanner cannot find what they import: it is named here, and the
              // story files (the project's and the sources') are scanned for what their components import
              optimizeDeps: {
                include: prebundled(config, packageResolver(config.dir), packageResolver(PACKAGE_DIR)),
                entries: scannedEntries(config, packageResolver(config.dir), readTextFile)
              },
              build: {
                rolldownOptions: {
                  input: {
                    index: pageModulePath(config.dir, "index.html"),
                    frame: pageModulePath(config.dir, "frame.html")
                  }
                }
              },
              // Vite lets any localhost page read the server: neither origin needs another's reads, and the guards
              // would be the only wall left between the frames and the catalogue (unless the app chose its own)
              ...(config.frames.kind === "isolated" && userConfig.server?.cors === undefined
                ? { server: { cors: false } }
                : {})
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
    configResolved: (resolved: { readonly logger: Logger }): void => {
      for (const problem of config?.shell.problems ?? [])
        resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
    },
    configureServer: (server: ViteDevServer): void => {
      devServer = server;
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
    closeBundle: async (): Promise<void> => {
      await docs?.close();
    },
    async load(id: string): Promise<{ code: string; moduleType: "js" } | string | null> {
      const generated = await pagesModule(id);
      if (generated !== undefined) return generated;
      // an answer, not an error: an error would raise Vite's overlay on every reader's open page
      if (!isReadable(id, devServer)) return { code: "export default null;", moduleType: "js" };
      // in Vite's form, the text Vite's module graph knows a file by: a Node path on Windows (`C:\app\x.md`) is another
      const watch = (file: string): void => this.addWatchFile(VITE_PATHS.normalize(file));
      const answered = await queryModule(id, watch, async (specifier: string, importer: string) => {
        const resolved = await this.resolve(specifier, importer);
        return resolved?.id;
      });
      if (answered !== undefined) return answered;
      try {
        return (await storiesModule(id, watch)) ?? null;
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    }
  };
};
