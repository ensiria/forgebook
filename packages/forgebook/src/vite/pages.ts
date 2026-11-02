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

import type { PageConfig } from "../pageConfig.ts";
import { PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { pluginFrameModule } from "./pluginConfig.ts";

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
    ...(config.heights === undefined ? [] : ["    heights: config.heights,"]),
    `    sources: ${sources.list},`,
    '    frameUrl: "frame.html",',
    "    languages: config.languages,",
    ...(config.switches === undefined ? [] : ["    switches: config.switches,"]),
    "    lists: config.lists,",
    ...pluginViewLines(config),
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
