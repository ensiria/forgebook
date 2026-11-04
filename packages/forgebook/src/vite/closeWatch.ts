/**
 * The files a person is working on, each watched on its own, so the dev server hears of an edit at once: the story
 * files the open frames loaded, and each file a page loaded that was edited since the server started.
 *
 * @remarks
 * On macOS, Vite's watcher hears of a change through FSEvents, by streams that deliver it a tenth of a second late by
 * design, and later still while the system's file-event service is busy: on a large library that wait is most of the
 * time an edit takes to reach the page, and most of its spread. A file watched on its own (`fs.watch` on the file,
 * a kernel event) is told at once, so each followed file's change is handed to Vite's watcher as its own. Its
 * FSEvents event still comes, a little later: the dev server drops an update the close watch did not hand on when it
 * finds the text the environment took last (`isLateReport`), so an edit is drawn once, while a save that changes
 * nothing still draws anew when the close watch reports it (a story retried after an error). Vite still marks the
 * file's modules stale for a dropped report, and no later plugin's `hotUpdate` sees it. A watch holds a file
 * descriptor, so only a bounded few files are followed, the least recently followed dropped first; never a
 * dependency's file, which Vite's watcher ignores, nor a page (`.html`), for which Vite answers an update it drops
 * with a reload of the pages.
 *
 * Only where Vite's watcher reads FSEvents and the dev server sends updates: elsewhere its events already come at
 * once, polling (`--poll`) is the choice where no event can be trusted, and a watcher told to wait for writes to
 * finish (`awaitWriteFinish`) is left to wait.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { existsSync, type FSWatcher, readFileSync, watch } from "node:fs";

import type { ViteDevServer, WatchOptions } from "vite";

import { VITE_PATHS } from "./vitePaths.ts";

/** Where a project's dependencies are installed, whose files Vite's watcher ignores and none is followed in. */
const DEPENDENCIES = "/node_modules/";

/** A page, whose update Vite answers with a reload when it is dropped: never followed. */
const PAGE_FILE = /\.html?$/;

/** How many files are followed at most: each holds a file descriptor while it is followed. */
export const CLOSE_WATCH_LIMIT = 64;

/** A file's watch, as `watchFile` opens it. */
export type FileWatch = {
  /** Stops watching. */
  readonly close: () => void;
};

/**
 * Opens a file's watch: Node's `fs.watch`, unless a test hands its own.
 *
 * @param file - the file.
 * @param onEvent - called with `"change"` when the file's content changed, `"rename"` when the file was replaced or
 * removed (an editor that saves through a new file), `"error"` when the watch failed.
 * @throws when the file cannot be watched (gone, or no file descriptor left).
 */
export type WatchFile = (file: string, onEvent: (kind: "change" | "rename" | "error") => void) => FileWatch;

/** The files followed, and what the dev server took of each. */
export type CloseWatch = {
  /**
   * Follows a file, or keeps following it as the most recent; a file that cannot be watched is left to Vite's watcher.
   *
   * @param file - the file, in Node's or Vite's form.
   */
  readonly follow: (file: string) => void;
  /**
   * Whether an update of a followed file is the late report of an edit the environment took already: one the close
   * watch did not hand on since the environment's last update of the file, whose text is the one it took then. Each
   * update the close watch handed on is taken, the same text or not; the text is kept for the next. Always false for
   * a file not followed.
   *
   * @param environment - the environment's name.
   * @param file - the file, in Node's or Vite's form.
   */
  readonly isLateReport: (environment: string, file: string) => boolean;
  /** Stops following every file. */
  readonly close: () => void;
};

/** What `closeWatch` is made with. */
export type CloseWatchOptions = {
  /**
   * Hands a followed file's change to the dev server's watcher.
   *
   * @param file - the file, in Vite's form.
   */
  readonly onChange: (file: string) => void;
  /** How many files are followed at most; `CLOSE_WATCH_LIMIT` by default. */
  readonly limit?: number;
  /** Opens a file's watch; Node's `fs.watch` by default. */
  readonly watchFile?: WatchFile;
  /**
   * A file's text now, or none when it cannot be read; read from the disk by default.
   *
   * @param file - the file.
   */
  readonly readText?: (file: string) => string | undefined;
};

/**
 * Node's watch of one file: a kernel event per change (kqueue on macOS). Not persistent, so it never keeps a process
 * that is ending alive.
 *
 * @param file - the file.
 * @param onEvent - the watch's events.
 */
const nodeWatchFile: WatchFile = (file: string, onEvent: (kind: "change" | "rename" | "error") => void) => {
  const watcher: FSWatcher = watch(file, { persistent: false }, (kind: string) =>
    onEvent(kind === "rename" ? "rename" : "change")
  );
  watcher.on("error", () => onEvent("error"));
  return { close: () => watcher.close() };
};

/**
 * A file's text, or none when it cannot be read.
 *
 * @param file - the file.
 */
const diskText = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * A text's digest: what is kept of a file's last update, so a long file is not held twice.
 *
 * @param text - the text.
 */
const digestOf = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * Whether a dev server's watcher hears of changes through FSEvents, which deliver them late: Vite's on macOS, unless
 * it polls, was told not to use them, or waits for writes to finish; none when the dev server watches nothing.
 *
 * @param options - the dev server's `server.watch`.
 * @param platform - the system, `process.platform` by default.
 */
export const isWatchingByFileEvents = (
  options: WatchOptions | null | undefined,
  platform: NodeJS.Platform = process.platform
): boolean =>
  platform === "darwin" &&
  options !== null &&
  options?.usePolling !== true &&
  options?.useFsEvents !== false &&
  (options?.awaitWriteFinish === undefined || options.awaitWriteFinish === false);

/**
 * Follows the files a person is working on, each on its own.
 *
 * @param options - where a change goes, how many files at most, and how a file is watched and read.
 */
export const closeWatch = (options: CloseWatchOptions): CloseWatch => {
  const limit = options.limit ?? CLOSE_WATCH_LIMIT;
  const watchFile = options.watchFile ?? nodeWatchFile;
  const readText = options.readText ?? diskText;
  // by file in Vite's form, the least recently followed first
  const followed = new Map<string, FileWatch>();
  // how many changes of each followed file the close watch handed on
  const handed = new Map<string, number>();
  // what each environment last took of a followed file, by environment and file: the handed count it had reached and
  // the text's digest
  const taken = new Map<string, { readonly handed: number; readonly digest: string }>();
  // the files whose change is handed on at the end of this turn: a save is often two events (emptied, then written)
  const handing = new Set<string>();
  const handOn = (file: string): void => {
    if (handing.has(file)) return;
    handing.add(file);
    setImmediate(() => {
      handing.delete(file);
      if (!followed.has(file)) return;
      handed.set(file, (handed.get(file) ?? 0) + 1);
      options.onChange(file);
    });
  };
  const stop = (file: string): void => {
    followed.get(file)?.close();
    followed.delete(file);
  };
  const forget = (file: string): void => {
    stop(file);
    handed.delete(file);
    for (const key of [...taken.keys()]) {
      if (key.endsWith(`\0${file}`)) taken.delete(key);
    }
  };
  const open = (file: string): void => {
    try {
      followed.set(
        file,
        watchFile(file, (kind) => {
          if (kind === "change") {
            handOn(file);
            return;
          }
          // a file saved through a new one is another file now: the old watch hears nothing more of it, and what
          // was taken of it still tells the late event of this save from a new edit
          if (kind === "rename" && existsSync(file)) {
            stop(file);
            open(file);
            handOn(file);
            return;
          }
          // removed, or the watch failed: Vite's own watcher reports what follows
          forget(file);
        })
      );
    } catch {
      // gone already, or no file descriptor left: Vite's own watcher still reports it
    }
    while (followed.size > limit) {
      const oldest = followed.keys().next().value;
      if (oldest === undefined) break;
      forget(oldest);
    }
  };
  return {
    follow: (file: string): void => {
      const key = VITE_PATHS.normalize(file);
      if (key.includes(DEPENDENCIES) || PAGE_FILE.test(key)) return;
      const kept = followed.get(key);
      if (kept === undefined) {
        open(key);
        return;
      }
      followed.delete(key);
      followed.set(key, kept);
    },
    isLateReport: (environment: string, file: string): boolean => {
      const key = VITE_PATHS.normalize(file);
      if (!followed.has(key)) return false;
      const text = readText(key);
      if (text === undefined) return false;
      const digest = digestOf(text);
      const takenKey = `${environment}\0${key}`;
      const last = taken.get(takenKey);
      const count = handed.get(key) ?? 0;
      const isHandedOn = last === undefined || count > last.handed;
      if (!isHandedOn && last.digest === digest) return true;
      taken.set(takenKey, { handed: count, digest });
      return false;
    },
    close: (): void => {
      for (const file of [...followed.keys()]) forget(file);
    }
  };
};

/**
 * A dev server's close watch, where its watcher reads FSEvents and it sends updates: changes go to its watcher, and a
 * file a page loaded that the person edits is followed from then on, since it is likely edited again. Closed with the
 * server's HTTP server; the plugin closes it with the server too, which may have none.
 *
 * @param server - the dev server.
 * @param platform - the system, `process.platform` by default.
 * @returns the close watch; none where the watcher hears of changes at once, or polls.
 */
export const serverCloseWatch = (
  server: ViteDevServer,
  platform: NodeJS.Platform = process.platform
): CloseWatch | undefined => {
  const { watch, hmr } = server.config.server;
  if (!isWatchingByFileEvents(watch, platform) || hmr === false) return undefined;
  const watching = closeWatch({ onChange: (file: string) => void server.watcher.emit("change", file) });
  server.watcher.on("change", (file: string): void => {
    const loaded = server.environments.client.moduleGraph.getModulesByFile(VITE_PATHS.normalize(file));
    if (loaded !== undefined && loaded.size > 0) watching.follow(file);
  });
  server.httpServer?.on("close", (): void => watching.close());
  return watching;
};

/** The close watch of the dev server that runs now, as the plugin holds it across restarts. */
export type CurrentCloseWatch = Pick<CloseWatch, "follow" | "isLateReport" | "close"> & {
  /**
   * Ends the watch of the server before, if any, and starts this server's: a restart configures the new server before
   * it closes the old one.
   *
   * @param server - the dev server; none in a run where no person waits for a page (a test run).
   * @param platform - the system, `process.platform` by default.
   */
  readonly serve: (server: ViteDevServer | undefined, platform?: NodeJS.Platform) => void;
};

/**
 * The close watch of the dev server that runs now; none follows a file until a server is served.
 */
export const currentCloseWatch = (): CurrentCloseWatch => {
  let current: CloseWatch | undefined;
  return {
    serve: (server: ViteDevServer | undefined, platform: NodeJS.Platform = process.platform): void => {
      current?.close();
      current = server === undefined ? undefined : serverCloseWatch(server, platform);
    },
    follow: (file: string): void => current?.follow(file),
    isLateReport: (environment: string, file: string): boolean =>
      current?.isLateReport(environment, file) === true,
    close: (): void => current?.close()
  };
};
