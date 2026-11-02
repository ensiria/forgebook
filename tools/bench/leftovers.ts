/**
 * What a run leaves running, and how it keeps from leaving anything: the tools' daemons turned off in every command it
 * runs in a library, and the processes still alive at the end stopped and named.
 *
 * @remarks
 * A library's own build tool may start a daemon that outlives the command: Nx's (Fluent UI's `prepare` builds with Nx)
 * kept a core busy for hours under every later run. The commands get the variables that turn such daemons off; whatever
 * still runs from the work folder when the run ends, started during it, is stopped. Parsing `ps` is pure and tested.
 *
 * @module
 */

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

/** The variables that keep a library's tools from starting a daemon that outlives the command. */
export const NO_DAEMONS: Readonly<Record<string, string>> = {
  // Nx's daemon and the workers of its plugins
  NX_DAEMON: "false",
  NX_ISOLATE_PLUGINS: "false",
  // Turborepo's daemon
  TURBO_DAEMON: "false"
};

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

/**
 * The processes of `ps -A -o pid=,ppid=,etime=,command=` that run from the folder and started within the run, apart
 * from the run itself and the processes that started it.
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
  return rows
    .filter((row) => !own.has(row.pid) && row.seconds <= runSeconds && row.command.includes(folder))
    .map(({ pid, command }) => ({ pid, command }));
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
  const { stdout } = await exec("ps", ["-A", "-o", "pid=,ppid=,etime=,command="], { io, output: "capture" });
  const left = leftoversIn(stdout, folder, Math.ceil((Date.now() - startedAt) / 1000), process.pid);
  for (const { pid } of left) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone meanwhile
    }
  }
  return left;
};
