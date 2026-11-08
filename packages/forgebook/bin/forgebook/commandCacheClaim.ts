/**
 * Which cache folder a server a command starts may use: the shared one, kept warm from one command to the next, when no
 * other live server holds it, else one of its own for as long as it runs (`commandServer.ts`).
 *
 * @remarks
 * Two servers on one cache folder rewrite each other's pre-bundled dependencies: when one's optimizer discovers a package
 * the other did not, it replaces the whole `deps` folder, and the other's frames ask for a bundle that is gone and fail
 * with "504 (Outdated Optimize Dep)". Two commands run together in one project as soon as an agent runs `verify` while
 * `forgebook mcp` serves, or two checks run side by side. A lock file beside the shared folder names the process that
 * holds it; one whose process is gone is taken over. A server that finds it held runs on a folder named after its
 * process, removed when it closes, or by the next claim when its process ended first.
 *
 * @module
 */
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeSync
} from "node:fs";
import { basename, dirname, join } from "node:path";

/** Whether a process runs. */
export const isProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // the process exists, and belongs to another user
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
};

/** A cache folder a server may use, and how to give it back. */
export type CacheClaim = {
  /** The folder: the shared one, or the server's own. */
  readonly folder: string;
  /** Whether it is the shared folder. */
  readonly isShared: boolean;
  /** Gives it back: unlocks the shared folder, or removes the server's own. Safe to call more than once. */
  readonly release: () => void;
};

/** The lock file of a shared folder, beside it. */
const lockFile = (shared: string): string => `${shared}.lock`;

/** The prefix of the folders servers that found the shared one held run on, beside it. */
const ownPrefix = (shared: string): string => `${basename(shared)}-own-`;

/** How long a lock file may name no process before it counts as one a process left while writing it. */
const UNWRITTEN_LOCK_MS = 10_000;

/**
 * Removes a file or folder, leaving it when the system will not: on Windows a file another program holds open cannot
 * go, and what is left is removed by a later claim, never a reason to fail the command.
 *
 * @param path - the file or folder.
 */
const removeIfPossible = (path: string): void => {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // left for the next claim's sweep
  }
};

/** The process a lock file names, or none when it names none (written halfway, or by hand). */
const lockHolder = (file: string): number | undefined => {
  try {
    const pid = Number(readFileSync(file, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
};

/** Creates a file naming this process; false when it exists. */
const tryCreate = (file: string): boolean => {
  let handle: number;
  try {
    handle = openSync(file, "wx");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
    throw error;
  }
  try {
    writeSync(handle, String(process.pid));
  } finally {
    closeSync(handle);
  }
  return true;
};

/**
 * Whether a lock is one no live process holds: its process is gone, or it has named none for longer than a write takes
 * (a process that ended between creating and writing it).
 */
const isStale = (file: string): boolean => {
  const holder = lockHolder(file);
  if (holder !== undefined) return !isProcessRunning(holder);
  const stats = statSync(file, { throwIfNoEntry: false });
  return stats !== undefined && Date.now() - stats.mtimeMs > UNWRITTEN_LOCK_MS;
};

/**
 * Takes the lock, taking it over from a process that is gone. A take-over is itself guarded by a file only one process
 * can create: two processes that both find the lock stale would otherwise each remove it, the second removing the
 * first one's new lock, and both would run on the shared folder.
 *
 * @param file - the lock file.
 * @returns whether this process holds it now.
 */
const lock = (file: string): boolean => {
  if (tryCreate(file)) return true;
  if (!isStale(file)) return false;
  const takeOver = `${file}.take-over`;
  if (!tryCreate(takeOver)) {
    // a take-over left by a process that ended in it is cleared for the next claim; this one runs apart
    if (isStale(takeOver)) removeIfPossible(takeOver);
    return false;
  }
  try {
    // read again under the take-over: another process may have taken the lock over and released it since
    if (!isStale(file)) return false;
    removeIfPossible(file);
    return tryCreate(file);
  } finally {
    removeIfPossible(takeOver);
  }
};

/** Removes the folders of servers whose process is gone. */
const sweepOwn = (parent: string, prefix: string): void => {
  for (const name of readdirSync(parent).filter((each) => each.startsWith(prefix))) {
    const pid = Number(name.slice(prefix.length).split("-")[0]);
    if (Number.isInteger(pid) && pid > 0 && !isProcessRunning(pid)) removeIfPossible(join(parent, name));
  }
};

/** How many own folders this process has made: two servers of one process each get one. */
let ownCount = 0;

/** What to give back if the process ends before its servers close. */
const pending = new Set<() => void>();

/** Whether the process's exit gives back what is still held. */
let isExitHooked = false;

/** Gives back every claim still held: the process is ending, and its lock would otherwise read as live until reused. */
const releaseAll = (): void => {
  for (const release of pending) release();
};

/**
 * Claims a cache folder for a server: the shared one when no live server holds it, else one of the server's own beside it.
 *
 * @param shared - the shared folder.
 * @returns the claim, given back when the server closes.
 */
export const claimCommandCache = (shared: string): CacheClaim => {
  const parent = dirname(shared);
  mkdirSync(parent, { recursive: true });
  sweepOwn(parent, ownPrefix(shared));
  const isShared = lock(lockFile(shared));
  ownCount += 1;
  const folder = isShared ? shared : join(parent, `${ownPrefix(shared)}${process.pid}-${ownCount}`);
  let isReleased = false;
  const release = (): void => {
    if (isReleased) return;
    isReleased = true;
    pending.delete(release);
    if (isShared) {
      if (lockHolder(lockFile(shared)) === process.pid) removeIfPossible(lockFile(shared));
    } else removeIfPossible(folder);
  };
  pending.add(release);
  if (!isExitHooked) {
    isExitHooked = true;
    process.on("exit", releaseAll);
  }
  return { folder, isShared, release };
};
