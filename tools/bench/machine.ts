/**
 * What the machine is and how loaded it is, so every result carries the conditions it was taken in.
 *
 * @remarks
 * Each system is read with what it has. macOS: its own commands (`pmset`, `tmutil`, `mdutil`, `top`). Windows: one
 * PowerShell reading the battery, the antivirus Windows knows, the power plan and two snapshots of the processes'
 * raw CPU counters a second apart, so the shares are computed here; the formatted counters would be the interval
 * WMI chose, and `Get-Counter` takes names that change with the system's language. Linux: `/sys/class/power_supply`,
 * `/proc/stat`, `/proc/loadavg` and the watched processes in `/proc`, read twice a second apart. A reading a system
 * cannot give is left out, never guessed. Parsing is pure.
 *
 * @module
 */
import { readdir, readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { MachineInfo, MachineReadings } from "./bench.types.ts";
import { powershellJson } from "./powershell.ts";
import { execProgram, TIME_LIMITS } from "./programs.ts";

/** Below this idle share a machine is too busy for its timings to be trusted. */
const MIN_IDLE_PERCENT = 85;

/** At or above this share of the machine, a background job (antivirus, indexer, updates) is called busy. */
const BUSY_PERCENT = 5;

/** The interval the CPU shares are read over, in milliseconds. */
const SAMPLE_MS = 1000;

/** The raw output of the macOS commands read. */
export type RawReadings = {
  /** `pmset -g batt`. */
  readonly battery: string;
  /** `pmset -g therm`. */
  readonly thermal: string;
  /** `tmutil status`. */
  readonly backup: string;
  /** `mdutil -s` on the volume, which answers for a mount point and not for a folder in it. */
  readonly indexing: string;
  /** `top -l 3 -n 0`. */
  readonly processes: string;
};

/**
 * Reads the macOS commands' output.
 *
 * @param raw - what they printed.
 */
export const parseReadings = (raw: RawReadings): MachineReadings => {
  const idle = [...raw.processes.matchAll(/([\d.]+)% idle/g)].at(-1)?.[1];
  const load = /Load Avg: ([\d.]+)/.exec(raw.processes)?.[1];
  const percent = /(\d+)%;/.exec(raw.battery)?.[1];
  return {
    isOnCharger: raw.battery.includes("AC Power"),
    batteryPercent: percent === undefined ? undefined : Number(percent),
    hasThermalWarning:
      !raw.thermal.includes("No thermal warning") || !raw.thermal.includes("No performance warning"),
    isBackingUp: /Running = 1/.test(raw.backup),
    isIndexed: !raw.indexing.includes("Indexing disabled"),
    idlePercent: idle === undefined ? undefined : Number(idle),
    load: load === undefined ? undefined : Number(load)
  };
};

/** The background jobs whose CPU a reading watches. */
const JOBS = ["antivirus", "indexer", "updates"] as const;

/** A background job whose CPU a reading watches. */
type Job = (typeof JOBS)[number];

/** The Windows processes of each job, as the performance counters name them (no `.exe`, no `#n`). */
const WINDOWS_JOBS: Readonly<Record<Job, readonly string[]>> = {
  antivirus: ["MsMpEng", "MpDefenderCoreService", "NisSrv"],
  indexer: ["SearchIndexer", "SearchProtocolHost", "SearchFilterHost"],
  updates: ["TiWorker", "TrustedInstaller", "MoUsoCoreWorker", "wuauclt"]
};

/** The Linux processes of each job, as `/proc/<pid>/stat` names them: cut at 15 characters. */
const LINUX_JOBS: Readonly<Record<Job, readonly string[]>> = {
  antivirus: ["clamd", "clamscan", "freshclam"],
  indexer: [
    "tracker-miner-fs-3",
    "tracker-extract-3",
    "localsearch-3",
    "localsearch-extractor-3",
    "baloo_file",
    "baloo_file_extractor"
  ],
  updates: ["packagekitd", "unattended-upgrades", "apt", "apt-get", "dpkg", "snapd"]
};

/** Which job a process name belongs to, if any. */
const jobOf = (jobs: Readonly<Record<Job, readonly string[]>>, name: string, cut: number): Job | undefined =>
  JOBS.find((job) =>
    jobs[job].some((watched) => watched.slice(0, cut).toLowerCase() === name.slice(0, cut).toLowerCase())
  );

/** A share, rounded to a tenth, never below zero: a process that ended between two snapshots lost its ticks. */
const share = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.max(0, Math.round((part / whole) * 1000) / 10);

/** The CPU time each job used between two snapshots, summed over its processes. */
const jobTimes = (
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
  jobOfName: (name: string) => Job | undefined
): Record<Job, number> => {
  const times: Record<Job, number> = { antivirus: 0, indexer: 0, updates: 0 };
  for (const [name, time] of after) {
    const job = jobOfName(name);
    const earlier = before.get(name);
    if (job !== undefined && earlier !== undefined) times[job] += Math.max(0, time - earlier);
  }
  return times;
};

/** What the Windows script printed, before it is checked. */
type UnknownRecord = Readonly<Record<string, unknown>>;

/** Whether a value is an object with string keys. */
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

/** A list PowerShell may have printed as one object, or nothing, when it had one entry or none. */
const listOf = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
};

/** A counter PowerShell printed as a string, so a 64-bit value keeps its digits. */
const counter = (value: unknown): bigint | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
};

/** A Windows snapshot's processes: CPU time by name, in 100 ns, the instances of one program summed. */
const windowsSnapshot = (value: unknown): Map<string, number> => {
  const times = new Map<string, number>();
  for (const row of listOf(isRecord(value) ? value["processes"] : undefined)) {
    const time = counter(row["time"]);
    if (typeof row["name"] !== "string" || time === undefined) continue;
    times.set(row["name"], (times.get(row["name"]) ?? 0) + Number(time));
  }
  return times;
};

/** The power plans Windows ships, by their fixed ids; the plan's own name is in the system's language. */
const POWER_PLANS: Readonly<Record<string, string>> = {
  "381b4222-f694-41f0-9685-ff5bb260df2e": "balanced",
  "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c": "high performance",
  "a1841308-3541-4fab-bc81-f71556f20b4a": "power saver",
  "e9a42b02-d5df-448d-aa00-03f14749eb61": "ultimate performance"
};

/** The power plan `powercfg /getactivescheme` names. */
const powerPlanOf = (text: unknown): string | undefined => {
  if (typeof text !== "string") return undefined;
  const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(text)?.[1]?.toLowerCase();
  if (id === undefined) return undefined;
  return POWER_PLANS[id] ?? /\(([^)]+)\)\s*$/.exec(text.trim())?.[1] ?? id;
};

/**
 * Battery states Windows reports while on the mains: unknown on AC, fully charged, charging (in its four forms).
 * Discharging, low and critical are on battery.
 */
const MAINS_BATTERY_STATES = new Set([2, 3, 6, 7, 8, 9]);

/** Whether an antivirus product's state says it scans: the second byte of `productState`, bit 4. */
const isProductScanning = (state: unknown): boolean =>
  typeof state === "number" && ((state >> 8) & 0xff & 0x10) !== 0;

/**
 * Reads what the Windows script printed.
 *
 * @param document - the script's JSON: `battery`, `antivirus`, `defenderRealTime`, `plan`, `cpus`, and two snapshots
 * `first` and `second` of the watched processes' raw CPU time, with the `Idle` process among them and a time stamp.
 * @returns the readings; nothing when the document is not the script's.
 */
export const parseWindowsReadings = (document: unknown): MachineReadings | undefined => {
  if (!isRecord(document)) return undefined;
  const cpuCount = typeof document["cpus"] === "number" && document["cpus"] > 0 ? document["cpus"] : 1;
  const stamp = (snapshot: unknown): bigint | undefined =>
    isRecord(snapshot) ? counter(snapshot["stamp"]) : undefined;
  const [start, end] = [stamp(document["first"]), stamp(document["second"])];
  const before = windowsSnapshot(document["first"]);
  const after = windowsSnapshot(document["second"]);
  // the idle process's time is summed over every core, as is each process's
  const elapsed = start === undefined || end === undefined ? 0 : Number(end - start) * cpuCount;
  const idleBefore = before.get("Idle");
  const idleAfter = after.get("Idle");
  const times = jobTimes(before, after, (name) => jobOf(WINDOWS_JOBS, name, Number.POSITIVE_INFINITY));
  const batteries = listOf(document["battery"]);
  const charge = batteries[0]?.["charge"];
  const products = listOf(document["antivirus"]);
  const plan = powerPlanOf(document["plan"]);
  return {
    isOnCharger: batteries.every((battery) => MAINS_BATTERY_STATES.has(Number(battery["status"]))),
    batteryPercent: typeof charge === "number" ? charge : undefined,
    hasThermalWarning: undefined,
    isBackingUp: undefined,
    isIndexed: undefined,
    idlePercent:
      idleBefore === undefined || idleAfter === undefined || elapsed <= 0
        ? undefined
        : Math.min(100, share(idleAfter - idleBefore, elapsed)),
    load: undefined,
    antivirus: products.map((product) => String(product["name"])),
    isScanningFiles:
      document["defenderRealTime"] === true ||
      products.some((product) => isProductScanning(product["state"])),
    antivirusCpuPercent: share(times.antivirus, elapsed),
    indexerCpuPercent: share(times.indexer, elapsed),
    updatesCpuPercent: share(times.updates, elapsed),
    ...(plan === undefined ? {} : { powerPlan: plan })
  };
};

/** A power supply in `/sys/class/power_supply`, its files as read. */
export type LinuxPowerSupply = {
  /** `type`: `Mains`, `Battery`, `USB`… */
  readonly type: string | undefined;
  /** `online`, for a mains supply: `1` when plugged in. */
  readonly online: string | undefined;
  /** `status`, for a battery: `Discharging`, `Charging`, `Full`… */
  readonly status: string | undefined;
  /** `capacity`, for a battery: its charge, 0 to 100. */
  readonly capacity: string | undefined;
};

/** One Linux snapshot. */
export type LinuxSnapshot = {
  /** The first line of `/proc/stat`: every CPU's ticks, by kind. */
  readonly stat: string;
  /** The watched processes: each `/proc/<pid>/stat` line. */
  readonly processes: readonly string[];
};

/** What is read of a Linux machine. */
export type LinuxRaw = {
  /** Its power supplies. */
  readonly supplies: readonly LinuxPowerSupply[];
  /** `/proc/loadavg`. */
  readonly loadavg: string;
  /** A snapshot, then another a second later. */
  readonly before: LinuxSnapshot;
  /** The later snapshot. */
  readonly after: LinuxSnapshot;
};

/** The ticks of `/proc/stat`'s `cpu` line: all of them, and the idle ones (idle and waiting for a disk). */
const statTicks = (line: string): { readonly total: number; readonly idle: number } => {
  const ticks = line.trim().split(/\s+/).slice(1).map(Number);
  const [, , , idle = 0, iowait = 0] = ticks;
  // guest time is already counted in user time
  const total = ticks.slice(0, 8).reduce((sum, tick) => sum + tick, 0);
  return { total, idle: idle + iowait };
};

/** A process's name and CPU ticks from its `/proc/<pid>/stat` line; its name may hold spaces and parentheses. */
const processTicks = (line: string): { readonly name: string; readonly ticks: number } | undefined => {
  const open = line.indexOf("(");
  const close = line.lastIndexOf(")");
  if (open < 0 || close < open) return undefined;
  const fields = line
    .slice(close + 1)
    .trim()
    .split(/\s+/);
  // after the name: state is field 3 of the line, user time 14 and system time 15
  const user = Number(fields[11]);
  const system = Number(fields[12]);
  if (!Number.isFinite(user) || !Number.isFinite(system)) return undefined;
  return { name: line.slice(open + 1, close), ticks: user + system };
};

/** A Linux snapshot's processes: ticks by name. */
const linuxSnapshot = (snapshot: LinuxSnapshot): Map<string, number> => {
  const times = new Map<string, number>();
  for (const line of snapshot.processes) {
    const parsed = processTicks(line);
    if (parsed !== undefined) times.set(parsed.name, (times.get(parsed.name) ?? 0) + parsed.ticks);
  }
  return times;
};

/** How many characters of a name the kernel keeps in `/proc/<pid>/stat`. */
const LINUX_NAME_LENGTH = 15;

/**
 * Reads what a Linux machine's files say.
 *
 * @param raw - the files.
 */
export const parseLinuxReadings = (raw: LinuxRaw): MachineReadings => {
  const before = statTicks(raw.before.stat);
  const after = statTicks(raw.after.stat);
  const elapsed = after.total - before.total;
  const times = jobTimes(linuxSnapshot(raw.before), linuxSnapshot(raw.after), (name) =>
    jobOf(LINUX_JOBS, name, LINUX_NAME_LENGTH)
  );
  const batteries = raw.supplies.filter((supply) => supply.type === "Battery");
  const mains = raw.supplies.filter((supply) => supply.type === "Mains");
  const isOnMains =
    mains.some((supply) => supply.online === "1") ||
    (mains.length === 0 && batteries.every((battery) => battery.status !== "Discharging"));
  const capacity = batteries[0]?.capacity;
  const load = raw.loadavg.trim().split(/\s+/)[0];
  return {
    isOnCharger: batteries.length === 0 || isOnMains,
    batteryPercent: capacity === undefined ? undefined : Number(capacity),
    hasThermalWarning: undefined,
    isBackingUp: undefined,
    isIndexed: undefined,
    idlePercent: elapsed > 0 ? share(after.idle - before.idle, elapsed) : undefined,
    load: load === undefined || load === "" ? undefined : Number(load),
    antivirusCpuPercent: share(times.antivirus, elapsed),
    indexerCpuPercent: share(times.indexer, elapsed),
    updatesCpuPercent: share(times.updates, elapsed)
  };
};

/** A background job's warning, when it is busy. */
const busy = (percent: number | undefined, what: string): string[] =>
  percent !== undefined && percent >= BUSY_PERCENT ? [`${what} busy (${percent}% CPU)`] : [];

/**
 * What in the readings may disturb a measurement.
 *
 * @param readings - the machine's readings.
 */
export const noiseWarnings = (readings: MachineReadings): string[] => [
  ...(readings.isOnCharger ? [] : ["on battery"]),
  ...(readings.hasThermalWarning === true ? ["thermal warning"] : []),
  ...(readings.isBackingUp === true ? ["backup running"] : []),
  ...(readings.isIndexed === true ? ["volume indexed"] : []),
  ...(readings.idlePercent !== undefined && readings.idlePercent < MIN_IDLE_PERCENT
    ? [`only ${readings.idlePercent}% idle`]
    : []),
  ...busy(readings.antivirusCpuPercent, "antivirus"),
  ...busy(readings.indexerCpuPercent, "indexer"),
  ...busy(readings.updatesCpuPercent, "system updates"),
  ...(readings.powerPlan === "power saver" ? ["power saver plan"] : [])
];

/**
 * The machine, described.
 *
 * @param node - Node's version.
 * @param os - the system's own name, where `release()` is only a kernel's number.
 */
export const machineInfo = (node: string, os?: string): MachineInfo => ({
  platform: `${platform()}-${arch()}`,
  system: release(),
  cpu: cpus()[0]?.model ?? "unknown",
  cpus: cpus().length,
  memory: totalmem(),
  node,
  ...(os === undefined ? {} : { os })
});

/**
 * The `PRETTY_NAME` of an `/etc/os-release`.
 *
 * @param text - the file.
 */
export const osReleaseName = (text: string): string | undefined => {
  const value = /^PRETTY_NAME=(.*)$/m.exec(text)?.[1]?.trim();
  return value?.replace(/^(["'])(.*)\1$/, "$2") || undefined;
};

/**
 * The system's own name, on the systems whose `release()` does not say it.
 *
 * @param io - the script's streams.
 * @returns Windows' caption, Linux's distribution, nothing on macOS or when it cannot be read.
 */
export const systemName = async (io: ScriptIo): Promise<string | undefined> => {
  if (platform() === "win32") {
    const name = await powershellJson(
      "(Get-CimInstance Win32_OperatingSystem).Caption | ConvertTo-Json -Compress",
      io
    );
    return typeof name === "string" ? name.trim() : undefined;
  }
  if (platform() === "linux") {
    const text = await readFile("/etc/os-release", "utf8").catch(() => "");
    return osReleaseName(text);
  }
  return undefined;
};

/** The mount point of a folder's volume. */
const mountPoint = async (directory: string, io: ScriptIo): Promise<string> => {
  const { stdout } = await execProgram("df", [directory], {
    io,
    output: "capture",
    timeoutMs: TIME_LIMITS.query
  });
  return stdout.trim().split("\n").at(-1)?.split(/\s+/).at(-1) ?? directory;
};

/** The macOS readings. */
const readMacos = async (directory: string, io: ScriptIo): Promise<MachineReadings> => {
  const read = async (command: string, args: readonly string[]): Promise<string> => {
    const { stdout } = await execProgram(command, args, {
      io,
      check: false,
      output: "capture",
      timeoutMs: TIME_LIMITS.query
    });
    return stdout;
  };
  return parseReadings({
    battery: await read("pmset", ["-g", "batt"]),
    thermal: await read("pmset", ["-g", "therm"]),
    backup: await read("tmutil", ["status"]),
    indexing: await read("mdutil", ["-s", await mountPoint(directory, io)]),
    processes: await read("top", ["-l", "3", "-n", "0"])
  });
};

/** The Windows script: everything in one PowerShell, whose start costs more than the readings. */
const WINDOWS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$watched = @('Idle', ${Object.values(WINDOWS_JOBS)
  .flat()
  .map((name) => `'${name}'`)
  .join(", ")})
function Snapshot {
  $rows = @(Get-CimInstance Win32_PerfRawData_PerfProc_Process -Property Name,PercentProcessorTime,Timestamp_Sys100NS |
    Where-Object { $watched -contains ($_.Name -replace '#\\d+$', '') })
  $idle = $rows | Where-Object { $_.Name -eq 'Idle' } | Select-Object -First 1
  @{
    stamp = [string]$idle.Timestamp_Sys100NS
    processes = @($rows | ForEach-Object { @{ name = ($_.Name -replace '#\\d+$', ''); time = [string]$_.PercentProcessorTime } })
  }
}
$first = Snapshot
Start-Sleep -Milliseconds ${SAMPLE_MS}
$second = Snapshot
@{
  cpus = [Environment]::ProcessorCount
  battery = @(Get-CimInstance Win32_Battery | ForEach-Object { @{ status = [int]$_.BatteryStatus; charge = [int]$_.EstimatedChargeRemaining } })
  antivirus = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object { @{ name = [string]$_.displayName; state = [int]$_.productState } })
  defenderRealTime = [bool](Get-MpComputerStatus).RealTimeProtectionEnabled
  plan = ((powercfg /getactivescheme) -join ' ')
  first = $first
  second = $second
} | ConvertTo-Json -Depth 6 -Compress
`;

/** A file's text, trimmed, or nothing when it cannot be read. */
const readTrimmed = async (path: string): Promise<string | undefined> => {
  const text = await readFile(path, "utf8").catch(() => undefined);
  return text?.trim();
};

/** The power supplies Linux lists. */
const linuxSupplies = async (): Promise<LinuxPowerSupply[]> => {
  const folder = "/sys/class/power_supply";
  const names = await readdir(folder).catch(() => []);
  return Promise.all(
    names.map(async (name) => ({
      type: await readTrimmed(join(folder, name, "type")),
      online: await readTrimmed(join(folder, name, "online")),
      status: await readTrimmed(join(folder, name, "status")),
      capacity: await readTrimmed(join(folder, name, "capacity"))
    }))
  );
};

/** A Linux snapshot: the CPU line, and the watched processes' lines. */
const linuxSnapshotNow = async (): Promise<LinuxSnapshot> => {
  const stat = (await readFile("/proc/stat", "utf8")).split("\n")[0] ?? "";
  const pids = (await readdir("/proc")).filter((entry) => /^\d+$/.test(entry));
  const lines = await Promise.all(pids.map((pid) => readTrimmed(join("/proc", pid, "stat"))));
  const processes = lines.filter((line): line is string => {
    if (line === undefined) return false;
    const name = processTicks(line)?.name;
    return name !== undefined && jobOf(LINUX_JOBS, name, LINUX_NAME_LENGTH) !== undefined;
  });
  return { stat, processes };
};

/** The Linux readings. */
const readLinux = async (): Promise<MachineReadings> => {
  const before = await linuxSnapshotNow();
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_MS));
  const after = await linuxSnapshotNow();
  return parseLinuxReadings({
    supplies: await linuxSupplies(),
    loadavg: (await readTrimmed("/proc/loadavg")) ?? "",
    before,
    after
  });
};

/**
 * The machine's load now.
 *
 * @param directory - the folder measured in, whose volume's indexing is read on macOS.
 * @param io - the script's streams.
 * @returns the readings, or nothing on a system with none or when they cannot be read.
 */
export const readMachine = async (directory: string, io: ScriptIo): Promise<MachineReadings | undefined> => {
  switch (platform()) {
    case "darwin":
      return readMacos(directory, io).catch(() => undefined);
    case "win32":
      return parseWindowsReadings(await powershellJson(WINDOWS_SCRIPT, io));
    case "linux":
      return readLinux().catch(() => undefined);
    default:
      return undefined;
  }
};
