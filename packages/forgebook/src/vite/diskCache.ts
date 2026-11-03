/**
 * What a dev server worked out once and need not work out again, kept on disk: a story file's component docs, its
 * code, a group's "Used in", a pattern's index; each with the paths it was made from, stamped as they were read.
 *
 * @remarks
 * A story's page reads its component's docs at once, and those need a TypeScript program: more memory than the rest of
 * the server. Kept here, a later start answers from a file and starts no worker until something changes.
 *
 * An entry is reused only while nothing it was made from changed:
 * - every path it depends on keeps its stamp (`stampPaths`): a file's change and modification times, size and inode;
 *   a folder's list of names, so a file added beside one an import found, which the import may now find, is a miss,
 *   while a save that replaces a file is not; a path that was missing must still be missing;
 * - the code that made it is the same (`codeStamp`): another version of Forgebook, of the framework's adapter or of
 *   the tools they read with, or an edit of their sources, is a miss.
 *
 * Paths are stamped once the answer is made, and an answer is kept only when none of them changed after its making
 * started (`isSettledSince`): an edit made while it was being read would otherwise be stamped beside the old answer.
 *
 * The folder sits in Vite's cache folder, so what clears that clears this. A cache that cannot be read or written is
 * only a slower start: every failure here is a miss.
 *
 * @module
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { join } from "node:path";

/** A disk cache of one kind of answer. */
export type DiskCache<TValue> = {
  /** The answer kept under a key, when everything it was made from is unchanged. */
  readonly read: (key: string) => TValue | undefined;
  /** Keeps an answer under a key, with the paths it was made from, stamped (`stampPaths`). */
  readonly write: (key: string, value: TValue, stamps: readonly PathStamp[]) => void;
};

/** A path and its stamp; `null` for a path that does not exist, which may appear later. */
export type PathStamp = readonly [path: string, stamp: string | null, changedAt: string | null];

/** One kept answer, as JSON. */
type CacheEntry = {
  /** The code that made it. */
  readonly code: string;
  /** The paths it depends on, as they were. */
  readonly paths: readonly PathStamp[];
  /** The answer. */
  readonly value: unknown;
};

/** The largest entry read back, in bytes: anything larger was not written here. */
const MOST_BYTES = 64 * 1024 * 1024;

/** Whether a value is a path's stamp. */
const isPathStamp = (value: unknown): value is PathStamp =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  (typeof value[1] === "string" || value[1] === null) &&
  (typeof value[2] === "string" || value[2] === null);

/** Whether a parsed file is an entry. */
const isEntry = (value: unknown): value is CacheEntry =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  typeof value.code === "string" &&
  "value" in value &&
  "paths" in value &&
  Array.isArray(value.paths) &&
  value.paths.every(isPathStamp);

/**
 * A path's stamp as it is now, with when it last changed (nanoseconds since the epoch, as a text).
 *
 * @param path - a file or a folder.
 */
const stampOf = (path: string): PathStamp => {
  const stats = statSync(path, { bigint: true, throwIfNoEntry: false });
  if (stats === undefined) return [path, null, null];
  if (!stats.isDirectory())
    return [path, `${stats.ctimeNs}:${stats.mtimeNs}:${stats.size}:${stats.ino}`, String(stats.ctimeNs)];
  const names = readdirSync(path).sort().join("\0");
  return [path, `dir:${createHash("sha256").update(names).digest("hex")}`, String(stats.ctimeNs)];
};

/**
 * The stamps of the paths an answer was made from, taken once it is made.
 *
 * @param paths - files and folders; repeats are stamped once.
 */
export const stampPaths = (paths: readonly string[]): PathStamp[] => [...new Set(paths)].map(stampOf);

/** The time now, in nanoseconds since the epoch: what `isSettledSince` compares a path's last change with. */
export const nowNs = (): bigint => BigInt(Date.now()) * 1_000_000n;

/**
 * Whether no path changed since an answer's making started: one that did may have been read before or after its
 * change, so the answer is not kept.
 *
 * @param stamps - the paths' stamps, taken once the answer was made.
 * @param since - when its making started (`nowNs`).
 */
export const isSettledSince = (stamps: readonly PathStamp[], since: bigint): boolean =>
  stamps.every(([, , changedAt]) => changedAt === null || BigInt(changedAt) < since);

/**
 * What the answers of a piece of code depend on besides their files: every file of its folders, and the manifests of
 * the packages it reads with, by stamp, so another version installed, or an edit of a source while developing it,
 * makes every kept answer a miss.
 *
 * @param folders - the folders of the code that makes the answers.
 * @param files - other files it depends on (the manifests of the parser, the compiler, the highlighter).
 */
export const codeStamp = (folders: readonly string[], files: readonly string[] = []): string => {
  const hash = createHash("sha256");
  for (const folder of [...new Set(folders)].sort()) {
    const names = readdirSync(folder, { recursive: true, encoding: "utf8" }).sort();
    for (const name of names) hash.update(`${name}\0${stampOf(join(folder, name))[1] ?? ""}\0`);
  }
  for (const file of [...new Set(files)].sort()) hash.update(`${file}\0${stampOf(file)[1] ?? ""}\0`);
  return hash.digest("hex");
};

/**
 * The text of an entry's file, when it is a plain file of a size this cache writes.
 *
 * @param path - the entry's file.
 */
const entryText = (path: string): string | undefined => {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined || !stats.isFile() || stats.size > MOST_BYTES) return undefined;
  return readFileSync(path, "utf8");
};

/**
 * Writes a file whole, in place of what was there: renamed into place, so a reader, or a server stopped halfway,
 * never meets half a file; created anew, so a link left in the folder is not followed.
 *
 * @param path - the file.
 * @param text - its text.
 */
const writeWhole = (path: string, text: string): void => {
  const partial = `${path}.${process.pid}.${Date.now()}`;
  try {
    const descriptor = openSync(partial, "wx");
    try {
      writeSync(descriptor, text);
    } finally {
      closeSync(descriptor);
    }
    renameSync(partial, path);
  } catch {
    // a cache that cannot be written is a slower next start; what was left half done goes
    try {
      unlinkSync(partial);
    } catch {
      // never created
    }
  }
};

/**
 * A cache in a folder.
 *
 * @param folder - the folder, created on the first write.
 * @param code - the stamp of the code that makes the answers (`codeStamp`): another one is a miss.
 * @param isValue - whether what was read is an answer: a file written by another version may hold anything.
 */
export const diskCache = <TValue>(
  folder: string,
  code: string,
  isValue: (value: unknown) => value is TValue & {}
): DiskCache<TValue> => {
  const path = (key: string): string =>
    join(folder, `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);
  return {
    read: (key: string): TValue | undefined => {
      try {
        const text = entryText(path(key));
        if (text === undefined) return undefined;
        const entry: unknown = JSON.parse(text);
        if (!isEntry(entry) || entry.code !== code) return undefined;
        const isFresh = entry.paths.every(([name, stamp]) => stampOf(name)[1] === stamp);
        return isFresh && isValue(entry.value) ? entry.value : undefined;
      } catch {
        return undefined;
      }
    },
    write: (key: string, value: TValue, stamps: readonly PathStamp[]): void => {
      const entry: CacheEntry = { code, paths: stamps, value };
      try {
        mkdirSync(folder, { recursive: true });
      } catch {
        return;
      }
      writeWhole(path(key), JSON.stringify(entry));
    }
  };
};
