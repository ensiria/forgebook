/**
 * A folder written as Vite writes its root: links followed and, on Windows, short names (`RUNNER~1`) written out in
 * full. The configuration's folder and the build's output are named this way, so they compare with Vite's root.
 *
 * @remarks
 * Vite reads its root with one of Node's two real paths on Windows, the plain one until a check it runs in the
 * background ends and the native one after: they agree only on a path already written out. A root that differs from
 * the folder the pages are named under makes the build's names climb out of it, and an output it does not see inside
 * it is never emptied.
 *
 * @module
 */
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * A folder's real path; for one not made yet, its nearest folder that is, with the rest of the path after it.
 *
 * @param folder - the folder, absolute.
 */
export const realFolder = (folder: string): string => {
  if (existsSync(folder)) return realpathSync.native(folder);
  const parent = dirname(folder);
  return parent === folder ? folder : join(realFolder(parent), basename(folder));
};
