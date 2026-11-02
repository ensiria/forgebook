/**
 * What a run leaves running, and how it keeps from leaving anything: the tools' daemons turned off in every command it
 * runs in a library, and the processes still alive from its folders stopped and named.
 *
 * @remarks
 * A library's own build tool may start a daemon that outlives the command: Nx's (Fluent UI's `prepare` builds with Nx)
 * kept a core busy for hours under every later run. The commands get the variables that turn such daemons off; whatever
 * still runs from the work folder when the run ends, started during it, is stopped. A benchmark that crashed skips
 * that, so the bench kit also stops, between its parts, whatever runs from its folders at all. Only a process whose
 * command line names one of the folders is stopped, never the run itself nor what started it. The table comes from
 * `ps` on macOS and Linux and from the system's process list on Windows, where a path may be written with either
 * separator and in any case. Parsing and matching are pure and tested.
 *
 * @module
 */
import { spawnSync } from "node:child_process";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { powershellJson } from "./powershell.ts";

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

/** A process of the system's table. */
export type ProcessEntry = Leftover & {
  /** Its parent's id. */
  readonly parent: number;
  /** How long it has run, in seconds. */
  readonly seconds: number;
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
 * The rows of `ps -A -o pid=,ppid=,etime=,command=`.
 *
 * @param table - what `ps` printed.
 */
export const parsePsTable = (table: string): ProcessEntry[] =>
  table
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

/** What a command line is matched on: lower case, `/` for every separator. */
const comparable = (text: string): string => text.replaceAll("\\", "/").toLowerCase();

/**
 * The processes that run from one of the folders, apart from a process and every one that started it.
 *
 * @param rows - the system's processes.
 * @param folders - the folders; a command line naming one, with either separator and in any case, matches.
 * @param self - the process asking, spared with its ancestors.
 * @param maxSeconds - only processes that have run at most this long; none takes them whatever their age.
 */
export const leftoversAmong = (
  rows: readonly ProcessEntry[],
  folders: readonly string[],
  self: number,
  maxSeconds?: number
): Leftover[] => {
  const parents = new Map(rows.map((row) => [row.pid, row.parent]));
  const own = new Set<number>();
  for (
    let pid: number | undefined = self;
    pid !== undefined && pid > 1 && !own.has(pid);
    pid = parents.get(pid)
  )
    own.add(pid);
  const needles = folders.map(comparable);
  return rows
    .filter(
      (row) =>
        !own.has(row.pid) &&
        (maxSeconds === undefined || row.seconds <= maxSeconds) &&
        needles.some((needle) => comparable(row.command).includes(needle))
    )
    .map(({ pid, command }) => ({ pid, command }));
};

/**
 * The processes of a `ps` table that run from the folder and started within the run, apart from the run itself and
 * the processes that started it.
 *
 * @param table - what `ps -A -o pid=,ppid=,etime=,command=` printed.
 * @param folder - the work folder.
 * @param runSeconds - how long the run has lasted, in seconds.
 * @param self - the run's own process id.
 */
export const leftoversIn = (table: string, folder: string, runSeconds: number, self: number): Leftover[] =>
  leftoversAmong(parsePsTable(table), [folder], self, runSeconds);

/**
 * A command line's program, by its file name without folder or extension: what a message may name without a path.
 *
 * @param command - the command line.
 */
export const programName = (command: string): string => {
  const program = command.startsWith('"')
    ? command.slice(1, command.indexOf('"', 1))
    : (command.split(" ")[0] ?? "");
  return (program.split(/[\\/]/).at(-1) ?? program).replace(/\.exe$/i, "");
};

/** The Windows process list, as `ps` would give it. */
const WINDOWS_TABLE = `@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object {
  @{ pid = [int]$_.ProcessId; parent = [int]$_.ParentProcessId; seconds = [int]((Get-Date) - $_.CreationDate).TotalSeconds; command = [string]$_.CommandLine }
}) | ConvertTo-Json -Compress`;

/** A Windows row, checked. */
const windowsEntry = (row: unknown): ProcessEntry[] => {
  if (typeof row !== "object" || row === null) return [];
  const field = (key: string): unknown => Reflect.get(row, key);
  const [pid, parent, seconds, command] = [field("pid"), field("parent"), field("seconds"), field("command")];
  return typeof pid === "number" &&
    typeof parent === "number" &&
    typeof seconds === "number" &&
    typeof command === "string"
    ? [{ pid, parent, seconds, command }]
    : [];
};

/** The system's processes. */
const processTable = async (io: ScriptIo): Promise<ProcessEntry[]> => {
  if (process.platform !== "win32") {
    const { stdout } = await exec("ps", ["-A", "-o", "pid=,ppid=,etime=,command="], {
      io,
      output: "capture"
    });
    return parsePsTable(stdout);
  }
  const rows = await powershellJson(WINDOWS_TABLE, io);
  return (Array.isArray(rows) ? rows : [rows]).flatMap(windowsEntry);
};

/**
 * Stops what runs from the folders.
 *
 * @param folders - the folders.
 * @param startedAt - when the run started, in milliseconds since the epoch: only what started since is stopped; none
 * stops it whatever its age.
 * @param io - the script's streams.
 * @returns the processes it stopped.
 */
export const stopLeftovers = async (
  folders: readonly string[],
  startedAt: number | undefined,
  io: ScriptIo
): Promise<readonly Leftover[]> => {
  const maxSeconds = startedAt === undefined ? undefined : Math.ceil((Date.now() - startedAt) / 1000);
  const left = leftoversAmong(await processTable(io), folders, process.pid, maxSeconds);
  for (const { pid } of left) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone meanwhile
    }
  }
  return left;
};
