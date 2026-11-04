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
import { codeLiteral } from "../codeLiteral.ts";
import { OWN_SOURCE_ID } from "../docPages.ts";
import { FRAME_STARTED_ATTRIBUTE, STATUS_ATTRIBUTE } from "../frame/frameStatus.ts";
import { LOAD_RELOADS_KEY } from "../frame/staleModule.ts";
import type { FramesPlacement } from "../frameOrigins.ts";
import { PREVIEWS_EVENT } from "../hotModules.ts";
import type { PageConfig } from "../pageConfig.ts";
import { PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { pluginFrameModule } from "./pluginConfig.ts";
import { HOME_QUERY } from "./textQueries.ts";
import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** The pages, by their file name. */
export const PAGE_FILES = ["index.html", "frame.html"] as const;

/** A page's file name. */
export type PageFile = (typeof PAGE_FILES)[number];

/** The module the pages read the configuration's data from. */
export const CONFIG_MODULE = "virtual:forgebook/config";

/** The module the shell reads the design tokens from, imported on first use: a page that shows none never loads it. */
export const TOKENS_MODULE = "virtual:forgebook/tokens";

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
 * sources, as the frame gets them (never written to disk).
 */
export const AGENT_SOURCES_FILE = ".forgebook-agent.ts";

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
 * What a frame shows when its code fails before the frame starts: a preview or a source that throws while it loads, or
 * a module that cannot be loaded at all. The frame's own code never runs then, so without this the frame stays blank
 * and its shell waits. Plain script in the page, since a module that failed cannot report anything; it stands down
 * once the frame has started (`FRAME_STARTED_ATTRIBUTE`), when the frame shows its own errors. It reads only errors
 * thrown by code and module scripts that failed to load: an image, a style sheet or a classic script of the `head`
 * (an analytics tag a blocker refuses) is not the catalogue's code.
 *
 * A module that could not be loaded is loaded again first, up to three times, one, two then four seconds later, once per
 * page load, counted in the session's storage by the frame's page and story until the frame draws its story
 * (`staleModule.ts` clears the count) or the guard gives up: in development a library served as source asks for
 * thousands of modules, and the browser refuses some while the other frames load (`ERR_INSUFFICIENT_RESOURCES`).
 *
 * It tells the shell only on the catalogue's origin, worked out as `pageOrigins` does for a frame from the placement
 * and the frame's own address, never from the address's query: a page that framed the story must not read its errors.
 *
 * @param placement - where the frames run.
 */
const frameLoadGuard = (placement: FramesPlacement): string => `(function () {
  var RELOAD_DELAY = 1000;
  var RELOADS = 3;
  var PLACEMENT = ${codeLiteral(placement)};
  var root = document.documentElement;
  var key = ${codeLiteral(LOAD_RELOADS_KEY)} + location.pathname + "?story=" + (new URLSearchParams(location.search).get("story") || "");
  var isReloading = false;
  function hasStarted() {
    return root.hasAttribute(${codeLiteral(FRAME_STARTED_ATTRIBUTE)}) || root.hasAttribute(${codeLiteral(STATUS_ATTRIBUTE)});
  }
  function catalogueOrigin() {
    if (PLACEMENT.kind === "origins") return PLACEMENT.catalogue;
    var own = new URL(location.href);
    if (PLACEMENT.kind === "ports") own.port = String(PLACEMENT.catalogue);
    return own.origin;
  }
  function forget() {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      // nothing to forget where the storage refuses access
    }
  }
  function show(message) {
    if (hasStarted()) return;
    forget();
    var box = document.createElement("div");
    box.className = "forgebook-frame-error";
    box.setAttribute("role", "alert");
    var text = document.createElement("p");
    text.className = "forgebook-frame-error__message";
    text.textContent = message;
    box.appendChild(text);
    document.getElementById("root").replaceChildren(box);
    root.setAttribute(${codeLiteral(STATUS_ATTRIBUTE)}, "error");
    var storyId = new URLSearchParams(location.search).get("story") || "";
    if (parent !== window) parent.postMessage({ type: "forgebook:error", storyId: storyId, message: message }, catalogueOrigin());
  }
  function reloadAgain() {
    if (isReloading) return true;
    var done;
    try {
      done = Number(sessionStorage.getItem(key) || "0");
      if (done >= RELOADS) return false;
      sessionStorage.setItem(key, String(done + 1));
    } catch (error) {
      return false;
    }
    isReloading = true;
    setTimeout(function () {
      if (!hasStarted()) location.reload();
    }, RELOAD_DELAY * Math.pow(2, done));
    return true;
  }
  addEventListener("error", function (event) {
    if (hasStarted()) return;
    var target = event.target;
    if (target && target.tagName === "SCRIPT" && target.type === "module") {
      if (reloadAgain()) return;
      show("The catalogue's code could not be loaded (" + target.src + "): see the console");
      return;
    }
    if (event instanceof ErrorEvent) {
      show("The catalogue's code failed while it loaded: " + (event.error && event.error.message ? event.error.message : event.message));
    }
  }, true);
})();`;

/**
 * A page's HTML: its title, the frame's head tags, the root the entry mounts in.
 *
 * @param page - the page.
 * @param config - the configuration.
 * @param placement - where the frames run, which the frame's load guard tells its errors by.
 */
export const pageHtml = (page: PageFile, config: ResolvedConfig, placement: FramesPlacement): string =>
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
    ...(page === "frame.html" ? [`    <script>${frameLoadGuard(placement)}</script>`] : []),
    `    <script type="module" src="/${PAGE_ENTRIES[page]}"></script>`,
    "  </body>",
    "</html>",
    ""
  ].join("\n");

/**
 * The configuration's data, as the pages' module exports it.
 *
 * @param config - the configuration.
 * @param frames - where the frames run: known on the dev server once both of its ports listen.
 */
export const configModule = (config: ResolvedConfig, frames: FramesPlacement): string => {
  const data: PageConfig = {
    title: config.title,
    heights: config.heights,
    switches: config.switches,
    languages: config.languages,
    lists: config.lists,
    frames
  };
  return `export default ${codeLiteral(data)};`;
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
      (specifier, index) => `import { source as source${index} } from ${codeLiteral(specifier)};`
    ),
    list: `[${specifiers.map((_specifier, index) => `source${index}`).join(", ")}]`
  };
};

/** The module the entry loads the written home's view from, on first use. */
export const WRITTEN_HOME_MODULE = "forgebook/shell/home";

/**
 * The shell's written home, as the entry writes it: loaded as the home opens, with its text, so a catalogue without
 * one pays nothing for it, and the shell's own code holds nothing of it.
 *
 * @param home - the home's absolute path.
 */
const writtenHomeCode = (home: string): string =>
  [
    "() =>",
    `      import(${codeLiteral(WRITTEN_HOME_MODULE)}).then((module) =>`,
    `        module.writtenHome(() => import(${codeLiteral(`${home}${HOME_QUERY}`)}).then((page) => page.default))`,
    "      )"
  ].join("\n");

/** The module the entry loads the code that draws the plugins' views from, on first use. */
export const PLUGIN_HOSTS_MODULE = "forgebook/shell/plugin-hosts";

/**
 * Whether a catalogue lists a plugin with a view in the shell: a tab or a docs block.
 *
 * @param config - the configuration.
 */
export const hasPluginViews = (config: ResolvedConfig): boolean =>
  config.plugins.some((plugin) => (plugin.tabs ?? []).length > 0 || (plugin.docBlocks ?? []).length > 0);

/**
 * The shell's list of the plugins' tabs and docs blocks, each with the import that loads its view when it is first
 * needed, and the loader of the code that draws them; nothing for a catalogue without any, whose entry is then what it
 * would be with no plugin and whose build holds none of that code.
 *
 * @param config - the configuration.
 */
const pluginViewLines = (config: ResolvedConfig): string[] => {
  const lines = config.plugins.flatMap((plugin) => {
    const tabs = (plugin.tabs ?? []).map(
      (tab) =>
        `{ id: ${codeLiteral(tab.id)}, label: ${codeLiteral(tab.label)}, ` +
        // a tab with no condition shows on every story: it has no `when` to write
        (tab.when === undefined ? "" : `when: ${codeLiteral(tab.when)}, `) +
        `load: () => import(${codeLiteral(tab.view)}) }`
    );
    const blocks = (plugin.docBlocks ?? []).map(
      (block) => `{ fence: ${codeLiteral(block.fence)}, load: () => import(${codeLiteral(block.view)}) }`
    );
    return tabs.length === 0 && blocks.length === 0
      ? []
      : [
          `      { id: ${codeLiteral(plugin.id)}, tabs: [${tabs.join(", ")}], docBlocks: [${blocks.join(", ")}] },`
        ];
  });
  return lines.length === 0
    ? []
    : [
        "    plugins: [",
        ...lines,
        "    ],",
        `    pluginHosts: () => import(${codeLiteral(PLUGIN_HOSTS_MODULE)}).then((module) => module.pluginHosts),`
      ];
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
    `import { codeOf } from ${codeLiteral(config.framework.pages.code)};`,
    `import config from ${codeLiteral(CONFIG_MODULE)};`,
    ...(config.logo === undefined ? [] : [`import logo from ${codeLiteral(`${config.logo}?url`)};`]),
    ...sources.imports,
    ...config.shell.styleSheets.map((file) => `import ${codeLiteral(file)};`),
    'const root = document.getElementById("root");',
    "if (root !== null)",
    "  mountShell(root, {",
    "    title: config.title,",
    ...(config.logo === undefined ? [] : ["    logo,"]),
    ...(config.shell.hasBranding ? [] : ["    hasBranding: false,"]),
    ...(config.heights === undefined ? [] : ["    heights: config.heights,"]),
    ...(config.home === undefined ? [] : [`    home: ${writtenHomeCode(config.home)},`]),
    `    sources: ${sources.list},`,
    '    frameUrl: "frame.html",',
    "    frames: config.frames,",
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    ...pluginViewLines(config),
    ...(config.framework.addressTexts === undefined
      ? []
      : [`    addressTexts: ${codeLiteral(config.framework.addressTexts)},`]),
    // a source may declare tokens of its own, read with the catalogue's
    ...(config.tokens.length === 0 && config.sources.length === 0
      ? []
      : [`    loadTokens: () => import(${codeLiteral(TOKENS_MODULE)}).then((module) => module.default),`]),
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
  const imports = PLAY_TOOLS_PACKAGES.map((name) => `import(${codeLiteral(name)})`).join(", ");
  return [
    "    playTools: async () => {",
    `      const [dom, events] = await Promise.all([${imports}]);`,
    "      return { within: dom.within, userEvent: events.userEvent };",
    "    },"
  ].join("\n");
};

/** How a frame's entry gets the address of axe's script (`axeScript.ts`). */
export type AxeAddress = {
  /** The imports it needs. */
  readonly imports: readonly string[];
  /** The expression that gives the address. */
  readonly value: string;
};

/**
 * What the frame's entry runs on a dev server to take the edits of its previews and of what they import, which the frame
 * draws in place (`hotModules.ts`); without it, an edit of a component a preview imports through a library's index
 * reloads every open page.
 *
 * @param previews - the previews' files, as the entry imports them.
 */
const previewsHot = (previews: readonly string[]): readonly string[] =>
  previews.length === 0
    ? []
    : [
        "if (import.meta.hot)",
        // plain JSON, unlike every other value here: Vite reads the accepted files as the text between the quotes,
        // escapes undecoded, and resolves an escaped path as no file; this module is never set inline in a page
        `  import.meta.hot.accept(${JSON.stringify(previews)}, (next) =>`,
        `    window.dispatchEvent(new CustomEvent(${codeLiteral(PREVIEWS_EVENT)}, { detail: { next } }))`,
        "  );"
      ];

/**
 * The frame's entry: the framework's frame mounted with the sources, the configuration's data and the previews.
 *
 * @param config - the configuration.
 * @param axe - how the entry gets the address of axe's script, for the Accessibility card; none when it cannot be
 *   found, which leaves the card to say so.
 */
export const frameEntry = (config: ResolvedConfig, axe?: AxeAddress): string => {
  const sources = sourcesCode(config);
  const frames = config.plugins.flatMap((plugin) => {
    const frame = pluginFrameModule(plugin, config.framework.name);
    return frame === undefined ? [] : [{ id: plugin.id, frame }];
  });
  return [
    `import { mountFrame } from ${codeLiteral(config.framework.pages.frame)};`,
    `import config from ${codeLiteral(CONFIG_MODULE)};`,
    ...(axe?.imports ?? []),
    ...sources.imports,
    ...config.previews.map((file, index) => `import * as preview${index} from ${codeLiteral(file)};`),
    ...frames.map(
      (plugin, index) => `import { frame as pluginFrame${index} } from ${codeLiteral(plugin.frame)};`
    ),
    'const root = document.getElementById("root");',
    "if (root !== null)",
    "  void mountFrame(root, {",
    `    sources: ${sources.list},`,
    ...(axe === undefined ? [] : [`    axeUrl: ${axe.value},`]),
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    "    frames: config.frames,",
    ...(config.hasPlayTools ? [playToolsLoader()] : []),
    ...(frames.length === 0
      ? []
      : [
          `    plugins: [${frames
            .map((plugin, index) => `{ id: ${codeLiteral(plugin.id)}, create: pluginFrame${index} }`)
            .join(", ")}],`
        ]),
    `    previews: [${config.previews.map((_file, index) => `preview${index}`).join(", ")}]`,
    "  });",
    ...previewsHot(config.previews),
    ""
  ].join("\n");
};

/**
 * The module the dev server loads to answer tools and agents: the sources the frame mounts (`sources`), with the same
 * imports the pages use. The previews are loaded beside it, each on its own (`previewRunner.ts`): a browser's code may
 * keep one from loading on the server.
 *
 * @param config - the configuration.
 */
export const agentSourcesModule = (config: ResolvedConfig): string => {
  const sources = sourcesCode(config);
  return [...sources.imports, `export const sources = ${sources.list};`, ""].join("\n");
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
        `import files${index} from ${codeLiteral(`./${pattern.replace(/^\.\//, "")}?forgebook-files`)};`
    ),
    ...config.docs.map(
      (pattern, index) =>
        `import docs${index} from ${codeLiteral(`./${pattern.replace(/^\.\//, "")}?forgebook-docs-pages`)};`
    ),
    "export const source = {",
    `  id: ${codeLiteral(OWN_SOURCE_ID)},`,
    `  name: ${codeLiteral(config.title)},`,
    `  files: [${config.stories.map((_pattern, index) => `files${index}`).join(", ")}],`,
    ...(config.docs.length === 0
      ? []
      : [`  docs: [${config.docs.map((_pattern, index) => `docs${index}`).join(", ")}],`]),
    "  sheets: { required: [], theme: [], restyled: [] }",
    "};",
    ""
  ].join("\n");
