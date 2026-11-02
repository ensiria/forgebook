/**
 * A dev server's process tree: its resident memory, read while it runs, and stopping all of it.
 *
 * @remarks
 * On macOS and Linux the table comes from `ps`, read on each sample, and the tree is stopped through its process
 * group. Windows has neither: one PowerShell stays open for the whole measurement and prints the table on each tick,
 * since starting PowerShell costs more than the interval, and the tree is stopped with `taskkill /T`. The working set
 * is Windows' resident memory. Parsing is pure.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { powershellArgs } from "./powershell.ts";

/** A process, as the table lists it. */
export type ProcessRow = {
  /** Its id. */
  readonly pid: number;
  /** Its parent's id. */
  readonly parent: number;
  /** Its resident memory, in bytes. */
  readonly memory: number;
};

/**
 * The rows of `ps -A -o pid=,ppid=,rss=`, whose memory is in kilobytes.
 *
 * @param stdout - what it printed.
 */
export const parsePsRows = (stdout: string): ProcessRow[] =>
  stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .map(([pid = 0, parent = 0, rss = 0]) => ({ pid, parent, memory: rss * 1024 }));

/**
 * The rows of one Windows tick: `pid parent bytes` entries separated by `;`.
 *
 * @param line - the tick's line.
 */
export const parseWindowsRows = (line: string): ProcessRow[] =>
  line
    .split(";")
    .map((entry) => entry.trim().split(/\s+/).map(Number))
    .filter((numbers) => numbers.length === 3 && numbers.every(Number.isFinite))
    .map(([pid = 0, parent = 0, memory = 0]) => ({ pid, parent, memory }));

/**
 * The memory of a process and everything it started, in bytes.
 *
 * @param rows - the process table.
 * @param root - the tree's root.
 */
export const treeMemory = (rows: readonly ProcessRow[], root: number): number => {
  const tree = new Set([root]);
  let isGrowing = true;
  while (isGrowing) {
    isGrowing = false;
    for (const { pid, parent } of rows) {
      // a process is never its own child: Windows lists the idle process as its own parent
      if (pid !== parent && tree.has(parent) && !tree.has(pid)) {
        tree.add(pid);
        isGrowing = true;
      }
    }
  }
  return rows.reduce((sum, { pid, memory }) => (tree.has(pid) ? sum + memory : sum), 0);
};

/** The script of the Windows sampler: the table on one line, every interval, until it is stopped. */
const windowsSampler = (intervalMs: number): string => `
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $rows = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize |
    ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.WorkingSetSize)" }
  [Console]::Out.WriteLine($rows -join ';')
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds ${intervalMs}
}`;

/** A peak being read. */
export type PeakSampler = {
  /** Stops reading and gives the highest memory seen, in bytes. */
  readonly stop: () => Promise<number>;
};

/** The peak on Windows: one PowerShell for the whole measurement, a line per tick. */
const windowsPeak = (root: number, intervalMs: number, io: ScriptIo): PeakSampler => {
  let peak = 0;
  let pending = "";
  const sampler = spawn("powershell.exe", powershellArgs(windowsSampler(intervalMs)), {
    env: io.env,
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  sampler.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    const lines = `${pending}${chunk}`.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) peak = Math.max(peak, treeMemory(parseWindowsRows(line), root));
  });
  return {
    stop: () =>
      new Promise((resolve) => {
        if (sampler.exitCode !== null || sampler.signalCode !== null) {
          resolve(peak);
          return;
        }
        sampler.once("exit", () => resolve(peak));
        sampler.kill();
      })
  };
};

/** The peak elsewhere: `ps` on each sample, between pauses. */
const psPeak = (root: number, intervalMs: number, io: ScriptIo): PeakSampler => {
  let peak = 0;
  let isDone = false;
  const sampling = (async (): Promise<void> => {
    while (!isDone) {
      const { stdout } = await exec("ps", ["-A", "-o", "pid=,ppid=,rss="], { io, output: "capture" });
      peak = Math.max(peak, treeMemory(parsePsRows(stdout), root));
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  })();
  return {
    stop: async () => {
      isDone = true;
      await sampling;
      return peak;
    }
  };
};

/**
 * Starts reading the peak memory of a process tree.
 *
 * @param root - the tree's root.
 * @param intervalMs - the pause between two readings, in milliseconds.
 * @param io - the script's streams.
 */
export const samplePeak = (root: number, intervalMs: number, io: ScriptIo): PeakSampler =>
  process.platform === "win32" ? windowsPeak(root, intervalMs, io) : psPeak(root, intervalMs, io);

/**
 * Whether a server is started in a process group of its own: on macOS and Linux, so stopping the group stops what it
 * started. Windows has no such group; a detached process there gets a console window of its own instead.
 */
export const isOwnGroup = process.platform !== "win32";

/**
 * Stops a process and everything it started, at once.
 *
 * @param child - the process, started with `detached: isOwnGroup`.
 */
export const killTree = (child: ChildProcess): void => {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  process.kill(-child.pid, "SIGKILL");
};
