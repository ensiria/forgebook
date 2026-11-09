/**
 * How `forgebook init` goes through a project's folders: which it skips, how many it reads at most, and a folder's
 * entries read without failing.
 *
 * @module
 */
import { type Dirent, readdirSync } from "node:fs";

/** The folders never searched: what is installed, built, or the tools' own. */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "public"
]);

/** How many folders a search goes through, so a huge repository's first run stays quick. */
export const SEARCH_LIMIT = 5000;

/**
 * A folder's entries; none for one the command may not read, which only leaves what it holds out.
 *
 * @param dir - the folder.
 */
export const readableEntries = (dir: string): readonly Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/**
 * Whether a search goes into a folder: not a hidden one, nor one it skips.
 *
 * @param entry - the folder's entry.
 */
export const isSearched = (entry: Dirent): boolean =>
  entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_FOLDERS.has(entry.name);
