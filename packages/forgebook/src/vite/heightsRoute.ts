/**
 * The dev server's answer for the stories' heights while they have not been measured: the configuration names the
 * file (`heights`), `forgebook-heights` writes it into the public folder, and until then the page asks for it on
 * every load.
 *
 * @remarks
 * A missing file is answered "no content" (204) instead of "not found": the shell reads it as no heights and waits at
 * a guess, as it does without the file, and the browser's console stays free of an error that asks nothing of the
 * user. Once the file exists, Vite serves it from the public folder as any other.
 *
 * @module
 */
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";

/** Where the heights' file is looked for. */
export type HeightsFile = {
  /** The file's address, relative to the pages (`story-heights.json`). */
  readonly heights: string;
  /** The pages' base path (`/`, or Vite's `base`). */
  readonly base: string;
  /** The public folder, or `false` when the project has none. */
  readonly publicDir: string | false;
};

/**
 * Whether a request asks for the heights' file while it does not exist.
 *
 * @param url - the request's path, with its query.
 * @param file - where the file is.
 * @param exists - whether a path exists; the file system's by default.
 */
export const isMissingHeights = (
  url: string,
  file: HeightsFile,
  exists: (path: string) => boolean = existsSync
): boolean => {
  const path = url.split("?")[0] ?? url;
  const base = file.base.endsWith("/") ? file.base : `${file.base}/`;
  if (path !== `${base}${file.heights}`) return false;
  return file.publicDir === false || !exists(join(file.publicDir, file.heights));
};

/**
 * The middleware that answers a request for the missing heights' file with no content.
 *
 * @param file - where the file is.
 */
export const missingHeightsMiddleware =
  (file: HeightsFile) =>
  (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    if (!isMissingHeights(request.url ?? "/", file)) {
      next();
      return;
    }
    response.statusCode = 204;
    response.setHeader("Cache-Control", "no-store");
    response.end();
  };
