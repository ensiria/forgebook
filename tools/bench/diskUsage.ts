/**
 * The size of a folder: on disk, as `du` counts it, which is what a person sees of an install; and of its content.
 *
 * @module
 */
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/** The size of a block in `stat`'s count, fixed by POSIX whatever the file system's own. */
const STAT_BLOCK = 512;

/**
 * The bytes of a folder's files: what a build hands a host, whatever the disk's block size.
 *
 * @param path - the folder or file.
 */
export const contentSize = async (path: string): Promise<number> => {
  const entry = await lstat(path);
  if (!entry.isDirectory()) return entry.size;
  const names = await readdir(path);
  const sizes = await Promise.all(names.map((name) => contentSize(join(path, name))));
  return sizes.reduce((sum, size) => sum + size, 0);
};

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
