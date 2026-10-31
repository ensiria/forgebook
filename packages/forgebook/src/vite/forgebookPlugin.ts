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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { StoryMarkdown } from "@forgebook/story-format/source";
import ts from "typescript-6";
import type { Plugin, UserConfig, ViteDevServer } from "vite";

import { createLiveErrors, isLiveErrorReport, LIVE_ERROR_EVENT } from "../liveErrors.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { agentMiddleware } from "./agentRoutes.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { componentPage, markdownHtml } from "./componentPage.ts";
import { findConfigFile, loadConfigFile, packageResolver, type ResolvedConfig } from "./configFile.ts";
import { createDocsExtractor, type DocsExtractor, type DocsResult } from "./docsExtractor.ts";
import { moduleSummaryOf } from "./docsProgram.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { highlightCode } from "./highlightCode.ts";
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
import { storyCode } from "./storyCode.ts";
import {
  indexedStoryFiles,
  storyFilesGroup,
  storyFilesModule,
  USAGE_PREFIX,
  USAGE_SEPARATOR
} from "./storyFilesModule.ts";
import { componentImport } from "./storyMeta.ts";
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

/** The query that asks for the story files a pattern matches (`../src/**\/*.stories.tsx?forgebook-files`). */
const FILES_QUERY = "?forgebook-files";

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
const FILES_PREFIX = "\0forgebook-files:";

/** Between the folder and the pattern in a pattern module's id: no path or pattern holds it. */
const FILES_SEPARATOR = "::";

/** The query that asks for a story file's code: each story's `render` as written. */
const CODE_QUERY = "?forgebook-code";

/** The query that asks for a story file's component page: its documentation file as HTML. */
const PAGE_QUERY = "?forgebook-page";

/** The query a source's Markdown file is imported with (its introduction on the home), answered with its HTML. */
const MARKDOWN_QUERY = "?forgebook-markdown";

/** A TypeScript source file, whose edit may change a component's docs. */
const SOURCE_FILE = /\.tsx?$/;

/** The query that asks for a story file's component docs. */
const DOCS_QUERY = "?forgebook-docs";

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
 * The module that answers a `?forgebook-code` import: each story's `render` text and its coloured HTML, or `{ error }`
 * for the card.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 */
const codeModule = (storyFile: string): { code: string; moduleType: "js" } => {
  const code = storyCode(storyFile, readFileSync(storyFile, "utf8"));
  const value =
    typeof code === "string"
      ? { error: code }
      : Object.fromEntries(
          Object.entries(code).map(([name, text]) => [name, { text, html: highlightCode(text, "tsx") }])
        );
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The file of a story file's component, from the meta's import, resolved as the app resolves it.
 *
 * @param storyFile - the story file's absolute path.
 * @param resolve - resolves an import of the story file to its file; none when it does not resolve.
 * @returns the component's file, or none when the meta names no imported component.
 */
const componentFileOf = async (
  storyFile: string,
  resolve: (specifier: string) => Promise<string | undefined>
): Promise<string | undefined> => {
  const specifier = componentImport(storyFile, readFileSync(storyFile, "utf8"));
  return specifier === undefined ? undefined : resolve(specifier);
};

/**
 * The module that answers a `?forgebook-page` import: the component's documentation file as HTML (empty without
 * one), and its file's summary, the first paragraph of its `@module` comment, for the page's lead.
 *
 * @remarks
 * The summary is read here, from the component's file alone, rather than with the docs: the docs wait for the
 * package's TypeScript program, and the lead would come seconds after the rest of the page.
 *
 * @param storyFile - the story file's absolute path.
 * @param componentFile - the component's file, as the story file's import resolves; none when it names none.
 * @param watch - adds a file whose edit renews the module (the documentation file, the component's file).
 */
const pageModule = (
  storyFile: string,
  componentFile: string | undefined,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  const page = componentPage(storyFile);
  if (page !== undefined) watch(page.file);
  if (componentFile !== undefined) watch(componentFile);
  const summary =
    componentFile === undefined
      ? ""
      : moduleSummaryOf(
          ts.createSourceFile(
            componentFile,
            readFileSync(componentFile, "utf8"),
            ts.ScriptTarget.Latest,
            true
          )
        );
  const value = { html: page?.html ?? "", summary };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
const markdownModule = (file: string, watch: (file: string) => void): { code: string; moduleType: "js" } => {
  watch(file);
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The id of a `?forgebook-files` module: its group's folder, then its pattern (`storyFilesGroup`), so no `..` is left
 * in the id.
 *
 * @param folder - the importing module's folder.
 * @param pattern - the pattern as the import writes it.
 */
const filesId = (folder: string, pattern: string): string => {
  const group = storyFilesGroup(folder, pattern);
  return `${FILES_PREFIX}${group.root}${FILES_SEPARATOR}${group.pattern}`;
};

/**
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders.
 *
 * @param id - the module's id (`FILES_PREFIX`, the importer's folder, `FILES_SEPARATOR`, the pattern).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param warm - builds the program that holds a story file, so the package's docs are ready before a page asks.
 * @param hasUsage - whether the group offers its "Used in" loader.
 * @throws when a story file cannot be indexed.
 */
const patternModule = (
  id: string,
  watch: (file: string) => void,
  warm: (storyFile: string) => void,
  hasUsage: boolean
): { code: string; moduleType: "js" } => {
  const [root = "", pattern = ""] = id.slice(FILES_PREFIX.length).split(FILES_SEPARATOR);
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
  if (first !== undefined) warm(first);
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
 * @param id - the module's id (`USAGE_ID_PREFIX`, the pattern's folder, `USAGE_SEPARATOR`, the pattern).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param usage - reads the facts in the docs worker.
 */
const usageModule = async (
  id: string,
  watch: (file: string) => void,
  usage: DocsExtractor["usage"]
): Promise<{ code: string; moduleType: "js" }> => {
  const [root = "", pattern = ""] = id.slice(USAGE_ID_PREFIX.length).split(USAGE_SEPARATOR);
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
  return { code: `export default ${JSON.stringify(answer)};`, moduleType: "js" };
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
 * A module the plugin answers from a file's text alone, when the id asks for one: a story file's code, or a Markdown
 * file as HTML.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 */
const textModule = (
  id: string,
  watch: (file: string) => void
): { code: string; moduleType: "js" } | undefined => {
  if (id.endsWith(CODE_QUERY)) return codeModule(id.slice(0, -CODE_QUERY.length));
  if (id.endsWith(MARKDOWN_QUERY)) return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), watch);
  return undefined;
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
    return { code: frameEntry(config), moduleType: "js" };
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
      return usageModule(id, watch, extractor().usage);
    }
    if (!id.startsWith(FILES_PREFIX)) return undefined;
    filesModules.add(id);
    return patternModule(id, watch, extractor().warm, config?.lists.usedIn !== false);
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
    if (id.endsWith(PAGE_QUERY)) {
      const storyFile = id.slice(0, -PAGE_QUERY.length);
      const componentFile = await componentFileOf(storyFile, (specifier: string) =>
        resolveImport(specifier, storyFile)
      );
      return pageModule(storyFile, componentFile, watch);
    }
    return textModule(id, watch);
  };
  return {
    name: "forgebook",
    enforce: "pre",
    config: async (userConfig: UserConfig): Promise<UserConfig> => {
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
    configureServer: (server: ViteDevServer): void => {
      server.httpServer?.on("close", (): void => void docs?.close());
      // an edited component or type file changes its docs: the worker renews its programs on their next read
      server.watcher.on("change", (file: string): void => renewOnChange(server, file));
      // the answers to tools and agents (`forgebook stories`, `forgebook mcp`), from the same sources as the pages
      if (config !== undefined) server.middlewares.use(agentMiddleware(server, config, live));
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
      const watched = [...(config?.watch ?? []), ...(options.watch ?? [])];
      if (watched.length === 0) return;
      server.watcher.add(watched);
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
