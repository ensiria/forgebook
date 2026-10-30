/**
 * The Vite plugin an app adds to show a catalogue: the story files of every source, and the forced-states rewrite of
 * every style sheet.
 *
 * @remarks
 * A source names its story files with `import files from "<pattern>?forgebook-files"`: the plugin answers each with
 * one module (`storyFilesModule.ts`) holding every matched file's index, read from its source with Vite's parser, and
 * the loaders of its module, of its component's docs and of its code (D-438). Those loaders ask for
 * `?forgebook-docs`, answered with the component's props read from its types (`extractDocs.ts`) or `{ error }` for
 * the panel, `?forgebook-code`, answered with each story's `render` as written (`storyCode.ts`),
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
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { StoryMarkdown } from "@ensiria/story-format/source";
import { NodePackageImporter } from "sass-embedded";
import ts from "typescript-6";
import type { Plugin, UserConfig, ViteDevServer } from "vite";

import { componentPage, markdownHtml } from "./componentPage.ts";
import { createDocsExtractor, type DocsResult } from "./docsExtractor.ts";
import { moduleSummaryOf } from "./docsProgram.ts";
import { componentImport } from "./extractDocs.ts";
import { FORCED_STATES_VISITOR } from "./forcedStates.ts";
import { highlightCode } from "./highlightCode.ts";
import { storyCode } from "./storyCode.ts";
import { storyFilesModule } from "./storyFilesModule.ts";

/** The query that asks for the story files a pattern matches (`../src/**\/*.stories.tsx?forgebook-files`). */
const FILES_QUERY = "?forgebook-files";

/** The id of a pattern's module: virtual, with the declaring module's folder and the pattern after it. */
const FILES_PREFIX = "\0forgebook-files:";

/** Between the folder and the pattern in a pattern module's id: no path or pattern holds it. */
const FILES_SEPARATOR = "::";

/** A story file, as the sources' globs match them. */
const STORY_FILE = /\.stories\.tsx?$/;

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
  /** Folders outside the app the dev server watches for new story files (each source's `src` and `stories`). */
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
 * The module of a `?forgebook-files` pattern: every matched story file's index and loaders.
 *
 * @param id - the module's id (`FILES_PREFIX`, the importer's folder, `FILES_SEPARATOR`, the pattern).
 * @param watch - adds a file whose edit renews the module (each story file).
 * @param warm - builds the program that holds a story file, so the package's docs are ready before a page asks.
 * @throws when a story file cannot be indexed.
 */
const patternModule = (
  id: string,
  watch: (file: string) => void,
  warm: (storyFile: string) => void
): { code: string; moduleType: "js" } => {
  const [root = "", pattern = ""] = id.slice(FILES_PREFIX.length).split(FILES_SEPARATOR);
  let first: string | undefined;
  const code = storyFilesModule(root, pattern, (file: string): void => {
    first ??= file;
    watch(file);
  });
  if (first !== undefined) warm(first);
  return { code, moduleType: "js" };
};

/**
 * The catalogue's Vite plugin.
 *
 * @param options - the folders to watch; none by default.
 * @returns the plugin, for the app's `plugins`.
 */
export const forgebookPlugin = ({ watch = [] }: ForgebookPluginOptions = {}): Plugin => {
  /** The modules of the patterns, renewed when a story file is added or removed. */
  const filesModules = new Set<string>();
  // the docs are read in a worker: a package's TypeScript program takes seconds to build and would hold every other
  // answer of the dev server meanwhile
  const docs = createDocsExtractor();
  return {
    name: "ensiria-forgebook",
    enforce: "pre",
    resolveId(source: string, importer: string | undefined): string | null {
      if (!source.endsWith(FILES_QUERY) || importer === undefined) return null;
      return `${FILES_PREFIX}${dirname(importer)}${FILES_SEPARATOR}${source.slice(0, -FILES_QUERY.length)}`;
    },
    configureServer: (server: ViteDevServer): void => {
      server.httpServer?.on("close", (): void => void docs.close());
      // an edited component or type file changes its docs: the worker renews its programs on their next read
      server.watcher.on("change", (file: string): void => {
        if (SOURCE_FILE.test(file)) docs.changed();
      });
      if (watch.length === 0) return;
      server.watcher.add([...watch]);
      const refresh = (file: string): void => {
        if (!STORY_FILE.test(file)) return;
        const graph = server.environments.client.moduleGraph;
        for (const id of filesModules) {
          const module = graph.getModuleById(id);
          if (module !== undefined) graph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
    closeBundle: async (): Promise<void> => {
      await docs.close();
    },
    config: (): UserConfig => ({
      css: {
        transformer: "lightningcss",
        lightningcss: { visitor: FORCED_STATES_VISITOR },
        preprocessorOptions: { scss: { importers: [new NodePackageImporter()] } }
      }
    }),
    async load(id: string): Promise<{ code: string; moduleType: "js" } | null> {
      if (id.endsWith(DOCS_QUERY)) {
        const component = await docs.extract(id.slice(0, -DOCS_QUERY.length));
        return docsModule(component, (file: string): void => this.addWatchFile(file));
      }
      if (id.endsWith(CODE_QUERY)) return codeModule(id.slice(0, -CODE_QUERY.length));
      if (id.endsWith(PAGE_QUERY)) {
        const storyFile = id.slice(0, -PAGE_QUERY.length);
        const componentFile = await componentFileOf(
          storyFile,
          async (specifier: string) => (await this.resolve(specifier, storyFile))?.id
        );
        return pageModule(storyFile, componentFile, (file: string): void => this.addWatchFile(file));
      }
      if (id.endsWith(MARKDOWN_QUERY)) {
        return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), (file: string): void =>
          this.addWatchFile(file)
        );
      }
      if (!id.startsWith(FILES_PREFIX)) return null;
      filesModules.add(id);
      try {
        return patternModule(id, (file: string): void => this.addWatchFile(file), docs.warm);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    }
  };
};
