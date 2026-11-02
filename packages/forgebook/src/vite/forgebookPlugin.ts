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
 * `?forgebook-markdown`, a source's own Markdown file (its introduction on the home) as HTML. It also sets
 * Lightning CSS as the CSS transformer with the forced-states visitor (`forcedStates.ts`) and lets Sass resolve
 * `pkg:` URLs, which the library's style sheets use.
 *
 * A pattern's module watches its story files, so an edit renews it. Vite watches only its root for new files, and the
 * sources' story files live in other packages: `watch` names their folders, and a story file added or removed there
 * renews every pattern's module and reloads the page, so the sidebar lists it at once.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { ConfigEnv, Logger, Plugin, UserConfig, ViteDevServer } from "vite";

import { createLiveErrors, isLiveErrorReport, LIVE_ERROR_EVENT } from "../liveErrors.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { agentMiddleware } from "./agentRoutes.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { type DiskCache, diskCache } from "./diskCache.ts";
import { createDocsExtractor, type DocsExtractor, type DocsResult } from "./docsExtractor.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { missingHeightsMiddleware } from "./heightsRoute.ts";
import {
  AGENT_SOURCES_FILE,
  agentSourcesModule,
  CONFIG_MODULE,
  configModule,
  frameEntry,
  PAGE_ENTRIES,
  PAGE_FILES,
  type PageFile,
  pageHtml,
  STORIES_SOURCE_FILE,
  shellEntry,
  storiesSourceModule
} from "./pages.ts";
import { prebundled, scannedEntries } from "./prebundled.ts";
import {
  indexedStoryFiles,
  type KeptIndex,
  storyFilesGroupOf,
  storyFilesGroupText,
  storyFilesModule,
  USAGE_PREFIX
} from "./storyFilesModule.ts";
import { storyReach } from "./storyReach.ts";
import { joinedUsage } from "./usageModule.ts";

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

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
const FILES_PREFIX = "\0forgebook-files:";

/** A TypeScript source file, whose edit may change a component's docs. */
const SOURCE_FILE = /\.tsx?$/;

/** The query that asks for a story file's component docs. */
const DOCS_QUERY = "?forgebook-docs";

/** A module `textModules.ts` answers, by its query. */
const TEXT_MODULE = /\?forgebook-(?:code|page|markdown)$/;

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
 * The module that answers a `?forgebook-docs` import: the story file's component docs, or `{ error }` for the panel.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews the module.
 */
const docsModule = (
  component: DocsResult,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  // the docs come from the component's files, not the story file the id names: Vite renews them on an edit only if
  // it watches those files too
  if (typeof component !== "string" && "sources" in component) {
    for (const file of component.sources) watch(file);
  }
  const value = typeof component === "string" ? { error: component } : component.docs;
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
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
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders.
 *
 * @param id - the module's id (`FILES_PREFIX`, then the group: `storyFilesGroupText`).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param hasUsage - whether the group offers its "Used in" loader.
 * @param cache - the indexes kept between starts.
 * @throws when a story file cannot be indexed.
 */
const patternModule = (
  id: string,
  watch: (file: string) => void,
  hasUsage: boolean,
  cache: DiskCache<KeptIndex> | undefined
): { code: string; moduleType: "js" } => {
  const { root, pattern } = storyFilesGroupOf(id.slice(FILES_PREFIX.length));
  return { code: storyFilesModule(root, pattern, watch, hasUsage, cache), moduleType: "js" };
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
 * A module the plugin generates for a catalogue's pages, when the id names one: the configuration's data, an entry,
 * the project's own stories' source, or a page's HTML (unless the folder has one of its own).
 *
 * @param id - the module's id.
 * @param config - the catalogue's configuration.
 */
const generatedModule = (
  id: string,
  config: ResolvedConfig
): { code: string; moduleType: "js" } | string | undefined => {
  if (id === CONFIG_ID) return { code: configModule(config), moduleType: "js" };
  if (id === join(config.dir, PAGE_ENTRIES["index.html"]))
    return { code: shellEntry(config), moduleType: "js" };
  if (id === join(config.dir, PAGE_ENTRIES["frame.html"]))
    return {
      code: frameEntry(config, packageResolver(PACKAGE_DIR)("axe-core/axe.min.js")),
      moduleType: "js"
    };
  if (id === join(config.dir, STORIES_SOURCE_FILE))
    return { code: storiesSourceModule(config), moduleType: "js" };
  if (id === join(config.dir, AGENT_SOURCES_FILE))
    return { code: agentSourcesModule(config), moduleType: "js" };
  const page = PAGE_FILES.find((candidate) => id === join(config.dir, candidate));
  return page !== undefined && !existsSync(id) ? pageHtml(page, config) : undefined;
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
  /** The errors the open frames report, for `forgebook errors` and the agents. */
  const live = createLiveErrors();
  let config = options.config;
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
   * Renews what an edited source file may change: the docs' programs, and every group's "Used in".
   *
   * @param server - the dev server.
   * @param file - the edited file.
   */
  const renewOnChange = (server: ViteDevServer, file: string): void => {
    if (!SOURCE_FILE.test(file)) return;
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
    return patternModule(id, watch, config?.lists.usedIn !== false, indexCache());
  };
  const pagePath = (page: PageFile): string | undefined =>
    config === undefined ? undefined : join(config.dir, page);
  const entryPath = (page: PageFile): string | undefined =>
    config === undefined ? undefined : join(config.dir, PAGE_ENTRIES[page]);
  const storiesSource = (): string | undefined =>
    config === undefined ? undefined : join(config.dir, STORIES_SOURCE_FILE);
  const agentSources = (): string | undefined =>
    config === undefined ? undefined : join(config.dir, AGENT_SOURCES_FILE);
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
    if (!TEXT_MODULE.test(id)) return undefined;
    // imported here: the highlighter and the TypeScript compiler it splits code with are the server's heaviest
    // modules, and a story's page never asks for one of these
    const { textModule } = await import("./textModules.ts");
    return textModule(id, watch, resolveImport, cacheFolder);
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
                  input: { index: join(config.dir, "index.html"), frame: join(config.dir, "frame.html") }
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
      const entry = PAGE_FILES.find(
        (page) => source === `/${PAGE_ENTRIES[page]}` || source === entryPath(page)
      );
      if (entry !== undefined) return entryPath(entry) ?? null;
      if (source === storiesSource() || source === agentSources()) return source;
      const page = PAGE_FILES.find(
        (candidate) => source === pagePath(candidate) || source === `/${candidate}`
      );
      if (page !== undefined) return pagePath(page) ?? null;
      if (!source.endsWith(FILES_QUERY) || importer === undefined) return null;
      return filesId(dirname(importer), source.slice(0, -FILES_QUERY.length));
    },
    // a warning and not a failure: a theme a reader can still use must not stop a catalogue from building
    configResolved: (resolved: { readonly logger: Logger; readonly cacheDir: string }): void => {
      cacheFolder = join(resolved.cacheDir, "forgebook");
      for (const problem of config?.shell.problems ?? [])
        resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
    },
    configureServer: (server: ViteDevServer): void => {
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
        if (!STORY_FILE.test(file)) return;
        const graph = server.environments.client.moduleGraph;
        // the patterns' modules list the files; the groups' "Used in" read them
        for (const id of [...filesModules, ...usageModules]) {
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
      const generated = config === undefined ? undefined : generatedModule(id, config);
      if (generated !== undefined) return generated;
      const watch = (file: string): void => this.addWatchFile(file);
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
