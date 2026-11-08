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

import type { UserConfig } from "vite";

import { STORY_FILE } from "./autoTitle.ts";
import { PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { hasPluginViews, PLUGIN_HOSTS_MODULE, WRITTEN_HOME_MODULE } from "./pages.ts";
import { pluginModules } from "./pluginConfig.ts";
import { REFS_MODULE } from "./refsConfig.ts";
import { INSTALLED, parsedScript, SCRIPT, type ScriptProblems } from "./scriptProblems.ts";
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
    ...(config.refs.length === 0 ? [] : [REFS_MODULE]),
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

/**
 * What the scan reads for one of the project's scripts: nothing in its place when it parses (the scan reads it), the
 * same text read as JSX when only JSX makes a `.js` file parse, and its imports alone when it does not parse at all,
 * which the parser still finds, so their packages are pre-bundled with the rest.
 *
 * @param file - the script's path; its extension decides TypeScript and JSX.
 * @param text - its source.
 * @returns the module to scan, or none to let the scan read the file, and why the file does not parse.
 */
export const scannedScript = (
  file: string,
  text: string
): { module: ScanModule | undefined; problem: string | undefined } => {
  const { imports, isJsx, problem } = parsedScript(file, text);
  if (isJsx) return { module: { code: text, moduleType: "jsx" }, problem };
  if (problem === undefined) return { module: undefined, problem };
  const code = imports.map((name) => `import ${JSON.stringify(name)};`).join("\n");
  return { module: { code, moduleType: "js" }, problem };
};

/** Where the scan's findings go. */
export type ScanFindings = {
  /** The catalogue's folder: a warning names a file relative to it; absolute without it. */
  readonly root?: string;
  /** Writes one warning line; none are written without it. */
  readonly warn?: (line: string) => void;
  /** Keeps what the scan found of each of the project's scripts, other than story files (`scriptProblems.ts`). */
  readonly scanned?: ScriptProblems["scanned"];
  /**
   * Whether every `.js` file is read as JSX, for a framework whose adapter compiles their JSX (`compilesJsxInScripts`):
   * JSX is a superset of what such a file may hold, so the others give the same imports. Without it, only a file that
   * parses as nothing else is.
   */
  readonly isJsxInScripts?: boolean;
  /**
   * Whether the scan reads only the story files here and leaves every other script to the scanner, which parses it
   * itself: a first start's pre-bundling tries that first, since reading and parsing every component a second time in
   * JavaScript costs a large library a quarter of a second, and scans again without it only when a script stops the
   * scan (`prebundleRun.ts`). A server's own scan reads them all.
   */
  readonly isQuick?: boolean;
};

/**
 * Whether the scan reads a script here rather than leave it to the scanner: a quick scan reads the story files alone,
 * whose problems the catalogue names as they are edited, and an id that names no file (a plugin's own module) is not
 * the scan's to answer.
 *
 * @param id - the module's id.
 * @param isQuick - whether the scan is a quick one (`ScanFindings.isQuick`).
 */
const isReadHere = (id: string, isQuick: boolean): boolean =>
  (!isQuick || STORY_FILE.test(id)) && existsSync(id);

/**
 * The warnings this process wrote: a first start's pre-bundling scans again after leaving out an import it could not
 * resolve (`prebundleRun.ts`), and a file is named once.
 */
const WARNED = new Set<string>();

/**
 * Keeps Vite's dependency scan going past one of the project's scripts that does not parse, a story file or a
 * component, and reads a `.js` file holding JSX as JSX. One such file otherwise stops the scan, and with it the
 * pre-bundling of every other story's packages, and fills the log with the scanner's stack; the pages then reload as
 * each package is found. A script that does not parse is read as its imports alone: a story file is named by the
 * catalogue itself (`storyFilesModule.ts`), any other is kept among the index's problems (`scriptProblems.ts`) and
 * named by one warning with its place. The texts are read here on the scan only: a start that keeps its pre-bundled
 * packages does not scan.
 *
 * @param findings - the catalogue's folder, where warnings and problems go, and whether `.js` is read as JSX.
 */
export const scanOptions = (findings: ScanFindings = {}): ScanOptions => {
  // the scan names files by their real path: a folder reached through a link (`/tmp` on macOS) would not prefix them
  const root =
    findings.root === undefined || !existsSync(findings.root) ? undefined : realpathSync(findings.root);
  return {
    ...(findings.isJsxInScripts === true ? { moduleTypes: { ".js": "jsx", ".mjs": "jsx" } } : {}),
    plugins: [
      {
        name: "forgebook:scan-scripts",
        load: {
          filter: { id: { include: SCRIPT, exclude: INSTALLED } },
          handler: (id: string): ScanModule | null => {
            if (!isReadHere(id, findings.isQuick === true)) return null;
            const file = VITE_PATHS.normalize(id);
            const { module, problem } = scannedScript(file, readFileSync(id, "utf8"));
            if (STORY_FILE.test(id)) return module ?? null;
            findings.scanned?.(file, problem);
            if (problem !== undefined) {
              const shown = root === undefined ? file : VITE_PATHS.relative(root, file);
              const line = `The dependency scan skipped ${problem.replace(file, shown)}`;
              if (!WARNED.has(line)) findings.warn?.(line);
              WARNED.add(line);
            }
            return module ?? null;
          }
        }
      }
    ]
  };
};
