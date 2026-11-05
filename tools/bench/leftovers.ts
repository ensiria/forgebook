/**
 * What a run leaves running, and how it keeps from leaving anything: the tools' daemons turned off in every command it
 * runs in a library, and the processes still alive at the end stopped and named.
 *
 * @remarks
 * A library's own build tool may start a daemon that outlives the command, as Nx does (Fluent UI's `prepare` builds
 * with Nx), and keeps a core busy under every later run. The commands get the variables that turn such daemons off
 * (`toolEnvironment.ts`); what the run started and is still alive when it ends is stopped. A benchmark that crashed
 * skips that, so the bench kit also stops, between its parts, whatever runs from its own folders at all
 * (`folderLeftovers`). The table comes from `ps` on macOS and Linux and from the system's process list on Windows,
 * where a path may be written with either separator and in any case, and where a process whose parent ended keeps the
 * dead parent's id instead of being adopted. Parsing and matching are pure and tested.
 *
 * @module
 */

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { powershellJson } from "./powershell.ts";
import { killTree } from "./processTree.ts";
import { execProgram, TIME_LIMITS } from "./programs.ts";

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

/** A process of the system's table. */
export type ProcessEntry = Leftover & {
  /** Its parent's id. */
  readonly parent: number;
  /** How long it has run, in seconds. */
  readonly seconds: number;
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

/** What a command line or a folder is matched on: lower case, `/` for every separator. */
const comparable = (text: string): string => text.replaceAll("\\", "/").toLowerCase();

/** Whether a command line names a path inside the folder: the folder followed by a separator, not a prefix of another. */
const namesPathIn = (command: string, folder: string): boolean => {
  const path = comparable(folder);
  return comparable(command).includes(path.endsWith("/") ? path : `${path}/`);
};

/** A process and every one that started it, as far as the table knows them. */
const lineOf = (rows: readonly ProcessEntry[], self: number): Set<number> => {
  const parents = new Map(rows.map((row) => [row.pid, row.parent]));
  const own = new Set<number>();
  for (
    let pid: number | undefined = self;
    pid !== undefined && pid > 1 && !own.has(pid);
    pid = parents.get(pid)
  )
    own.add(pid);
  return own;
};

/**
 * The processes the run left behind: its own descendants still alive, and the daemons that detached from them and run
 * from the work folder, started during the run. The run itself and the processes that started it are never among them.
 *
 * @remarks
 * Matching the folder alone would reach another run's processes, or a person's editor on a report: only a process
 * this run started, or one that left its parent to outlive it, can be this run's leftover. A detached process is
 * adopted by the system's first process on macOS and Linux; on Windows it keeps its dead parent's id, so a parent
 * missing from the table counts the same.
 *
 * @param rows - the system's processes.
 * @param folder - the work folder.
 * @param runSeconds - how long the run has lasted, in seconds.
 * @param self - the run's own process id.
 * @param platform - the system the table comes from: on Windows an orphan keeps its dead parent's id.
 */
export const runLeftovers = (
  rows: readonly ProcessEntry[],
  folder: string,
  runSeconds: number,
  self: number,
  platform: NodeJS.Platform = process.platform
): Leftover[] => {
  const parents = new Map(rows.map((row) => [row.pid, row.parent]));
  const own = lineOf(rows, self);
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
  const isDetached = (row: ProcessEntry): boolean =>
    (row.parent === 1 || (platform === "win32" && !parents.has(row.parent))) &&
    row.seconds <= runSeconds &&
    namesPathIn(row.command, folder);
  return rows
    .filter((row) => !own.has(row.pid) && row.command !== LISTING_COMMAND)
    .filter((row) => isDescendant(row.pid) || isDetached(row))
    .map(({ pid, command }) => ({ pid, command }));
};

/**
 * The processes of a `ps` table the run left behind (`runLeftovers`).
 *
 * @param table - what `ps -A -o pid=,ppid=,etime=,command=` printed.
 * @param folder - the work folder.
 * @param runSeconds - how long the run has lasted, in seconds.
 * @param self - the run's own process id.
 */
export const leftoversIn = (table: string, folder: string, runSeconds: number, self: number): Leftover[] =>
  runLeftovers(parsePsTable(table), folder, runSeconds, self, "linux");

/**
 * The processes that run from one of the folders, whatever started them and whatever their age, apart from a process
 * and every one that started it: what an earlier run that crashed can have left in the bench kit's folders.
 *
 * @param rows - the system's processes.
 * @param folders - the folders; a command line naming a path inside one, with either separator and in any case,
 * matches.
 * @param self - the process asking, spared with its ancestors.
 */
export const folderLeftovers = (
  rows: readonly ProcessEntry[],
  folders: readonly string[],
  self: number
): Leftover[] => {
  const own = lineOf(rows, self);
  return rows
    .filter((row) => !own.has(row.pid) && row.command !== LISTING_COMMAND)
    .filter((row) => folders.some((folder) => namesPathIn(row.command, folder)))
    .map(({ pid, command }) => ({ pid, command }));
};

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

/** The Windows process list, in the shape of `ps`'s columns. */
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

/**
 * The system's processes.
 *
 * @param io - the script's streams.
 * @throws when the table cannot be read.
 */
export const processTable = async (io: ScriptIo): Promise<ProcessEntry[]> => {
  if (process.platform !== "win32") {
    const { stdout } = await execProgram("ps", PS_ARGS, {
      io,
      output: "capture",
      timeoutMs: TIME_LIMITS.query
    });
    return parsePsTable(stdout);
  }
  const rows = await powershellJson(WINDOWS_TABLE, io);
  if (rows === undefined) throw new Error("the list of Windows processes could not be read");
  return (Array.isArray(rows) ? rows : [rows]).flatMap(windowsEntry);
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
 * Stops processes: on Windows each with its tree, since `taskkill` is the only way there; elsewhere asked first,
 * then killed.
 *
 * @param left - the processes.
 */
export const stopProcesses = async (left: readonly Leftover[]): Promise<void> => {
  if (process.platform === "win32") {
    for (const { pid } of left) await killTree(pid);
    return;
  }
  for (const { pid } of left) signal(pid, "SIGTERM");
  if (left.some(({ pid }) => isAlive(pid))) await new Promise((done) => setTimeout(done, STOP_GRACE));
  for (const { pid } of left) if (isAlive(pid)) signal(pid, "SIGKILL");
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
  const runSeconds = Math.ceil((Date.now() - startedAt) / 1000);
  const left = runLeftovers(await processTable(io), folder, runSeconds, process.pid);
  await stopProcesses(left);
  return left;
};
