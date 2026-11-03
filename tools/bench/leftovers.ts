/**
 * What a run leaves running, and how it keeps from leaving anything: the tools' daemons turned off in every command it
 * runs in a library, and the processes still alive at the end stopped and named.
 *
 * @remarks
 * A library's own build tool may start a daemon that outlives the command, as Nx does (Fluent UI's `prepare` builds
 * with Nx), and keeps a core busy under every later run. The commands get the variables that turn such daemons off;
 * what the run started and is still alive when it ends is stopped (`toolEnvironment.ts` turns the daemons off). Parsing `ps` is pure and tested.
 *
 * @module
 */

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

/** A process left running. */
export type Leftover = {
  /** Its id. */
  readonly pid: number;
  /** Its command line. */
  readonly command: string;
};

/**
 * Seconds from `ps`'s elapsed time, `[[dd-]hh:]mm:ss`.
 *
 * @param elapsed - the elapsed time as `ps` writes it.
 */
export const elapsedSeconds = (elapsed: string): number => {
  const [days, clock = ""] = elapsed.includes("-") ? elapsed.split("-") : ["0", elapsed];
  const parts = clock.split(":").map(Number);
  const [seconds = 0, minutes = 0, hours = 0] = parts.reverse();
  return Number(days) * 86_400 + hours * 3600 + minutes * 60 + seconds;
};

/** What lists the processes; its own process, a child of the run, is no leftover. */
const PS_ARGS = ["-A", "-o", "pid=,ppid=,etime=,command="];

/** The command line `ps` shows for the listing itself. */
export const LISTING_COMMAND = `ps ${PS_ARGS.join(" ")}`;

/** Whether a command line names a path inside the folder: the folder followed by a separator, not a prefix of another. */
const namesPathIn = (command: string, folder: string): boolean => {
  const inside = folder.endsWith("/") ? folder : `${folder}/`;
  return command.includes(inside);
};

/**
 * The processes of `ps -A -o pid=,ppid=,etime=,command=` the run left behind: its own descendants still alive, and the
 * daemons that detached from them (adopted by the system's first process) and run from the work folder, started
 * during the run. The run itself and the processes that started it are never among them.
 *
 * @remarks
 * Matching the folder alone would reach another run's processes, or a person's editor on a report: only a process
 * this run started, or one that left its parent to outlive it, can be this run's leftover.
 *
 * @param table - what `ps` printed.
 * @param folder - the work folder.
 * @param runSeconds - how long the run has lasted, in seconds.
 * @param self - the run's own process id.
 */
export const leftoversIn = (
  table: string,
  folder: string,
  runSeconds: number,
  self: number
): readonly Leftover[] => {
  const rows = table
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line))
    .flatMap((match) =>
      match === null
        ? []
        : [
            {
              pid: Number(match[1]),
              parent: Number(match[2]),
              seconds: elapsedSeconds(match[3] ?? ""),
              command: match[4] ?? ""
            }
          ]
    );
  const parents = new Map(rows.map((row) => [row.pid, row.parent]));
  const own = new Set<number>();
  for (
    let pid: number | undefined = self;
    pid !== undefined && pid > 1 && !own.has(pid);
    pid = parents.get(pid)
  )
    own.add(pid);
  const isDescendant = (pid: number): boolean => {
    const seen = new Set<number>();
    for (
      let parent = parents.get(pid);
      parent !== undefined && !seen.has(parent);
      parent = parents.get(parent)
    ) {
      if (parent === self) return true;
      seen.add(parent);
    }
    return false;
  };
  const isDetached = (row: (typeof rows)[number]): boolean =>
    row.parent === 1 && row.seconds <= runSeconds && namesPathIn(row.command, folder);
  return rows
    .filter((row) => !own.has(row.pid) && row.command !== LISTING_COMMAND)
    .filter((row) => isDescendant(row.pid) || isDetached(row))
    .map(({ pid, command }) => ({ pid, command }));
};

/** How long a process asked to stop has before it is killed, in milliseconds. */
const STOP_GRACE = 2000;

/** Whether a process is still alive. */
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Sends a signal to a process that may be gone meanwhile. */
const signal = (pid: number, name: NodeJS.Signals): void => {
  try {
    process.kill(pid, name);
  } catch {
    // gone meanwhile
  }
};

/**
 * Stops what the run left running from the work folder.
 *
 * @param folder - the work folder.
 * @param startedAt - when the run started, in milliseconds since the epoch.
 * @param io - the script's streams.
 * @returns the processes it stopped.
 */
export const stopLeftovers = async (
  folder: string,
  startedAt: number,
  io: ScriptIo
): Promise<readonly Leftover[]> => {
  const { stdout } = await exec("ps", PS_ARGS, { io, output: "capture" });
  const left = leftoversIn(stdout, folder, Math.ceil((Date.now() - startedAt) / 1000), process.pid);
  for (const { pid } of left) signal(pid, "SIGTERM");
  if (left.some(({ pid }) => isAlive(pid))) await new Promise((done) => setTimeout(done, STOP_GRACE));
  for (const { pid } of left) if (isAlive(pid)) signal(pid, "SIGKILL");
  return left;
};
