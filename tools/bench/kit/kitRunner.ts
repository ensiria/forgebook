/**
 * The benchmark, run by the kit as a child process: one part or the calibration, its progress shown, its phases timed.
 *
 * @remarks
 * The progress is read from the benchmark's status file when the file changes, which happens only between
 * measurements: a reader waking on a timer could land in one.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, openSync, readFileSync, statSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { parseReport } from "../reportTable.ts";
import { CALIBRATION_ARGS, formatDuration, type KitItem, type PhaseTiming, phaseTiming } from "./kitPlan.ts";
import { BENCH, ITEM_NAMES, type KitPaths, PORT, REPOSITORY } from "./kitSession.ts";
import type { ItemOutcome, ItemState } from "./kitState.ts";
import { stopLeftovers } from "./leftovers.ts";

/** One step of the benchmark's status file, as far as the progress reads it. */
export type StatusStep = {
  /** The tool measured. */
  readonly tool: string | undefined;
  /** The metric. */
  readonly metric: string | undefined;
  /** The steps done. */
  readonly done: number | undefined;
  /** The steps in all. */
  readonly total: number | undefined;
  /** When it was written, in milliseconds. */
  readonly at: number | undefined;
};

/** The last step of a status file. */
export const lastStep = (file: string): StatusStep | undefined => {
  const line = readFileSync(file, "utf8").trimEnd().split("\n").at(-1);
  if (line === undefined || line === "") return undefined;
  const value: unknown = JSON.parse(line);
  if (typeof value !== "object" || value === null) return undefined;
  const number = (key: string): number | undefined => {
    const field: unknown = Reflect.get(value, key);
    return typeof field === "number" ? field : undefined;
  };
  const text = (key: string): string | undefined => {
    const field: unknown = Reflect.get(value, key);
    return typeof field === "string" ? field : undefined;
  };
  return {
    tool: text("tool"),
    metric: text("metric"),
    done: number("done"),
    total: number("total"),
    at: number("at")
  };
};

/** How a benchmark run ended. */
export type BenchRun = {
  /** Its exit code. */
  readonly exitCode: number | null;
  /** Its phases. */
  readonly timing: PhaseTiming;
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
  const stopped = await stopLeftovers([paths.work, paths.calibration, join(paths.home, "browsers")], io);
  if (stopped > 0) log.warn(`Ho fermato ${stopped} processi rimasti da una prova interrotta.`);
};

/**
 * What says a run's progress: a line when the metric changes or another tenth is done, with the time left once a few
 * steps give a pace.
 */
export const progressReporter = (label: string, log: Logger): ((step: StatusStep | undefined) => void) => {
  let shown = "";
  let firstAt: number | undefined;
  return (step) => {
    if (step?.tool === undefined || step.done === undefined || step.total === undefined) return;
    firstAt ??= step.at;
    const percent = step.total > 0 ? Math.floor((step.done / step.total) * 100) : 0;
    const key = `${step.tool} ${step.metric} ${Math.floor(percent / 10)}`;
    if (key === shown) return;
    shown = key;
    const elapsed = firstAt === undefined || step.at === undefined ? 0 : step.at - firstAt;
    const left = (elapsed / Math.max(1, step.done)) * (step.total - step.done);
    const remaining = step.done < 3 ? "" : `, ne mancano circa ${formatDuration(left)}`;
    log.info(`${label}: ${step.tool} · ${step.metric} · ${percent}%${remaining}`);
  };
};

/** Runs the benchmark once, showing its progress, and times its phases. */
export const runBenchmark = (request: BenchRequest, io: ScriptIo, log: Logger): Promise<BenchRun> =>
  new Promise((resolveRun) => {
    writeFileSync(request.status, "");
    const output = openSync(request.log, "w");
    const startedAt = Date.now();
    const child = spawn(
      process.execPath,
      [BENCH, ...request.args, "--work", request.work, "--status", request.status, "--port", PORT, "--json"],
      { cwd: REPOSITORY, env: io.env, stdio: ["ignore", output, output], windowsHide: true }
    );
    const report = progressReporter(request.label, log);
    // read only when the file changes: the benchmark writes it between measurements, never during one
    const watcher = watch(request.status, () => report(lastStep(request.status)));
    child.on("close", (code) => {
      watcher.close();
      const endedAt = Date.now();
      resolveRun({
        exitCode: code,
        timing: phaseTiming(startedAt, endedAt, readFileSync(request.status, "utf8"))
      });
    });
  });

/** The calibration, run once per machine and commit. */
export const calibrate = async (paths: KitPaths, io: ScriptIo, log: Logger): Promise<PhaseTiming> => {
  log.step("Calibrazione: una prova breve per stimare quanto dura il resto (qualche minuto).");
  const startedAt = Date.now();
  const run = await runBenchmark(
    {
      args: CALIBRATION_ARGS,
      work: paths.calibration,
      status: join(paths.status, "calibration.jsonl"),
      log: join(paths.logs, "calibration.log"),
      label: "Calibrazione"
    },
    io,
    log
  );
  await clearLeftovers(paths, io, log);
  const report = join(paths.calibration, "report.json");
  // a report means the benchmark ran: a metric that failed is a result to send back, not a reason to stop here
  if (!existsSync(report) || statSync(report).mtimeMs < startedAt) {
    throw new ScriptError(
      "La calibrazione non è riuscita: il benchmark non può girare su questo PC così com'è.",
      {
        hint: `Il registro è in ${join(paths.logs, "calibration.log")}`
      }
    );
  }
  const failed = failedMetrics(readFileSync(report, "utf8"));
  if (failed.length > 0) {
    log.warn(
      `Nella calibrazione alcune misure di Forgebook non sono riuscite (${failed.join(", ")}): la stima sarà ` +
        "poco affidabile, e il file dei risultati dirà perché."
    );
  }
  log.success(
    `Calibrazione fatta: preparazione ${formatDuration(run.timing.prepareMs)}, misure ${formatDuration(run.timing.measureMs)}.`
  );
  return run.timing;
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

/** Runs a part and keeps its report. */
export const runItem = async (
  item: KitItem,
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
      label: ITEM_NAMES[item.id]
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
    failed: "non riuscita: nessun report"
  };
  if (outcome === "failed") log.warn(`${ITEM_NAMES[item.id]}: ${said[outcome]}.`);
  else log.success(`${ITEM_NAMES[item.id]}: ${said[outcome]}.`);
  return { outcome, exitCode: run.exitCode, timing: run.timing };
};
