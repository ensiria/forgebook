/**
 * What a dev server worked out once and need not work out again, kept on disk: a story file's component docs and its
 * code, each with the files it was read from.
 *
 * @remarks
 * A story's page reads its component's docs at once, and those need a TypeScript program: more memory than the rest of
 * the server. Kept here, a later start answers from a file and starts no worker until a source changes. An entry holds
 * the time of every file it depends on, compared on each read, so an edit made while no server ran is seen as well.
 * The folder sits in Vite's cache folder, so what clears that clears this. A cache that cannot be read or written is
 * only a slower start: every failure here is a miss.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A disk cache of one kind of answer. */
export type DiskCache<TValue> = {
  /** The answer kept for a file, when every file it depends on is unchanged. */
  readonly read: (file: string) => TValue | undefined;
  /** Keeps an answer, with the files it depends on, as they are now. */
  readonly write: (file: string, value: TValue, dependencies: readonly string[]) => void;
};

/** A file and its time; `null` for a file that does not exist, which may appear later. */
type FileStamp = readonly [file: string, time: number | null];

/** One kept answer, as JSON. */
type CacheEntry = {
  /** What wrote it. */
  readonly stamp: string;
  /** The files it depends on, as they were. */
  readonly files: readonly FileStamp[];
  /** The answer. */
  readonly value: unknown;
};

/** Whether a parsed file is an entry. */
const isEntry = (value: unknown): value is CacheEntry =>
  typeof value === "object" &&
  value !== null &&
  "stamp" in value &&
  "value" in value &&
  "files" in value &&
  Array.isArray(value.files);

/** A file's time, in milliseconds, or `null` when it does not exist. */
const timeOf = (file: string): number | null => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
};

/**
 * A cache in a folder.
 *
 * @param folder - the folder, created on the first write.
 * @param stamp - what the answers depend on besides the files (the code that made them): another stamp is a miss.
 * @param isValue - whether what was read is an answer: a file written by another version may hold anything.
 */
export const diskCache = <TValue>(
  folder: string,
  stamp: string,
  isValue: (value: unknown) => value is TValue & {}
): DiskCache<TValue> => {
  const path = (file: string): string =>
    join(folder, `${createHash("sha256").update(file).digest("hex").slice(0, 32)}.json`);
  return {
    read: (file: string): TValue | undefined => {
      try {
        const entry: unknown = JSON.parse(readFileSync(path(file), "utf8"));
        if (!isEntry(entry) || entry.stamp !== stamp) return undefined;
        const isFresh = entry.files.every(([name, time]) => timeOf(name) === time);
        return isFresh && isValue(entry.value) ? entry.value : undefined;
      } catch {
        return undefined;
      }
    },
    write: (file: string, value: TValue, dependencies: readonly string[]): void => {
      const entry: CacheEntry = {
        stamp,
        files: dependencies.map((name): FileStamp => [name, timeOf(name)]),
        value
      };
      try {
        mkdirSync(folder, { recursive: true });
        // renamed into place: a reader, or a server stopped halfway, never meets half a file
        const partial = `${path(file)}.${process.pid}`;
        writeFileSync(partial, JSON.stringify(entry));
        renameSync(partial, path(file));
      } catch {
        // a cache that cannot be written is a slower next start
      }
    }
  };
};
