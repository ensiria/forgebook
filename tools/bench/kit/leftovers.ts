/**
 * What a benchmark that died leaves running: its dev servers and its browser, stopped before the next part starts.
 *
 * @remarks
 * The benchmark stops its servers when it ends, even interrupted, but a crash of Node itself skips that, and a server
 * left behind holds its port (the next part fails to start) and its CPU (every later number pays for it). Only
 * processes whose command line names one of the kit's own folders are stopped: the tools it installed, the projects
 * it measures, the browsers it downloaded. Nothing of the person's is ever touched. Matching is pure.
 *
 * @module
 */
import { spawnSync } from "node:child_process";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { powershellJson } from "../powershell.ts";

/** A process and how it was started. */
export type ProcessLine = {
  /** Its id. */
  readonly pid: number;
  /** Its command line. */
  readonly command: string;
};

/**
 * The processes to stop: those started from one of the folders, except the ones named.
 *
 * @param processes - every process.
 * @param folders - the kit's folders; a command line naming one, in any case or with either separator, matches.
 * @param spared - processes never stopped: this one and the one that started it.
 */
export const leftoverPids = (
  processes: readonly ProcessLine[],
  folders: readonly string[],
  spared: readonly number[]
): number[] => {
  const needles = folders.flatMap((folder) => {
    const forward = folder.replaceAll("\\", "/").toLowerCase();
    return [forward, forward.replaceAll("/", "\\")];
  });
  return processes
    .filter(({ pid, command }) => {
      if (spared.includes(pid)) return false;
      const text = command.toLowerCase();
      return needles.some((needle) => text.includes(needle));
    })
    .map(({ pid }) => pid);
};

/**
 * The rows of `ps -A -o pid=,command=`.
 *
 * @param stdout - what it printed.
 */
export const parsePsCommands = (stdout: string): ProcessLine[] =>
  stdout
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.*)$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), command: match[2] ?? "" }));

/** Every process with its command line, on this system. */
const processLines = async (io: ScriptIo): Promise<ProcessLine[]> => {
  if (process.platform !== "win32") {
    const { stdout } = await exec("ps", ["-A", "-o", "pid=,command="], {
      io,
      output: "capture",
      check: false
    });
    return parsePsCommands(stdout);
  }
  const rows = await powershellJson(
    "@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | " +
      "ForEach-Object { @{ pid = [int]$_.ProcessId; command = [string]$_.CommandLine } }) | ConvertTo-Json -Compress",
    io
  );
  const list = Array.isArray(rows) ? rows : [rows];
  return list.flatMap((row: unknown) =>
    typeof row === "object" &&
    row !== null &&
    "pid" in row &&
    "command" in row &&
    typeof row.pid === "number" &&
    typeof row.command === "string"
      ? [{ pid: row.pid, command: row.command }]
      : []
  );
};

/**
 * Stops whatever an earlier benchmark left running from the kit's folders.
 *
 * @param folders - the kit's folders.
 * @param io - the script's streams.
 * @returns how many processes were stopped.
 */
export const stopLeftovers = async (folders: readonly string[], io: ScriptIo): Promise<number> => {
  const pids = leftoverPids(await processLines(io), folders, [process.pid, process.ppid]);
  for (const pid of pids) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // it ended on its own meanwhile
      }
    }
  }
  return pids.length;
};
