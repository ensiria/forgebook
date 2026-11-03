/**
 * Where the `forgebook` command keeps Node's compile cache: the Vite cache folder of the outermost `node_modules` its
 * installation sits in, so a package manager's nested store (`node_modules/.pnpm/…/node_modules/forgebook`) shares the
 * project's folder, and removing the project's `node_modules/.vite` empties it. Pure: a path in, a path out.
 *
 * @module
 */
import { join, parse, sep } from "node:path";

/** The folder name a package manager installs packages in. */
const DEPENDENCIES = "node_modules";

/**
 * The compile cache's folder for an installation of Forgebook.
 *
 * @param installed - the folder of the command's module, as Node loaded it.
 * @returns the folder, or none when Forgebook does not run from a `node_modules` (its own sources).
 */
export const compileCacheFolder = (installed: string): string | undefined => {
  const { root } = parse(installed);
  const parts = installed.slice(root.length).split(sep);
  const outermost = parts.indexOf(DEPENDENCIES);
  if (outermost < 0) return undefined;
  return join(root, ...parts.slice(0, outermost + 1), ".vite", "forgebook", "compile");
};
