/**
 * The packages Vite pre-bundles, and the story files it scans, before the catalogue's first page opens, so the pages
 * never reload while they load.
 *
 * @remarks
 * Vite finds what to pre-bundle by scanning the app's HTML and entries on disk; a catalogue's pages and their entries
 * are generated (`pages.ts`), so without this list Vite discovers each package as a page imports it, pre-bundles it
 * then, and reloads the page, more than once on a first start. The list is the shell's and the frame's packages (the
 * shell is React), the framework's, Testing Library's when the project installs it, what the plugins name, and
 * Forgebook's own modules and the plugins' when they come from an installed package (a linked one is source, which Vite
 * does not pre-bundle). axe is not among them: the frame loads it as a script (`axeScript.ts`). A package the project
 * cannot resolve is left out, since Vite fails on one it cannot find. Pure: a resolver in, names out.
 *
 * @module
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";

import { parseSync, type UserConfig } from "vite";

import { STORY_FILE } from "./autoTitle.ts";
import { PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { lineAndColumn } from "./lineAndColumn.ts";
import { hasPluginViews, PLUGIN_HOSTS_MODULE, WRITTEN_HOME_MODULE } from "./pages.ts";
import { pluginModules } from "./pluginConfig.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** What the shell and the frame import in the browser from the project's packages (React is a peer of the core). */
const CORE_BROWSER_DEPENDENCIES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/client"
] as const;

/** Forgebook's modules the generated pages import, besides the framework's. */
const PAGE_MODULES = ["forgebook/shell"] as const;

/**
 * Resolves a package as Node would from the catalogue's folder: its file's real path, or none when it is not there.
 *
 * @param name - the package or one of its subpaths.
 */
export type Resolve = (name: string) => string | undefined;

/** Whether a resolved file comes from an installed package rather than a linked one. */
const isInstalled = (file: string): boolean => file.split(/[\\/]/).includes("node_modules");

/**
 * The packages to pre-bundle for a catalogue.
 *
 * @param config - the catalogue's configuration.
 * @param resolve - resolves a package from the catalogue's folder.
 */
export const prebundled = (config: ResolvedConfig, resolve: Resolve): string[] => {
  const pageModules = [
    ...PAGE_MODULES,
    // imported on first use, so the scanner never sees it: named, or the first home would wait for the optimizer
    ...(config.home === undefined ? [] : [WRITTEN_HOME_MODULE]),
    ...(hasPluginViews(config) ? [PLUGIN_HOSTS_MODULE] : []),
    config.framework.pages.frame,
    config.framework.pages.code,
    ...pluginModules(config.plugins, config.framework.name)
  ];
  const candidates = [
    ...CORE_BROWSER_DEPENDENCIES,
    ...(config.framework.browserDependencies ?? []),
    ...(config.hasPlayTools ? PLAY_TOOLS_PACKAGES : [])
  ];
  // named without resolving them: a browser-only module (`msw/browser`) cannot be resolved by Node though it is installed
  const pluginDependencies = config.plugins.flatMap((plugin) => plugin.browserDependencies ?? []);
  const installedPages = pageModules.filter((name) => {
    const file = resolve(name);
    return file !== undefined && isInstalled(file);
  });
  return [
    ...new Set([
      ...candidates.filter((name) => resolve(name) !== undefined),
      ...pluginDependencies,
      ...installedPages
    ])
  ];
};

/** A `?forgebook-files` import of a source module: its pattern, before the query. */
const FILES_IMPORT = /["']([^"']+)\?forgebook-files["']/g;

/**
 * The story files Vite scans for what their components import, before the first page opens: the project's own
 * patterns, each source's, read from its module's `?forgebook-files` imports (relative to the module), and the
 * previews. A source the project cannot resolve, or read, adds none.
 *
 * @remarks
 * Without the sources' files, a package a source's stories import (`storybook/test`, a component's own dependency) is
 * found only when a page imports it, and the page reloads once.
 *
 * @param config - the catalogue's configuration.
 * @param resolve - resolves a source's module from the catalogue's folder.
 * @param readText - reads a file's text; none when it cannot.
 */
export const scannedEntries = (
  config: ResolvedConfig,
  resolve: Resolve,
  readText: (file: string) => string | undefined
): string[] => {
  const fromSources = config.sources.flatMap((specifier) => {
    const file = resolve(specifier);
    const text = file === undefined ? undefined : readText(file);
    if (file === undefined || text === undefined) return [];
    return [...text.matchAll(FILES_IMPORT)].flatMap((match) =>
      match[1] === undefined ? [] : [VITE_PATHS.join(VITE_PATHS.dirname(file), match[1])]
    );
  });
  // the previews too: what they import loads with the first story, and found then it reloads the page; the project's
  // `!` patterns stay as they are, which Vite's scanner reads as fast-glob does, from the same folder
  return [...config.stories, ...fromSources, ...config.previews];
};

/** Vite's options of its dependency scan. */
type ScanOptions = NonNullable<NonNullable<UserConfig["optimizeDeps"]>["rolldownOptions"]>;

/** A module the scan reads in place of a file's own text. */
type ScanModule = { code: string; moduleType: "js" | "jsx" };

/** Where the scan's warnings go. */
export type ScanWarnings = {
  /** The catalogue's folder: a warning names a file relative to it; absolute without it. */
  readonly root?: string;
  /** Writes one warning line; none are written without it. */
  readonly warn?: (line: string) => void;
};

/** A project's script: JavaScript or TypeScript, with or without JSX. */
const SCRIPT = /\.[cm]?[jt]sx?$/;

/** A file of an installed package, which the scan does not read past its imports. */
const INSTALLED = /[\\/]node_modules[\\/]/;

/** A script whose extension says nothing about JSX. */
const PLAIN_SCRIPT = /\.[cm]?js$/;

/**
 * What the scan reads for one of the project's scripts: nothing in its place when it parses (the scan reads it), the
 * same text read as JSX when only JSX makes it parse, and an empty module when it does not parse at all.
 *
 * @param file - the script's path as a message names it; its extension decides TypeScript and JSX.
 * @param text - its source.
 * @returns the module to scan, or none to let the scan read the file, and the parse error of a file that does not parse.
 */
export const scannedScript = (
  file: string,
  text: string
): { module: ScanModule | undefined; error: string | undefined } => {
  const { errors } = parseSync(file, text);
  const [error] = errors;
  if (error === undefined) return { module: undefined, error: undefined };
  // a `.js` file holding JSX, as libraries that write their stories in JavaScript do: its imports still count
  if (PLAIN_SCRIPT.test(file) && parseSync(file, text, { lang: "jsx" }).errors.length === 0) {
    return { module: { code: text, moduleType: "jsx" }, error: undefined };
  }
  const [label] = error.labels;
  const place = label === undefined ? file : `${file}:${lineAndColumn(text, label.start)}`;
  return { module: { code: "", moduleType: "js" }, error: `${place}: ${error.message}` };
};

/**
 * Keeps Vite's dependency scan going past one of the project's scripts that does not parse, a story file or a
 * component, and reads a `.js` file holding JSX as JSX. One such file otherwise stops the scan, and with it the
 * pre-bundling of every other story's packages, and fills the log with the scanner's stack; the pages then reload as
 * each package is found. A script that does not parse adds nothing to what the scan finds: a story file is named by
 * the catalogue itself (`storyFilesModule.ts`), any other by one warning with its place, and by the frame of each
 * story that imports it. The texts are read here on the scan only: a start that keeps its pre-bundled packages does
 * not scan.
 *
 * @param options - the catalogue's folder, which the warnings' places are relative to, and what writes a warning line
 * for a script, other than a story file, that does not parse.
 */
export const scanOptions = (options: ScanWarnings = {}): ScanOptions => {
  // the scan names files by their real path: a folder reached through a link (`/tmp` on macOS) would not prefix them
  const root =
    options.root === undefined || !existsSync(options.root) ? undefined : realpathSync(options.root);
  return {
    plugins: [
      {
        name: "forgebook:scan-scripts",
        load: {
          filter: { id: { include: SCRIPT, exclude: INSTALLED } },
          handler: (id: string): ScanModule | null => {
            // an id that names no file (a plugin's own module) is not this hook's to answer
            if (!existsSync(id)) return null;
            const shown = root === undefined ? id : VITE_PATHS.relative(root, id);
            const { module, error } = scannedScript(shown, readFileSync(id, "utf8"));
            if (error !== undefined && !STORY_FILE.test(id)) {
              options.warn?.(`The dependency scan skipped ${error}`);
            }
            return module ?? null;
          }
        }
      }
    ]
  };
};
