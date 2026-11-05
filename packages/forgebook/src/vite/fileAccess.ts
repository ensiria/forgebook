/**
 * What a dev server's plugin may read for a client, by Vite's own `server.fs` and by what the project imports: a
 * plugin's answer never passes through Vite's check, so each read an address can name asks here first.
 *
 * @remarks
 * Vite's rule is two steps. The first refuses a file whatever else holds (`server.fs.deny`, a path it will not trust).
 * Past it, a file is served when `allow` covers it or a module of the project imports it. A group of story files or
 * docs pages is what a module of the project imports, so it keeps to the first step alone: a catalogue's `../src` may be
 * outside `allow`, and Vite serves its files all the same. A query names one file in the address, so it asks both steps:
 * Vite has recorded the file by then if a module imports it.
 *
 * A group's id holds its patterns, so an id alone must never choose what is read: any address could name a folder to
 * list and read, and the imports the group's module writes would make Vite serve every file listed, past `allow`.
 *
 * A group is named by a module's import, which the plugin sees when Vite transforms that module. A client may ask before
 * that: a tab left open across a restart holds its modules and asks for a search index first. So a request for a group
 * no import has named waits, before Vite starts on it, for the server to read what the configuration's sources import,
 * the same modules a page would load: inside the group's load the reading could wait for a request that waits for it. A
 * cache of transforms would hide the import for good, and Vitest keeps one on disk between runs: a module that names a
 * group stays out of it.
 *
 * A group no module names answers as a missing file does: Vite answers 404, keeps no module to renew and raises no
 * overlay on the pages open. A module's `export default null` would read as a group, and fail far from here in whatever
 * reads it.
 *
 * @module
 */
import { realpathSync } from "node:fs";
import { join } from "node:path";

import {
  type DevEnvironment,
  type EnvironmentModuleNode,
  isCSSRequest,
  isFileLoadingAllowed,
  type ResolvedConfig,
  type ViteDevServer
} from "vite";

import { isGroupId, namesGroup, namingGroupOf } from "./pluginIds.ts";
import type { IsFileKept } from "./storyFilesModule.ts";
import {
  CODE_QUERY,
  DOCS_PAGE_QUERY,
  DOCS_QUERY,
  HOME_QUERY,
  MARKDOWN_QUERY,
  PAGE_QUERY
} from "./textQueries.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** The queries the plugin answers with a file's text, so each read keeps to what the dev server may serve. */
const FILE_QUERIES: readonly string[] = [
  DOCS_QUERY,
  CODE_QUERY,
  PAGE_QUERY,
  MARKDOWN_QUERY,
  DOCS_PAGE_QUERY,
  HOME_QUERY
];

/**
 * A listed file's real path, in Vite's form. Vite refuses a Windows short name (`RUNNER~1`), which could dodge `deny`,
 * and a system's temporary folder is often written with one: the long name lets the file be judged by what it is. So
 * does a link's target, which is the file that would be read.
 *
 * @param file - the file, absolute.
 */
const realFile = (file: string): string => {
  try {
    return VITE_PATHS.normalize(realpathSync.native(file));
  } catch {
    return file;
  }
};

/**
 * Whether Vite refuses a listed file whatever `server.fs.allow` says: `deny`, or a path it will not trust (a `:` in it).
 * Vite offers no check of this step alone, so this asks its whole check with an `allow` that covers the file.
 *
 * @param config - the dev server's configuration.
 * @param file - the file, absolute in Vite's form.
 */
export const isFileRefused = (config: ResolvedConfig, file: string): boolean => {
  const real = realFile(file);
  const fs = { ...config.server.fs, allow: [VITE_PATHS.dirname(real)] };
  return !isFileLoadingAllowed({ ...config, server: { ...config.server, fs } }, real);
};

/**
 * Whether a dev server may read the file a query's id names. An id Vite resolved is normalised; one with a `..` came
 * from an address unresolved, and Vite's check reads a path as written, so `/project/../secret` would pass for a file
 * of `/project`.
 *
 * @param config - the dev server's configuration.
 * @param id - the module's id, the file and then its query.
 */
export const isQueriedFileReadable = (config: ResolvedConfig, id: string): boolean => {
  const file = id.slice(0, id.lastIndexOf("?"));
  return VITE_PATHS.normalize(file) === file && isFileLoadingAllowed(config, file);
};

/**
 * Whether reading a module can show an import of a group: not a group (reading one waits for this reading) nor a file's
 * query, which reads no import; not a style sheet or a pre-bundled dependency, which import none.
 *
 * @param environment - the environment the module is read in.
 * @param module - the module.
 */
const mayNameGroup = (environment: DevEnvironment, module: EnvironmentModuleNode): boolean => {
  const { id, url } = module;
  return (
    id !== null &&
    !isCSSRequest(url) &&
    !isGroupId(id) &&
    !FILE_QUERIES.some((query) => id.endsWith(query)) &&
    environment.depsOptimizer?.isOptimizedDepUrl(url) !== true
  );
};

/**
 * Reads a module and what it imports, for the imports the plugin sees on the way.
 *
 * @param environment - the environment to read them in.
 * @param entry - the module's address.
 * @returns whether each could be read: one that could not may name a group once it is fixed.
 */
const readImports = async (environment: DevEnvironment, entry: string): Promise<boolean> => {
  const seen = new Set<string>([entry]);
  const read = async (url: string): Promise<boolean> => {
    try {
      await environment.transformRequest(url);
    } catch {
      return false;
    }
    const module = await environment.moduleGraph.getModuleByUrl(url);
    const next = [...(module?.importedModules ?? [])].filter(
      (imported) => !seen.has(imported.url) && mayNameGroup(environment, imported)
    );
    for (const imported of next) seen.add(imported.url);
    const reads = await Promise.all(next.map((imported) => read(imported.url)));
    return reads.every(Boolean);
  };
  return read(entry);
};

/**
 * The id of the group a request's address names, when it names one: any spelling this misses reaches the plugin's load,
 * which refuses it all the same.
 *
 * @param url - the request's address.
 */
const groupIdOf = (url: string): string | undefined => {
  try {
    const path = decodeURI(url.split("?")[0] ?? "");
    const at = path.indexOf("virtual:forgebook-");
    return at === -1 ? undefined : `\0${path.slice(at)}`;
  } catch {
    return undefined;
  }
};

/** Vite's code for a file it could not load: its server answers 404, with no overlay, and a runner fails with the text. */
const MISSING_MODULE = "ERR_LOAD_URL";

/** What a plugin's dev server lets a client read: `devServerAccess` makes it. */
export type DevServerAccess = {
  /**
   * Starts on a dev server; until then (and in a build, which has none) nothing is refused.
   *
   * @param server - the dev server.
   * @param sources - the module that imports the configuration's sources; none without a configuration.
   */
  readonly serve: (server: ViteDevServer, sources: string | undefined) => void;
  /**
   * Whether a resolver's importer is a module, not the stand-in Vite gives an address asked for directly.
   *
   * @param importer - the importer the resolver was given.
   */
  readonly isModule: (importer: string | undefined) => importer is string;
  /**
   * Notes that a module imports a group, whose id is now served.
   *
   * @param id - the group module's id.
   */
  readonly noteImported: (id: string) => void;
  /** Whether a file a group lists may be read; says so once when not, as nothing else would tell why it is missing. */
  readonly isKept: IsFileKept;
  /**
   * Holds a request for a group no import has named until the configuration's sources have been read.
   *
   * @param url - the request's address.
   */
  readonly settle: (url: string) => Promise<void>;
  /**
   * What the plugin's load answers for a file's query `server.fs` refuses: an empty module and not Vite's 404, as Vite
   * would then read a path with a `..` as written, past the check that refused it. Asked of every id, since an address
   * can name an id directly, past the plugin's `resolveId`.
   *
   * @param id - the module's id.
   * @returns the module, or none when the client may read the id.
   * @throws for a group no module of the project imports, with Vite's code for a missing file.
   */
  readonly refusal: (id: string) => { readonly code: string; readonly moduleType: "js" } | undefined;
};

/** What a plugin's dev server lets a client read. */
export const devServerAccess = (): DevServerAccess => {
  let devServer: ViteDevServer | undefined;
  let addressImporter: string | undefined;
  let sourcesEntry: string | undefined;
  /** The reading of the sources: once, as an edit that names a new group is seen when Vite transforms it. */
  let sourcesRead: Promise<void> | undefined;
  const imported = new Set<string>();
  return {
    serve: (server: ViteDevServer, sources: string | undefined): void => {
      devServer = server;
      addressImporter = join(server.config.root, "index.html");
      sourcesEntry = sources;
      sourcesRead = undefined;
    },
    isModule: (importer: string | undefined): importer is string =>
      importer !== undefined && importer !== addressImporter,
    noteImported: (id: string): void => {
      imported.add(namingGroupOf(id));
    },
    isKept: (file: string): boolean => {
      if (devServer === undefined || !isFileRefused(devServer.config, file)) return true;
      devServer.config.logger.warnOnce(`Forgebook leaves out ${file}: Vite's server.fs refuses it`);
      return false;
    },
    settle: async (url: string): Promise<void> => {
      const id = groupIdOf(url);
      if (id === undefined || devServer === undefined || sourcesEntry === undefined) return;
      if (imported.has(namingGroupOf(id))) return;
      sourcesRead ??= readImports(devServer.environments.client, sourcesEntry).then((isRead) => {
        if (!isRead) sourcesRead = undefined;
      });
      await sourcesRead;
    },
    refusal: (id: string): { readonly code: string; readonly moduleType: "js" } | undefined => {
      if (devServer === undefined) return undefined;
      if (!isGroupId(id))
        return FILE_QUERIES.some((query) => id.endsWith(query)) &&
          !isQueriedFileReadable(devServer.config, id)
          ? { code: "export default null;", moduleType: "js" }
          : undefined;
      if (imported.has(namingGroupOf(id))) return undefined;
      throw Object.assign(
        new Error(
          `Forgebook serves a group of files only when a module imports it: no module of the project imports ${id.slice(1)}`
        ),
        { code: MISSING_MODULE }
      );
    }
  };
};

/**
 * The plugin's hook for Vitest (`configureVitest`), whose module cache keeps each module's transform on disk between
 * runs: a module read from it resolves no import, so a group it names would stay refused from the second run on.
 */
export const VITEST_HOOKS = {
  configureVitest: (context: {
    readonly defineCacheKeyGenerator?: (
      generator: (module: { readonly sourceCode: string }) => false | undefined
    ) => void;
  }): void => {
    context.defineCacheKeyGenerator?.(({ sourceCode }) => (namesGroup(sourceCode) ? false : undefined));
  }
};
