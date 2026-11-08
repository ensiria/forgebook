/**
 * The files a checkout rewrote, told to the dev server's watcher: `git switch`, `git reset --hard`, a pull or a rebase
 * moves the repository to another commit and rewrites its files at once, and the system's file events for such a burst
 * may come many seconds late, or never.
 *
 * @remarks
 * Vite's watcher on macOS reads FSEvents, which a busy machine delivers late and coalesces; a branch switch writes,
 * removes and adds files within milliseconds, and its events can be lost outright. Missed, a story removed by the switch
 * stays in the sidebar, one it added never shows, a story file's old module keeps being served, and nothing ever renews
 * them: every later answer comes from the stale module. A watch of git's own `HEAD` and `index` files, each on its own
 * (a kernel event, kqueue on macOS), hears every checkout at once; the commit `HEAD` names before and after says which
 * files changed, and each that the checkout wrote is handed to Vite's watcher as its own event, so every path a real
 * event takes (the lists, the modules, the pages' reload) runs as it would have.
 *
 * The moves come from git's reflog of `HEAD`, read from where the last check stopped: a switch and a switch back that
 * land between two checks leave `HEAD` where it was, yet rewrote files, and a page that loaded in between holds the
 * other branch's stories. Each move's files are handed on, the later move standing for a file both wrote. With no
 * reflog, the commit seen last is compared with the one now.
 *
 * Only files the checkout wrote are handed on: one git lists that is untouched on disk since the last checkout seen (a
 * commit, which changes `HEAD` and rewrites nothing) is not, nor a file it says was removed that is still there. A
 * checkout that keeps `HEAD` where it was (`git checkout -- <file>`, `git stash`) changes no commit and is left to the
 * system's events. Where the watcher hears of changes at once or polls, there is nothing to make up for.
 *
 * @module
 */
import { execFile } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ViteDevServer } from "vite";

import { type FileWatch, isWatchingByFileEvents, nodeWatchFile, type WatchFile } from "./closeWatch.ts";
import { VITE_PATHS } from "./vitePaths.ts";

const run = promisify(execFile);

/** An event handed to the watcher, as Vite's watcher names its own. */
export type CheckoutEvent = {
  /** What happened to the file. */
  readonly kind: "add" | "change" | "unlink";
  /** The file, absolute, in Vite's form. */
  readonly file: string;
};

/** A file as the disk has it now: when its status last changed, in milliseconds; none when it is not there. */
export type FileStatus = (file: string) => { readonly changedAt: number } | undefined;

/**
 * How long before the last checkout seen a file's change still counts as this checkout's, in milliseconds: a file
 * system writes times with its own clock and grain, so a file written by the checkout may carry a time a little early.
 */
const CHECKOUT_MARGIN_MS = 2_000;

/** How long the watch waits for git to finish writing before it reads `HEAD`, in milliseconds. */
const SETTLE_MS = 100;

/** How long after a file's watch is opened it is checked to still hold the file, in milliseconds. */
const REWATCH_MS = 50;

/** Which file a path names now: its device and inode; none when nothing is there. */
const identityOf = (file: string): string | undefined => {
  const stats = statSync(file, { throwIfNoEntry: false });
  return stats === undefined ? undefined : `${stats.dev}:${stats.ino}`;
};

/** A dependency's file, which Vite's watcher ignores. */
const DEPENDENCY = /(?:^|\/)node_modules\//;

/** A file's status from the disk. */
const diskStatus: FileStatus = (file: string) => {
  const stats = statSync(file, { throwIfNoEntry: false });
  return stats === undefined ? undefined : { changedAt: stats.ctimeMs };
};

/**
 * The events a checkout's files make: what `git diff --name-status -z --no-renames` lists between two commits, kept to
 * the files the checkout wrote.
 *
 * @param listed - git's output.
 * @param top - the repository's folder, which git's paths are relative to.
 * @param since - when the commit before was seen, in milliseconds: a file unchanged since is not the checkout's.
 * @param status - a file's status now; the disk's by default.
 */
export const checkoutEvents = (
  listed: string,
  top: string,
  since: number,
  status: FileStatus = diskStatus
): CheckoutEvent[] => {
  const parts = listed.split("\0");
  const events: CheckoutEvent[] = [];
  for (let at = 0; at + 1 < parts.length; at += 2) {
    const [letter = "", path = ""] = [parts[at], parts[at + 1]];
    if (path === "" || DEPENDENCY.test(path)) continue;
    const file = VITE_PATHS.normalize(join(top, path));
    const now = status(file);
    if (letter.startsWith("D")) {
      if (now === undefined) events.push({ kind: "unlink", file });
      continue;
    }
    if (now === undefined || now.changedAt < since - CHECKOUT_MARGIN_MS) continue;
    events.push({ kind: letter.startsWith("A") ? "add" : "change", file });
  }
  return events;
};

/** A move of `HEAD` from one commit to another, as git's reflog of `HEAD` records it. */
export type HeadMove = {
  /** The commit before. */
  readonly from: string;
  /** The commit after. */
  readonly to: string;
};

/** A reflog line's two commits, before the name and the message: 40 or 64 hexadecimal digits each. */
const REFLOG_LINE = /^([0-9a-f]{40}(?:[0-9a-f]{24})?) ([0-9a-f]{40}(?:[0-9a-f]{24})?) /;

/**
 * The moves of `HEAD` in what git appended to its reflog, in order, each that changed the commit: a branch switched and
 * switched back before a check reads `HEAD` is two moves, though `HEAD` ends where it was.
 *
 * @param appended - the reflog's lines written since the last check.
 */
export const headMoves = (appended: string): HeadMove[] =>
  appended.split("\n").flatMap((line): HeadMove[] => {
    const [, from = "", to = ""] = REFLOG_LINE.exec(line) ?? [];
    return from === "" || from === to || /^0+$/.test(from) ? [] : [{ from, to }];
  });

/** What a reflog holds past a point, and where it ends; none when it cannot be read or was rewritten shorter. */
const reflogFrom = (
  file: string,
  offset: number
): { readonly text: string; readonly end: number } | undefined => {
  const size = statSync(file, { throwIfNoEntry: false })?.size;
  if (size === undefined || size < offset) return undefined;
  const buffer = Buffer.alloc(size - offset);
  const handle = openSync(file, "r");
  try {
    readSync(handle, buffer, 0, buffer.length, offset);
  } finally {
    closeSync(handle);
  }
  // a line git is still writing is read at the next check
  const text = buffer.toString("utf8");
  const complete = text.lastIndexOf("\n") + 1;
  return { text: text.slice(0, complete), end: offset + Buffer.byteLength(text.slice(0, complete)) };
};

/** Runs git in a folder and gives what it wrote, trimmed; none when it fails (no repository, no commit yet). */
export type RunGit = (dir: string, args: readonly string[]) => Promise<string | undefined>;

/** Git, as installed, with no option of the user's that changes how it lists. */
const runGit: RunGit = async (dir: string, args: readonly string[]): Promise<string | undefined> => {
  try {
    const { stdout } = await run("git", ["-c", "core.quotePath=false", ...args], {
      cwd: dir,
      maxBuffer: 64 * 1024 * 1024
    });
    return stdout.trim();
  } catch {
    return undefined;
  }
};

/** What `checkoutWatch` is made with. */
export type CheckoutWatchOptions = {
  /** A folder of the repository: the dev server's root. */
  readonly dir: string;
  /**
   * Hands an event to the dev server's watcher.
   *
   * @param event - the event.
   */
  readonly onEvent: (event: CheckoutEvent) => void;
  /** Opens a file's watch; Node's `fs.watch` by default. */
  readonly watchFile?: WatchFile;
  /** Runs git; the installed git by default. */
  readonly git?: RunGit;
  /** A file's status; the disk's by default. */
  readonly status?: FileStatus;
  /** How long to wait for git to finish writing, in milliseconds; `SETTLE_MS` by default. */
  readonly settleMs?: number;
};

/** A checkout watch: it can be stopped, and says when it has read where the repository stands. */
export type CheckoutWatch = {
  /** Resolves once it watches, or knows there is nothing to watch (no repository). */
  readonly ready: Promise<void>;
  /** Resolves once every checkout heard so far has been handed on. */
  readonly settled: () => Promise<void>;
  /** Stops watching. */
  readonly close: () => void;
};

/**
 * Watches a repository's checkouts and hands the files each one wrote to `onEvent`.
 *
 * @param options - the repository, where events go, and how files are watched and git is run.
 */
export const checkoutWatch = (options: CheckoutWatchOptions): CheckoutWatch => {
  const watchFile = options.watchFile ?? nodeWatchFile;
  const git = options.git ?? runGit;
  const settleMs = options.settleMs ?? SETTLE_MS;
  const watches = new Map<string, FileWatch>();
  let isClosed = false;
  let head: string | undefined;
  let since = Date.now();
  let top = "";
  // the reflog of `HEAD`, and how far it was read
  let reflog = "";
  let reflogEnd = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // one check at a time, in order: two checkouts in a row are compared each with the one before
  let checking: Promise<void> = Promise.resolve();
  /**
   * The moves since the last check: from the reflog of `HEAD`, which records a switch and a switch back that leave
   * `HEAD` where it was; else the one move from the commit seen last to the one now.
   */
  const movesTo = (now: string): readonly HeadMove[] => {
    const appended = reflog === "" ? undefined : reflogFrom(reflog, reflogEnd);
    if (appended !== undefined) {
      reflogEnd = appended.end;
      const moves = headMoves(appended.text);
      if (moves.length > 0 && moves.at(-1)?.to === now) return moves;
    }
    return head === undefined || head === now ? [] : [{ from: head, to: now }];
  };
  /** Each move's files, the later standing: a file written by two moves is told once, as the disk has it now. */
  const movesEvents = async (moves: readonly HeadMove[]): Promise<readonly CheckoutEvent[]> => {
    const events = new Map<string, CheckoutEvent>();
    for (const { from, to } of moves) {
      const listed = await git(options.dir, [
        "diff",
        "--name-status",
        "-z",
        "--no-renames",
        "--no-ext-diff",
        from,
        to
      ]);
      for (const event of checkoutEvents(listed ?? "", top, since, options.status))
        events.set(event.file, event);
    }
    return [...events.values()];
  };
  const check = async (): Promise<void> => {
    const seenAt = Date.now();
    const now = await git(options.dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
    if (isClosed || now === undefined) return;
    const moves = head === undefined ? [] : movesTo(now);
    head = now;
    const events = await movesEvents(moves);
    if (!isClosed) for (const event of events) options.onEvent(event);
    since = seenAt;
  };
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      checking = checking.then(check);
    }, settleMs);
  };
  const follow = (file: string): void => {
    if (isClosed) return;
    watches.get(file)?.close();
    watches.delete(file);
    const watched = identityOf(file);
    try {
      watches.set(
        file,
        watchFile(file, (kind) => {
          // git replaces the file through a new one, which the old watch never hears of
          if (kind !== "change") setTimeout(() => follow(file), 0);
          schedule();
        })
      );
    } catch {
      // not there yet (a repository with no commit has no index): the next event of the other file looks again
      return;
    }
    // a watch is taken by the system on the loop's next turn, and hears nothing of a file replaced before that: then
    // the file it holds is gone for good, so it is opened again and the checkout that replaced it is looked for
    setTimeout(() => {
      if (isClosed || identityOf(file) === watched) return;
      follow(file);
      schedule();
    }, REWATCH_MS);
  };
  const ready = (async (): Promise<void> => {
    const gitDir = await git(options.dir, ["rev-parse", "--absolute-git-dir"]);
    const shown = await git(options.dir, ["rev-parse", "--show-toplevel"]);
    if (gitDir === undefined || shown === undefined || isClosed) return;
    top = shown;
    head = await git(options.dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
    reflog = join(gitDir, "logs", "HEAD");
    reflogEnd = statSync(reflog, { throwIfNoEntry: false })?.size ?? 0;
    since = Date.now();
    // `HEAD` moves with a switch; the index is rewritten by every checkout, a reset of the branch included
    for (const name of ["HEAD", "index"]) follow(join(gitDir, name));
  })();
  return {
    ready,
    settled: async (): Promise<void> => {
      await ready;
      await new Promise((resolve) => setTimeout(resolve, settleMs * 2));
      await checking;
    },
    close: (): void => {
      isClosed = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const watch of watches.values()) watch.close();
      watches.clear();
    }
  };
};

/**
 * A dev server's checkout watch, where its watcher reads FSEvents and it sends updates: what a checkout wrote goes to
 * its watcher. Closed with the server's HTTP server.
 *
 * @param server - the dev server.
 * @param platform - the system, `process.platform` by default.
 * @returns the watch; none where the watcher hears of changes at once, or polls.
 */
export const serverCheckoutWatch = (
  server: ViteDevServer,
  platform: NodeJS.Platform = process.platform
): CheckoutWatch | undefined => {
  const { watch, hmr } = server.config.server;
  if (!isWatchingByFileEvents(watch, platform) || hmr === false) return undefined;
  const watching = checkoutWatch({
    dir: server.config.root,
    onEvent: ({ kind, file }: CheckoutEvent): void => void server.watcher.emit(kind, file)
  });
  server.httpServer?.on("close", (): void => watching.close());
  return watching;
};

/** The checkout watch of the dev server that runs now, as the plugin holds it across restarts. */
export type CurrentCheckoutWatch = {
  /**
   * Ends the watch of the server before, if any, and starts this server's: a restart configures the new server before
   * it closes the old one.
   *
   * @param server - the dev server; none in a run where no person waits for a page (a test run).
   * @param platform - the system, `process.platform` by default.
   */
  readonly serve: (server: ViteDevServer | undefined, platform?: NodeJS.Platform) => void;
  /** Stops watching. */
  readonly close: () => void;
};

/** The checkout watch of the dev server that runs now; none watches until a server is served. */
export const currentCheckoutWatch = (): CurrentCheckoutWatch => {
  let current: CheckoutWatch | undefined;
  return {
    serve: (server: ViteDevServer | undefined, platform: NodeJS.Platform = process.platform): void => {
      current?.close();
      current = server === undefined ? undefined : serverCheckoutWatch(server, platform);
    },
    close: (): void => current?.close()
  };
};
