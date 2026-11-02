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
import { join } from "node:path";

import { LOAD_RELOADS_KEY } from "../frame/staleModule.ts";
import type { FramesPlacement } from "../frameOrigins.ts";
import { PREVIEWS_EVENT } from "../hotModules.ts";
import type { PageConfig } from "../pageConfig.ts";
import { PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { pluginFrameModule } from "./pluginConfig.ts";

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
 * sources and the previews, as the frame gets them (never written to disk).
 */
export const AGENT_SOURCES_FILE = ".forgebook-agent.ts";

/** The project's own stories' source id. */
export const OWN_SOURCE_ID = "stories";

/**
 * Text set in HTML: its `<`, `>`, `&` and quotes escaped.
 *
 * @param text - the text.
 */
const escaped = (text: string): string =>
  text.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * What a frame shows when its code fails before the frame starts: a preview or a source that throws while it loads, or
 * that cannot be loaded at all. The frame's own code never runs then, so without this the frame stayed blank for good,
 * and its shell waited. Plain script in the page, since a module that failed cannot report anything; it stands down
 * once the frame has started (`FRAME_STARTED_ATTRIBUTE`), when the frame shows its own errors. Code that could not be
 * loaded is loaded again first, up to three times, one, two then four seconds later, counted in the session's storage
 * until the frame draws its story (`staleModule.ts` clears the count): in development a library served as source asks
 * for thousands of modules, and the browser refuses some while the other frames load (`ERR_INSUFFICIENT_RESOURCES`).
 * Its error goes to the page that holds the frame, by that page's origin (`location.ancestorOrigins`, else the
 * referrer's), since the frame may run on an origin of its own and the frame's code that knows the catalogue's never
 * ran; it holds the error's text only, which the frame shows anyway.
 */
const FRAME_LOAD_GUARD = `(function () {
  var RELOAD_DELAY = 1000;
  var RELOADS = 3;
  var root = document.documentElement;
  function show(message) {
    if (root.hasAttribute("data-forgebook-started") || root.hasAttribute("data-forgebook-status")) return;
    var box = document.createElement("div");
    box.className = "forgebook-frame-error";
    box.setAttribute("role", "alert");
    var text = document.createElement("p");
    text.className = "forgebook-frame-error__message";
    text.textContent = message;
    box.appendChild(text);
    document.getElementById("root").replaceChildren(box);
    root.setAttribute("data-forgebook-status", "error");
    var storyId = new URLSearchParams(location.search).get("story") || "";
    var shell = parentOrigin();
    if (parent !== window && shell !== null) parent.postMessage({ type: "forgebook:error", storyId: storyId, message: message }, shell);
  }
  function parentOrigin() {
    try {
      if (location.ancestorOrigins && location.ancestorOrigins.length > 0) return location.ancestorOrigins[0];
      return document.referrer === "" ? null : new URL(document.referrer).origin;
    } catch (error) {
      return null;
    }
  }
  function reloadAgain() {
    var done;
    try {
      var key = "${LOAD_RELOADS_KEY}" + location.href;
      done = Number(sessionStorage.getItem(key) || "0");
      if (done >= RELOADS) return false;
      sessionStorage.setItem(key, String(done + 1));
    } catch (error) {
      return false;
    }
    setTimeout(function () { location.reload(); }, RELOAD_DELAY * Math.pow(2, done));
    return true;
  }
  addEventListener("error", function (event) {
    var target = event.target;
    if (target && target.tagName === "SCRIPT") {
      if (root.hasAttribute("data-forgebook-started") || reloadAgain()) return;
      show("The catalogue's code could not be loaded (" + target.src + "): see the console");
      return;
    }
    show("The catalogue's code failed while it loaded: " + (event.error && event.error.message ? event.error.message : event.message));
  }, true);
})();`;

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
    ...(page === "frame.html" ? [`    <script>${FRAME_LOAD_GUARD}</script>`] : []),
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
  return `export default ${JSON.stringify(data)};`;
};

/**
 * The imports of the sources, and the list they make: the project's own stories first, then each package's.
 *
 * @param config - the configuration.
 */
const sourcesCode = (config: ResolvedConfig): { readonly imports: string[]; readonly list: string } => {
  const hasOwn = config.stories.length > 0 || config.docs.length > 0;
  const own = hasOwn ? [`./${STORIES_SOURCE_FILE}`] : [];
  const specifiers = [...own.map((file) => join(config.dir, file.slice(2))), ...config.sources];
  return {
    imports: specifiers.map(
      (specifier, index) => `import { source as source${index} } from ${JSON.stringify(specifier)};`
    ),
    list: `[${specifiers.map((_specifier, index) => `source${index}`).join(", ")}]`
  };
};

/**
 * The shell's list of the plugins' tabs and docs blocks, each with the import that loads its view when it is first
 * needed; nothing for a catalogue without any, whose entry is then what it would be with no plugin.
 *
 * @param config - the configuration.
 */
const pluginViewLines = (config: ResolvedConfig): string[] => {
  const lines = config.plugins.flatMap((plugin) => {
    const tabs = (plugin.tabs ?? []).map(
      (tab) =>
        `{ id: ${JSON.stringify(tab.id)}, label: ${JSON.stringify(tab.label)}, ` +
        `when: ${JSON.stringify(tab.when)}, load: () => import(${JSON.stringify(tab.view)}) }`
    );
    const blocks = (plugin.docBlocks ?? []).map(
      (block) =>
        `{ fence: ${JSON.stringify(block.fence)}, load: () => import(${JSON.stringify(block.view)}) }`
    );
    return tabs.length === 0 && blocks.length === 0
      ? []
      : [
          `      { id: ${JSON.stringify(plugin.id)}, tabs: [${tabs.join(", ")}], docBlocks: [${blocks.join(", ")}] },`
        ];
  });
  return lines.length === 0 ? [] : ["    plugins: [", ...lines, "    ],"];
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
    "    frames: config.frames,",
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    ...pluginViewLines(config),
    ...(config.tokens.length === 0
      ? []
      : [`    loadTokens: () => import(${JSON.stringify(TOKENS_MODULE)}).then((module) => module.default),`]),
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

/** How a frame's entry gets the address of axe's script. */
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
        `  import.meta.hot.accept(${JSON.stringify(previews)}, (next) =>`,
        `    window.dispatchEvent(new CustomEvent(${JSON.stringify(PREVIEWS_EVENT)}, { detail: { next } }))`,
        "  );"
      ];

/**
 * The frame's entry: the framework's frame mounted with the sources, the configuration's data and the previews.
 *
 * @param config - the configuration.
 * @param axe - how the entry gets the address of axe's script, when it can be found.
 */
export const frameEntry = (config: ResolvedConfig, axe?: AxeAddress): string => {
  const sources = sourcesCode(config);
  const frames = config.plugins.flatMap((plugin) => {
    const frame = pluginFrameModule(plugin, config.framework.name);
    return frame === undefined ? [] : [{ id: plugin.id, frame }];
  });
  return [
    `import { mountFrame } from ${JSON.stringify(config.framework.pages.frame)};`,
    `import config from ${JSON.stringify(CONFIG_MODULE)};`,
    ...(axe?.imports ?? []),
    ...sources.imports,
    ...config.previews.map((file, index) => `import * as preview${index} from ${JSON.stringify(file)};`),
    ...frames.map(
      (plugin, index) => `import { frame as pluginFrame${index} } from ${JSON.stringify(plugin.frame)};`
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
            .map((plugin, index) => `{ id: ${JSON.stringify(plugin.id)}, create: pluginFrame${index} }`)
            .join(", ")}],`
        ]),
    `    previews: [${config.previews.map((_file, index) => `preview${index}`).join(", ")}]`,
    "  });",
    ...previewsHot(config.previews),
    ""
  ].join("\n");
};

/**
 * The module the dev server loads to answer tools and agents: the sources the frame mounts, and a loader for each of
 * its previews, which a browser's code may keep from loading on the server (`sources`, `previews`), with the same
 * imports the pages use.
 *
 * @param config - the configuration.
 */
export const agentSourcesModule = (config: ResolvedConfig): string => {
  const sources = sourcesCode(config);
  return [
    ...sources.imports,
    `export const sources = ${sources.list};`,
    `export const previews = [${config.previews.map((file) => `() => import(${JSON.stringify(file)})`).join(", ")}];`,
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
