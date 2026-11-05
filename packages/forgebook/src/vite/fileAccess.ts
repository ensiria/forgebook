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
 * @module
 */
import { join } from "node:path";

import { isFileLoadingAllowed, type ResolvedConfig, type ViteDevServer } from "vite";

import { isGroupId } from "./pluginIds.ts";
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
 * Whether Vite refuses a file whatever `server.fs.allow` says: `deny`, or a path it will not trust (a `:` in it). Vite
 * offers no check of this step alone, so this asks its whole check with an `allow` that covers the file.
 *
 * @param config - the dev server's configuration.
 * @param file - the file, absolute in Vite's form.
 */
export const isFileRefused = (config: ResolvedConfig, file: string): boolean => {
  const fs = { ...config.server.fs, allow: [VITE_PATHS.dirname(file)] };
  return !isFileLoadingAllowed({ ...config, server: { ...config.server, fs } }, file);
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

/** What a plugin's dev server lets a client read: `devServerAccess` makes it. */
export type DevServerAccess = {
  /** Starts on a dev server; until then (and in a build, which has none) nothing is refused. */
  readonly serve: (server: ViteDevServer) => void;
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
   * Whether a module is answered with nothing: a group no module imported, or a file `server.fs` refuses. Asked of every
   * id, since an address can name an id directly, past the plugin's `resolveId`.
   *
   * @param id - the module's id.
   */
  readonly isRefused: (id: string) => boolean;
};

/**
 * What a plugin's dev server lets a client read.
 *
 * @param renew - renews modules Vite keeps: a group refused before its first import would otherwise stay empty.
 */
export const devServerAccess = (
  renew: (server: ViteDevServer, ids: Iterable<string>) => void
): DevServerAccess => {
  let devServer: ViteDevServer | undefined;
  let addressImporter: string | undefined;
  const imported = new Set<string>();
  const refused = new Set<string>();
  return {
    serve: (server: ViteDevServer): void => {
      devServer = server;
      addressImporter = join(server.config.root, "index.html");
    },
    isModule: (importer: string | undefined): importer is string =>
      importer !== undefined && importer !== addressImporter,
    noteImported: (id: string): void => {
      imported.add(id);
      if (refused.delete(id) && devServer !== undefined) renew(devServer, [id]);
    },
    isKept: (file: string): boolean => {
      if (devServer === undefined || !isFileRefused(devServer.config, file)) return true;
      devServer.config.logger.warnOnce(`Forgebook leaves out ${file}: Vite's server.fs refuses it`);
      return false;
    },
    isRefused: (id: string): boolean => {
      if (devServer === undefined) return false;
      if (!isGroupId(id))
        return (
          FILE_QUERIES.some((query) => id.endsWith(query)) && !isQueriedFileReadable(devServer.config, id)
        );
      if (imported.has(id)) return false;
      refused.add(id);
      return true;
    }
  };
};
