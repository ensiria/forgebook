/**
 * The benchmark, run by the kit as a child process: one part or the calibration, its progress shown, its phases timed,
 * and stopped when it is stuck.
 *
 * @remarks
 * The kit looks at the run's log and status file every few seconds, by their size alone, and reads the status file
 * only when it grew, which happens only between measurements. Every minute it says where the run is; a run silent past
 * what its phase allows, or past its part's limit, is stopped with its whole tree, and the kit goes on (`kitWatch.ts`).
 * Each line the person sees is in the journal first (`kitJournal.ts`).
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { folderLeftovers, processTable, programName, stopProcesses } from "../leftovers.ts";
import { isOwnGroup, killTree, STOP_TIMEOUT, waitForExit } from "../processTree.ts";
import { parseReport } from "../reportTable.ts";
import {
  CALIBRATION_ARGS,
  type CalibrationTiming,
  formatDuration,
  type KitItem,
  type PhaseTiming,
  phaseTiming
} from "./kitPlan.ts";
import { BENCH, ITEM_NAMES, type KitPaths, PORT, REPOSITORY, RESULTS_HINT } from "./kitSession.ts";
import type { ItemOutcome, ItemState } from "./kitState.ts";
import {
  HEARTBEAT_INTERVAL,
  heartbeatLine,
  lastStatus,
  observe,
  partLimit,
  SILENCE_LIMITS,
  type StatusLine,
  startWatch,
  stoppedLine,
  type Verdict,
  verdict,
  type Watch,
  type WatchPhase
} from "./kitWatch.ts";

/** How often the kit looks at a run's files, in milliseconds: their sizes only, which costs nothing. */
const LOOK_INTERVAL = 15_000;

/** The longest a calibration may take, in milliseconds: a few minutes on any machine that can run the rest. */
const CALIBRATION_LIMIT = 60 * 60_000;

/** How a benchmark run ended. */
export type BenchRun = {
  /** Its exit code; none when it was stopped or could not start. */
  readonly exitCode: number | null;
  /** Its phases. */
  readonly timing: PhaseTiming;
  /** Why the kit stopped it, for a person, when it did. */
  readonly stopped?: string;
};

/** What a run of the benchmark is given. */
export type BenchRequest = {
  /** Its arguments, besides the work folder, the status file, the port and `--json`. */
  readonly args: readonly string[];
  /** Where it works. */
  readonly work: string;
  /** Its status file, emptied first. */
  readonly status: string;
  /** Its log. */
  readonly log: string;
  /** What to say of its progress. */
  readonly label: string;
  /** How long it may last in all, in milliseconds; none leaves only the silence to stop it. */
  readonly limitMs: number | undefined;
  /** How it is watched; the kit's own pace and limits by default, shorter in a test. */
  readonly watching?: Watching;
};

/** How a run is watched. */
export type Watching = {
  /** The script run in the benchmark's place. */
  readonly entry: string;
  /** How often its files are looked at, in milliseconds. */
  readonly lookMs: number;
  /** How often the person is told where it is, in milliseconds. */
  readonly heartbeatMs: number;
  /** How long each phase may stay silent, in milliseconds. */
  readonly silenceLimits: Readonly<Record<WatchPhase, number>>;
};

/** How the kit watches the benchmark. */
const KIT_WATCHING: Watching = {
  entry: BENCH,
  lookMs: LOOK_INTERVAL,
  heartbeatMs: HEARTBEAT_INTERVAL,
  silenceLimits: SILENCE_LIMITS
};

/** The benchmarks running now, stopped with their trees when the kit itself is interrupted. */
const running = new Set<ChildProcess>();

/** Stops every benchmark the kit runs: a run in a group of its own does not hear the console's Ctrl+C. */
export const stopRunning = async (): Promise<void> => {
  await Promise.all(
    [...running].map(async (child) => {
      if (child.pid !== undefined) await killTree(child.pid);
    })
  );
};

/**
 * Stops what an earlier benchmark left running from the kit's folders, and says so: a server that outlived a crash
 * would hold its port and its CPU through every later measurement.
 *
 * @param paths - the kit's folders.
 * @param io - the script's streams.
 * @param log - where to say it.
 */
export const clearLeftovers = async (paths: KitPaths, io: ScriptIo, log: Logger): Promise<void> => {
  const folders = [paths.work, paths.calibration, join(paths.home, "browsers")];
  let stopped: readonly { readonly command: string }[];
  try {
    // whatever its age: a benchmark that crashed in an earlier launch left it
    const left = folderLeftovers(await processTable(io), folders, process.pid);
    await stopProcesses(left);
    stopped = left;
  } catch (error) {
    log.warn(`Non riesco a controllare i processi rimasti accesi: ${String(error)}. Vado avanti.`);
    return;
  }
  if (stopped.length === 0) return;
  const names = [...new Set(stopped.map(({ command }) => programName(command)))].join(", ");
  log.warn(
    stopped.length === 1
      ? `Ho fermato un processo rimasto acceso dopo la prova (${names}).`
      : `Ho fermato ${stopped.length} processi rimasti accesi dopo la prova (${names}).`
  );
};

/**
 * What says a run's progress: a line when the metric changes or another tenth is done, with the time left once a few
 * steps give a pace.
 *
 * @param label - the part.
 * @param log - where to say it.
 * @param now - the clock, in milliseconds.
 */
export const progressReporter = (
  label: string,
  log: Logger,
  now: () => number = Date.now
): ((line: StatusLine | undefined) => void) => {
  let shown = "";
  let firstAt: number | undefined;
  return (line) => {
    if (line?.kind !== "step") return;
    const at = now();
    firstAt ??= at;
    const percent = line.total > 0 ? Math.floor((line.done / line.total) * 100) : 0;
    const key = `${line.tool} ${line.metric} ${Math.floor(percent / 10)}`;
    if (key === shown) return;
    shown = key;
    const left = ((at - firstAt) / Math.max(1, line.done)) * (line.total - line.done);
    const remaining = line.done < 3 ? "" : `, ne mancano circa ${formatDuration(left)}`;
    log.info(`${label}: ${line.tool} · ${line.metric} · ${percent}%${remaining}`);
  };
};

/** The sizes of a run's files, as one value: any growth of either changes it. */
const signatureOf = (files: readonly string[]): string =>
  files.map((file) => statSync(file, { throwIfNoEntry: false })?.size ?? -1).join(":");

/** Runs the benchmark once, showing its progress, timing its phases, and stopping it when it is stuck. */
export const runBenchmark = (request: BenchRequest, io: ScriptIo, log: Logger): Promise<BenchRun> =>
  new Promise((resolveRun) => {
    writeFileSync(request.status, "");
    const output = openSync(request.log, "w");
    const startedAt = Date.now();
    const watching = request.watching ?? KIT_WATCHING;
    const child = spawn(
      process.execPath,
      [
        watching.entry,
        ...request.args,
        "--work",
        request.work,
        "--status",
        request.status,
        "--port",
        PORT,
        "--json"
      ],
      // a group of its own where there are groups, so stopping it stops its servers and browsers too
      {
        cwd: REPOSITORY,
        env: io.env,
        stdio: ["ignore", output, output],
        windowsHide: true,
        detached: isOwnGroup
      }
    );
    closeSync(output);
    running.add(child);
    const report = progressReporter(request.label, log);
    let watch: Watch = startWatch(startedAt);
    let lastBeat = startedAt;
    let stopped: Exclude<Verdict, { readonly kind: "running" }> | undefined;
    let isEnded = false;
    const look = (): void => {
      const signature = signatureOf([request.log, request.status]);
      // the status file is read only when it changed, which is only ever between two measurements
      const status = signature === watch.signature ? watch.status : lastStatus(readText(request.status));
      if (status !== watch.status) report(status);
      watch = observe(watch, Date.now(), signature, status);
    };
    const end = (exitCode: number | null): void => {
      if (isEnded) return;
      isEnded = true;
      clearInterval(ticker);
      running.delete(child);
      resolveRun({
        exitCode: stopped === undefined ? exitCode : null,
        timing: phaseTiming(startedAt, Date.now(), readText(request.status)),
        ...(stopped === undefined ? {} : { stopped: stoppedLine(request.label, stopped, watch.status) })
      });
    };
    const ticker = setInterval(() => {
      look();
      const now = Date.now();
      const judged = verdict(watch, now, request.limitMs, watching.silenceLimits);
      if (judged.kind !== "running" && stopped === undefined) {
        stopped = judged;
        log.warn(stoppedLine(request.label, judged, watch.status));
        log.warn(`Il suo registro è in ${request.log}. Vado avanti con il resto.`);
        void stopChild(child).then(() => end(null));
        return;
      }
      if (now - lastBeat >= watching.heartbeatMs) {
        lastBeat = now;
        log.info(heartbeatLine(request.label, watch, now));
      }
    }, watching.lookMs);
    child.on("error", (error) => {
      log.warn(`${request.label}: il benchmark non è partito (${error.message}).`);
      end(null);
    });
    child.on("exit", (code) => end(code));
  });

/** A file's text, or nothing when it cannot be read. */
const readText = (file: string): string => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

/** Stops a run and its tree, and waits for it for a while. */
const stopChild = async (child: ChildProcess): Promise<void> => {
  if (child.pid !== undefined) await killTree(child.pid);
  await waitForExit(child, STOP_TIMEOUT);
};

/** The calibration, run once per machine and commit. */
export const calibrate = async (paths: KitPaths, io: ScriptIo, log: Logger): Promise<CalibrationTiming> => {
  log.step("Calibrazione: una prova breve per stimare quanto dura il resto (qualche minuto).");
  const startedAt = Date.now();
  const run = await runBenchmark(
    {
      args: CALIBRATION_ARGS,
      work: paths.calibration,
      status: join(paths.status, "calibration.jsonl"),
      log: join(paths.logs, "calibration.log"),
      label: "Calibrazione",
      limitMs: CALIBRATION_LIMIT
    },
    io,
    log
  );
  await clearLeftovers(paths, io, log);
  const report = join(paths.calibration, "report.json");
  // a report means the benchmark ran: a metric that failed is a result to send back, not a reason to stop here
  if (!existsSync(report) || statSync(report).mtimeMs < startedAt) {
    throw new ScriptError(
      run.stopped ?? "La calibrazione non è riuscita: il benchmark non può girare su questo PC così com'è.",
      { hint: `Il registro è in ${join(paths.logs, "calibration.log")}. ${RESULTS_HINT}` }
    );
  }
  const text = readFileSync(report, "utf8");
  const failed = failedMetrics(text);
  if (failed.length > 0) {
    log.warn(
      `Nella calibrazione alcune misure di Forgebook non sono riuscite (${failed.join(", ")}): la stima sarà ` +
        "poco affidabile, e il file dei risultati dirà perché."
    );
  }
  log.success(
    `Calibrazione fatta: preparazione ${formatDuration(run.timing.prepareMs)}, misure ${formatDuration(run.timing.measureMs)}.`
  );
  const buildMs = buildMedian(text);
  return buildMs === undefined ? run.timing : { ...run.timing, buildMs };
};

/**
 * Forgebook's build time in a report, the median of its runs.
 *
 * @param text - the report's text.
 * @returns the time in milliseconds, or nothing when it did not build.
 */
export const buildMedian = (text: string): number | undefined => {
  const build = parseReport(text).tools.forgebook?.metrics["build"];
  return build?.kind === "measured" ? build.summary.median : undefined;
};

/**
 * The metrics of a report that failed, for any tool.
 *
 * @param text - the report's text.
 */
export const failedMetrics = (text: string): string[] =>
  Object.values(parseReport(text).tools).flatMap((tool) =>
    Object.entries(tool?.metrics ?? {})
      .filter(([, result]) => result.kind === "failed")
      .map(([name]) => name)
  );

/** How a part ended, from its exit code and whether it left a report. */
export const outcomeOf = (exitCode: number | null, hasReport: boolean): ItemOutcome => {
  if (!hasReport) return "failed";
  return exitCode === 0 ? "done" : "problems";
};

/**
 * Runs a part and keeps its report.
 *
 * @param item - the part.
 * @param estimateMs - its estimate on this machine, if any: three times it, two hours at least, is its limit.
 * @param paths - the kit's folders.
 * @param io - the script's streams.
 * @param log - where to say it.
 */
export const runItem = async (
  item: KitItem,
  estimateMs: number | undefined,
  paths: KitPaths,
  io: ScriptIo,
  log: Logger
): Promise<ItemState> => {
  const report = join(paths.work, item.report);
  const startedAt = Date.now();
  const run = await runBenchmark(
    {
      args: item.args,
      work: paths.work,
      status: join(paths.status, `${item.id}.jsonl`),
      log: join(paths.logs, `${item.id}.log`),
      label: ITEM_NAMES[item.id],
      limitMs: partLimit(estimateMs)
    },
    io,
    log
  );
  await clearLeftovers(paths, io, log);
  const hasReport = existsSync(report) && statSync(report).mtimeMs >= startedAt;
  if (hasReport) copyFileSync(report, join(paths.reports, item.report));
  const outcome = outcomeOf(run.exitCode, hasReport);
  const said: Readonly<Record<ItemOutcome, string>> = {
    done: "completata",
    problems: "completata, con qualche misura fallita o fuori posto (è tutto nel report)",
    failed: "non riuscita: nessun report (il registro dice perché)"
  };
  if (outcome === "failed") log.warn(`${ITEM_NAMES[item.id]}: ${said[outcome]}.`);
  else log.success(`${ITEM_NAMES[item.id]}: ${said[outcome]}.`);
  return {
    outcome,
    exitCode: run.exitCode,
    timing: run.timing,
    ...(run.stopped === undefined ? {} : { stopped: run.stopped })
  };
};
