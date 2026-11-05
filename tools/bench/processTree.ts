/**
 * Stopping a process and everything it started, and waiting for a process to end, each with a deadline.
 *
 * @remarks
 * On macOS and Linux a tree is stopped through its process group; Windows has no such group, and the tree is stopped
 * with `taskkill /T`. Every wait has a deadline: `taskkill` can fail, a process can take its time to go, and an
 * unbounded wait for an exit stops a whole run without a word, which is worse than going on with a warning.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";

/** How long stopping a process tree may take, in milliseconds, before the caller goes on without it. */
export const STOP_TIMEOUT = 15_000;

/**
 * Whether a server is started in a process group of its own: on macOS and Linux, so stopping the group stops what it
 * started. Windows has no such group; a detached process there gets a console window of its own instead.
 */
export const isOwnGroup = process.platform !== "win32";

/**
 * Whether a process has ended, by its own exit or a signal.
 *
 * @param child - the process.
 */
export const hasEnded = (child: ChildProcess): boolean =>
  child.exitCode !== null || child.signalCode !== null;

/**
 * Waits for a process to end, for at most a while.
 *
 * @param child - the process.
 * @param timeoutMs - how long to wait, in milliseconds.
 * @returns whether it ended in time.
 */
export const waitForExit = (child: ChildProcess, timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    if (hasEnded(child)) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

/**
 * Stops a process and everything it started, at once, and waits for the stopping to be done or for its deadline.
 *
 * @remarks
 * On Windows `taskkill /T` walks the tree from the process; on macOS and Linux the process's group is killed, so the
 * process must have been started with `detached: isOwnGroup`. A process already gone is no error.
 *
 * @param pid - the tree's root.
 */
export const killTree = (pid: number): Promise<void> =>
  new Promise((resolve) => {
    if (process.platform !== "win32") {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // a group already gone, or a process started outside a group of its own: stop that one alone
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // gone meanwhile
        }
      }
      resolve();
      return;
    }
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    const timer = setTimeout(() => {
      killer.kill();
      resolve();
    }, STOP_TIMEOUT);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    killer.once("exit", done);
    killer.once("error", done);
  });
