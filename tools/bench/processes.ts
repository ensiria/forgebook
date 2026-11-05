/**
 * A process tree's resident memory, read while it runs.
 *
 * @remarks
 * On macOS and Linux the table comes from `ps`, read on each sample. Windows has no `ps`: one PowerShell stays open for
 * the whole measurement and prints the table on each tick, since starting PowerShell costs more than the interval. The
 * working set is Windows' resident memory. Stopping the sampler has a deadline, like every wait of the benchmark on a
 * process (`processTree.ts`). Parsing is pure.
 *
 * @module
 */
import { spawn } from "node:child_process";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { powershellArgs } from "./powershell.ts";
import { STOP_TIMEOUT } from "./processTree.ts";
import { execProgram } from "./programs.ts";

/** How long one reading of the process table may take, in milliseconds. */
const TABLE_TIMEOUT = 60_000;

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
        // a sampler stuck in a WMI query must not hold the measurement: its peak so far is the answer
        const timer = setTimeout(() => resolve(peak), STOP_TIMEOUT);
        sampler.once("exit", () => {
          clearTimeout(timer);
          resolve(peak);
        });
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
      const { stdout } = await execProgram("ps", ["-A", "-o", "pid=,ppid=,rss="], {
        io,
        output: "capture",
        timeoutMs: TABLE_TIMEOUT
      });
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
