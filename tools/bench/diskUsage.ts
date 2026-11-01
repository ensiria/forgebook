/**
 * The space a folder takes on disk, as `du` counts it: what a person sees of an install.
 *
 * @module
 */
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/** The size of a block in `stat`'s count, fixed by POSIX whatever the file system's own. */
const STAT_BLOCK = 512;

/**
 * The bytes a folder takes on disk.
 *
 * @param path - the folder or file; links count as themselves.
 */
export const diskUsage = async (path: string): Promise<number> => {
  const entry = await lstat(path);
  if (!entry.isDirectory()) return entry.blocks * STAT_BLOCK;
  const names = await readdir(path);
  const sizes = await Promise.all(names.map((name) => diskUsage(join(path, name))));
  return sizes.reduce((sum, size) => sum + size, entry.blocks * STAT_BLOCK);
};
