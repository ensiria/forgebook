/**
 * The two pages a catalogue is made of, as the plugin generates them from its configuration: their HTML, the
 * entries that mount the shell and the frame, the configuration the pages read, and the source of the project's own
 * stories. Pure: a resolved configuration in, text out.
 *
 * @remarks
 * An app writes no page: the shell's entry mounts the shell with the configuration's data, its sources and the
 * framework's code writer; the frame's mounts the framework's frame with the sources and the previews. The sources
 * are imported by specifier (each exports `source`), the project's own stories through a generated source, the
 * previews and the logo by path, so their code is bundled as any import is.
 *
 * @module
 */
import type { PageConfig } from "../pageConfig.ts";
import { MOCKS_MODULES, PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** The pages, by their file name. */
export const PAGE_FILES = ["index.html", "frame.html"] as const;

/** A page's file name. */
export type PageFile = (typeof PAGE_FILES)[number];

/** The module the pages read the configuration's data from. */
export const CONFIG_MODULE = "virtual:forgebook/config";

/**
 * The entries the pages load, by page: file names in the configuration's folder, never written to disk. Named as
 * files rather than virtual modules because the build names a page's chunk and its style sheet after its entry, and a
 * virtual module's id cannot be part of a file name.
 */
export const PAGE_ENTRIES: Readonly<Record<PageFile, string>> = {
  "index.html": ".forgebook-shell.ts",
  "frame.html": ".forgebook-frame.ts"
};

/** The file name, in the configuration's folder, of the project's own stories' source (never written to disk). */
export const STORIES_SOURCE_FILE = ".forgebook-stories.ts";

/**
 * The file name, in the configuration's folder, of the module the dev server loads to answer tools and agents: the
 * sources and the previews, as the frame gets them (never written to disk).
 */
export const AGENT_SOURCES_FILE = ".forgebook-agent.ts";

/** The project's own stories' source id. */
export const OWN_SOURCE_ID = "stories";

/** A module the plugin generates in the configuration's folder: a page, a page's entry, or one of the two sources. */
export type PageModule =
  | { readonly kind: "page"; readonly page: PageFile }
  | { readonly kind: "entry"; readonly page: PageFile }
  | { readonly kind: "stories-source" }
  | { readonly kind: "agent-sources" };

/**
 * A generated module's path, in Vite's form: what the pages import, what Vite's ids name.
 *
 * @param dir - the configuration's folder.
 * @param file - the module's file name (`PAGE_FILES`, `PAGE_ENTRIES`, `STORIES_SOURCE_FILE`, `AGENT_SOURCES_FILE`).
 * @param paths - the path functions; the running system's unless a test names another.
 */
export const pageModulePath = (dir: string, file: string, paths: VitePaths = VITE_PATHS): string =>
  paths.join(dir, file);

/**
 * The generated module a path names, when it names one: an id from Vite (`C:/app/.forgebook-shell.ts` on Windows) or
 * a path from Node (`C:\app\frame.html`, as the build's inputs may arrive) both match.
 *
 * @param path - the id or path.
 * @param dir - the configuration's folder.
 * @param paths - the path functions; the running system's unless a test names another.
 */
export const pageModuleOf = (
  path: string,
  dir: string,
  paths: VitePaths = VITE_PATHS
): PageModule | undefined => {
  const named = paths.normalize(path);
  const isAt = (file: string): boolean => named === pageModulePath(dir, file, paths);
  const entry = PAGE_FILES.find((page) => isAt(PAGE_ENTRIES[page]));
  if (entry !== undefined) return { kind: "entry", page: entry };
  const page = PAGE_FILES.find((candidate) => isAt(candidate));
  if (page !== undefined) return { kind: "page", page };
  if (isAt(STORIES_SOURCE_FILE)) return { kind: "stories-source" };
  if (isAt(AGENT_SOURCES_FILE)) return { kind: "agent-sources" };
  return undefined;
};

/**
 * Text set in HTML: its `<`, `>`, `&` and quotes escaped.
 *
 * @param text - the text.
 */
const escaped = (text: string): string =>
  text.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * A page's HTML: its title, the frame's head tags, the root the entry mounts in.
 *
 * @param page - the page.
 * @param config - the configuration.
 */
export const pageHtml = (page: PageFile, config: ResolvedConfig): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escaped(page === "index.html" ? config.title : "Story")}</title>`,
    ...(page === "frame.html" && config.head !== "" ? [config.head] : []),
    ...(page === "frame.html" && config.shell.frameCss !== ""
      ? [`    <style>${config.shell.frameCss}</style>`]
      : []),
    ...(page === "index.html" && config.shell.themeCss !== ""
      ? [`    <style>${config.shell.themeCss}</style>`]
      : []),
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    `    <script type="module" src="/${PAGE_ENTRIES[page]}"></script>`,
    "  </body>",
    "</html>",
    ""
  ].join("\n");

/**
 * The configuration's data, as the pages' module exports it.
 *
 * @param config - the configuration.
 */
export const configModule = (config: ResolvedConfig): string => {
  const data: PageConfig = {
    title: config.title,
    heights: config.heights,
    switches: config.switches,
    languages: config.languages,
    lists: config.lists
  };
  return `export default ${JSON.stringify(data)};`;
};

/**
 * The imports of the sources, and the list they make: the project's own stories first, then each package's.
 *
 * @param config - the configuration.
 */
const sourcesCode = (config: ResolvedConfig): { readonly imports: string[]; readonly list: string } => {
  const hasOwn = config.stories.length > 0 || config.docs.length > 0;
  const own = hasOwn ? [pageModulePath(config.dir, STORIES_SOURCE_FILE)] : [];
  const specifiers = [...own, ...config.sources];
  return {
    imports: specifiers.map(
      (specifier, index) => `import { source as source${index} } from ${JSON.stringify(specifier)};`
    ),
    list: `[${specifiers.map((_specifier, index) => `source${index}`).join(", ")}]`
  };
};

/**
 * The shell's entry: the shell mounted with the configuration's data, the logo, the sources and the code writer.
 *
 * @param config - the configuration.
 */
export const shellEntry = (config: ResolvedConfig): string => {
  const sources = sourcesCode(config);
  return [
    'import { mountShell } from "forgebook/shell";',
    `import { codeOf } from ${JSON.stringify(config.framework.pages.code)};`,
    `import config from ${JSON.stringify(CONFIG_MODULE)};`,
    ...(config.logo === undefined ? [] : [`import logo from ${JSON.stringify(`${config.logo}?url`)};`]),
    ...sources.imports,
    ...config.shell.styleSheets.map((file) => `import ${JSON.stringify(file)};`),
    'const root = document.getElementById("root");',
    "if (root !== null)",
    "  mountShell(root, {",
    "    title: config.title,",
    ...(config.logo === undefined ? [] : ["    logo,"]),
    ...(config.shell.hasBranding ? [] : ["    hasBranding: false,"]),
    ...(config.heights === undefined ? [] : ["    heights: config.heights,"]),
    `    sources: ${sources.list},`,
    '    frameUrl: "frame.html",',
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    "    codeOf",
    "  });",
    ""
  ].join("\n");
};

/**
 * The frame's loader of the play tools: Testing Library's `within` and `userEvent`, imported on the first play, so a
 * catalogue whose stories have no play never loads them.
 */
const playToolsLoader = (): string => {
  const imports = PLAY_TOOLS_PACKAGES.map((name) => `import(${JSON.stringify(name)})`).join(", ");
  return [
    "    playTools: async () => {",
    `      const [dom, events] = await Promise.all([${imports}]);`,
    "      return { within: dom.within, userEvent: events.userEvent };",
    "    },"
  ].join("\n");
};

/**
 * The frame's loader of MSW: the worker and the handlers it adds to a story's, imported for the first story with
 * handlers, so a catalogue whose stories mock nothing never loads them.
 */
const mockToolsLoader = (): string => {
  const imports = MOCKS_MODULES.map((name) => `import(${JSON.stringify(name)})`).join(", ");
  return [
    "    mockTools: async () => {",
    `      const [browser, core] = await Promise.all([${imports}]);`,
    "      return { setupWorker: browser.setupWorker, http: core.http, passthrough: core.passthrough };",
    "    },"
  ].join("\n");
};

/**
 * The frame's entry: the framework's frame mounted with the sources, the configuration's data and the previews.
 *
 * @param config - the configuration.
 */
export const frameEntry = (config: ResolvedConfig): string => {
  const sources = sourcesCode(config);
  return [
    `import { mountFrame } from ${JSON.stringify(config.framework.pages.frame)};`,
    `import config from ${JSON.stringify(CONFIG_MODULE)};`,
    ...sources.imports,
    ...config.previews.map((file, index) => `import * as preview${index} from ${JSON.stringify(file)};`),
    'const root = document.getElementById("root");',
    "if (root !== null)",
    "  void mountFrame(root, {",
    `    sources: ${sources.list},`,
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    ...(config.hasPlayTools ? [playToolsLoader()] : []),
    ...(config.hasMocks ? [mockToolsLoader()] : []),
    `    previews: [${config.previews.map((_file, index) => `preview${index}`).join(", ")}]`,
    "  });",
    ""
  ].join("\n");
};

/**
 * The module the dev server loads to answer tools and agents: the sources and the previews the frame mounts, as
 * values (`sources`, `previews`), loaded on the server with the same imports the pages use.
 *
 * @param config - the configuration.
 */
export const agentSourcesModule = (config: ResolvedConfig): string => {
  const sources = sourcesCode(config);
  return [
    ...sources.imports,
    ...config.previews.map((file, index) => `import * as preview${index} from ${JSON.stringify(file)};`),
    `export const sources = ${sources.list};`,
    `export const previews = [${config.previews.map((_file, index) => `preview${index}`).join(", ")}];`,
    ""
  ].join("\n");
};

/**
 * The source of the project's own stories and docs pages: one `?forgebook-files` or `?forgebook-docs-pages` import per
 * glob, named after the catalogue.
 *
 * @param config - the configuration.
 */
export const storiesSourceModule = (config: ResolvedConfig): string =>
  [
    ...config.stories.map(
      (pattern, index) =>
        `import files${index} from ${JSON.stringify(`./${pattern.replace(/^\.\//, "")}?forgebook-files`)};`
    ),
    ...config.docs.map(
      (pattern, index) =>
        `import docs${index} from ${JSON.stringify(`./${pattern.replace(/^\.\//, "")}?forgebook-docs-pages`)};`
    ),
    "export const source = {",
    `  id: ${JSON.stringify(OWN_SOURCE_ID)},`,
    `  name: ${JSON.stringify(config.title)},`,
    `  files: [${config.stories.map((_pattern, index) => `files${index}`).join(", ")}],`,
    ...(config.docs.length === 0
      ? []
      : [`  docs: [${config.docs.map((_pattern, index) => `docs${index}`).join(", ")}],`]),
    "  sheets: { required: [], theme: [], restyled: [] }",
    "};",
    ""
  ].join("\n");
