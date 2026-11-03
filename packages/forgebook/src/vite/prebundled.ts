/**
 * The packages Vite pre-bundles, and the story files it scans, before the catalogue's first page opens, so the pages
 * never reload while they load.
 *
 * @remarks
 * Vite finds what to pre-bundle by scanning the app's HTML and entries on disk; a catalogue's pages and their entries
 * are generated (`pages.ts`), so without this list Vite discovers each package as a page imports it, pre-bundles it
 * then, and reloads the page, more than once on a first start. The list is the shell's and the frame's packages (the
 * shell is React), the framework's, Testing Library's when the project installs it, and Forgebook's own modules when
 * they come from an installed package (a linked one is source, which Vite does not pre-bundle). A package the project
 * cannot resolve is left out, since Vite fails on one it cannot find. Pure: a resolver in, names out.
 *
 * @module
 */
import { MOCKS_MODULES, PLAY_TOOLS_PACKAGES, type ResolvedConfig } from "./configFile.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** What the shell and the frame import in the browser from the project's packages (React is a peer of the core). */
const CORE_BROWSER_DEPENDENCIES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/client"
] as const;

/**
 * What the frame imports in the browser from the core's own dependencies: named through the core, as
 * `forgebook > axe-core`, since a project need not be able to resolve them itself.
 */
const CORE_OWN_DEPENDENCIES = ["axe-core"] as const;

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
 * @param resolveOwn - resolves a package from the core's own folder.
 */
export const prebundled = (config: ResolvedConfig, resolve: Resolve, resolveOwn: Resolve): string[] => {
  const pageModules = [...PAGE_MODULES, config.framework.pages.frame, config.framework.pages.code];
  const candidates = [
    ...CORE_BROWSER_DEPENDENCIES,
    ...(config.framework.browserDependencies ?? []),
    ...(config.hasPlayTools ? PLAY_TOOLS_PACKAGES : [])
  ];
  // named without resolving them: the browser module is browser-only, which Node cannot resolve though it is installed
  const mocks = config.hasMocks ? MOCKS_MODULES : [];
  const installedPages = pageModules.filter((name) => {
    const file = resolve(name);
    return file !== undefined && isInstalled(file);
  });
  const own = CORE_OWN_DEPENDENCIES.filter((name) => resolveOwn(name) !== undefined).map(
    (name) => `forgebook > ${name}`
  );
  return [
    ...new Set([
      ...candidates.filter((name) => resolve(name) !== undefined),
      ...mocks,
      ...own,
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
  // the previews too: what they import loads with the first story, and found then it reloads the page
  return [...config.stories, ...fromSources, ...config.previews];
};
