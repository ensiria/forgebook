/**
 * How the kit watches a benchmark it runs: what its status file says it is doing, how long it may stay silent doing
 * that, and the line the person sees every minute.
 *
 * @remarks
 * A run of hours on a machine nobody watches must never look like a blinking cursor, and must never sit there. The
 * benchmark gives two signs of life: its log grows, and its status file gets a line before each sample and at the
 * start of each long step outside the measurements (`statusFile.ts`). The kit takes either as progress. Silence is
 * judged by what the last line says the run is doing, since an install of a large monorepo prints nothing for an hour
 * while a sample never takes more than a few minutes: past its phase's limit, or past the part's own limit, the run
 * is stuck and is stopped, and the kit goes on with the next part. The limits sit above the benchmark's own time
 * limits (`TIME_LIMITS` in `programs.ts`), so a step the benchmark can end itself is ended there first, with its
 * reason in the report. Everything here is pure.
 *
 * @module
 */
import type { ActivityName } from "../statusFile.ts";
import { formatDuration } from "./kitPlan.ts";

/** A minute, in milliseconds. */
const MINUTE = 60_000;

/** What a run is doing, as far as the silence it is allowed goes. */
export type WatchPhase =
  /** Started, nothing in its status file yet. */
  | "starting"
  /** Packing, installing, cloning or preparing a library: long steps that print nothing. */
  | "preparing"
  /** Opening every story of a library, a line every 25 stories. */
  | "sweeping"
  /** Taking samples, a line before each. */
  | "measuring";

/**
 * How long each phase may go without a sign of life, in milliseconds.
 *
 * @remarks
 * Starting: the benchmark reads its arguments and writes its first line within seconds. Preparing: a line comes before
 * each install, each command of a library's preparation, the fetch and the checkout, and each may take up to 90
 * minutes before the benchmark stops it itself. Sweeping: a story gives up after 45 seconds and 25 of them, four at a
 * time, are a line. Measuring: a sample gives up within a few minutes (a server's start and a page's draw 3 each, a
 * build 9), a group of edits writes a line every 5 edits, and a machine's reading gives up after a minute.
 */
export const SILENCE_LIMITS: Readonly<Record<WatchPhase, number>> = {
  starting: 15 * MINUTE,
  preparing: 100 * MINUTE,
  sweeping: 30 * MINUTE,
  measuring: 30 * MINUTE
};

/** How often the kit says where a run is, in milliseconds. */
export const HEARTBEAT_INTERVAL = MINUTE;

/** The shortest limit of a whole part, in milliseconds: a slow machine is not a stuck one. */
const MIN_PART_LIMIT = 120 * MINUTE;

/** How many times its estimate a part may last before it is stopped. */
const PART_LIMIT_FACTOR = 3;

/**
 * How long a part may last in all.
 *
 * @param estimateMs - its estimate on this machine, if there is one.
 * @returns the limit in milliseconds, or none without an estimate: then silence alone stops it.
 */
export const partLimit = (estimateMs: number | undefined): number | undefined =>
  estimateMs === undefined ? undefined : Math.max(MIN_PART_LIMIT, estimateMs * PART_LIMIT_FACTOR);

/** A line of the benchmark's status file, as the kit reads it. */
export type StatusLine =
  | {
      /** A sample is about to be taken. */
      readonly kind: "step";
      /** The tool. */
      readonly tool: string;
      /** The metric. */
      readonly metric: string;
      /** The steps of the run done. */
      readonly done: number;
      /** The steps of the run in all. */
      readonly total: number;
    }
  | {
      /** A long step outside the measurements started, or the sweep moved on. */
      readonly kind: "activity";
      /** Which: `pack`, `install`, `clone`, `prepare` or `sweep`. */
      readonly activity: string;
      /** The tool it is for, if one. */
      readonly tool: string | undefined;
      /** The items done, if counted. */
      readonly done: number | undefined;
      /** The items in all, if counted. */
      readonly total: number | undefined;
    }
  | {
      /** The run is over. */
      readonly kind: "end";
    };

/** A field of an object, if it is a string. */
const textOf = (value: object, key: string): string | undefined => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
};

/** A field of an object, if it is a number. */
const numberOf = (value: object, key: string): number | undefined => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === "number" ? field : undefined;
};

/**
 * A status line, read.
 *
 * @param line - one line of the file.
 * @returns what it says, or nothing for a line that is not one of the benchmark's, a half-written one included.
 */
export const parseStatusLine = (line: string): StatusLine | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const state = textOf(value, "state");
  if (state === "finished") return { kind: "end" };
  const activity = textOf(value, "activity");
  if (state === "working" && activity !== undefined) {
    return {
      kind: "activity",
      activity,
      tool: textOf(value, "tool"),
      done: numberOf(value, "count"),
      total: numberOf(value, "of")
    };
  }
  const [tool, metric] = [textOf(value, "tool"), textOf(value, "metric")];
  const [done, total] = [numberOf(value, "done"), numberOf(value, "total")];
  if (tool === undefined || metric === undefined || done === undefined || total === undefined)
    return undefined;
  return { kind: "step", tool, metric, done, total };
};

/**
 * The last line of a status file that the kit can read.
 *
 * @param text - the file's text.
 */
export const lastStatus = (text: string): StatusLine | undefined =>
  text
    .split("\n")
    .map(parseStatusLine)
    .findLast((line) => line !== undefined);

/**
 * The phase a run is in, from its last status line.
 *
 * @param line - the last line, if any.
 */
export const phaseOf = (line: StatusLine | undefined): WatchPhase => {
  if (line === undefined) return "starting";
  if (line.kind === "step") return "measuring";
  if (line.kind === "end") return "measuring";
  if (line.activity === "edit") return "measuring";
  return line.activity === "sweep" ? "sweeping" : "preparing";
};

/** What the kit knows of a run it watches. */
export type Watch = {
  /** When the run started, in milliseconds. */
  readonly startedAt: number;
  /** When it last gave a sign of life, in milliseconds. */
  readonly lastSignAt: number;
  /** What its files looked like then: their sizes, so any growth is a sign of life. */
  readonly signature: string;
  /** Its last status line. */
  readonly status: StatusLine | undefined;
};

/**
 * A run just started.
 *
 * @param now - the time, in milliseconds.
 */
export const startWatch = (now: number): Watch => ({
  startedAt: now,
  lastSignAt: now,
  signature: "",
  status: undefined
});

/**
 * The watch after a look at the run's files.
 *
 * @param watch - the watch so far.
 * @param now - the time, in milliseconds.
 * @param signature - the files' sizes now.
 * @param status - the last status line now.
 */
export const observe = (
  watch: Watch,
  now: number,
  signature: string,
  status: StatusLine | undefined
): Watch =>
  signature === watch.signature ? { ...watch, status } : { ...watch, lastSignAt: now, signature, status };

/** What the kit makes of a run's silence. */
export type Verdict =
  /** It goes on. */
  | { readonly kind: "running" }
  /** Silent past its phase's limit: stuck. */
  | { readonly kind: "silent"; readonly phase: WatchPhase; readonly silentMs: number }
  /** Past the part's own limit. */
  | { readonly kind: "overtime"; readonly elapsedMs: number; readonly limitMs: number };

/**
 * Whether a run is stuck.
 *
 * @param watch - the watch.
 * @param now - the time, in milliseconds.
 * @param limitMs - the part's own limit, if any (`partLimit`).
 * @param silenceLimits - how long each phase may stay silent; `SILENCE_LIMITS` by default.
 */
export const verdict = (
  watch: Watch,
  now: number,
  limitMs: number | undefined,
  silenceLimits: Readonly<Record<WatchPhase, number>> = SILENCE_LIMITS
): Verdict => {
  const elapsedMs = now - watch.startedAt;
  if (limitMs !== undefined && elapsedMs > limitMs) return { kind: "overtime", elapsedMs, limitMs };
  const phase = phaseOf(watch.status);
  const silentMs = now - watch.lastSignAt;
  return silentMs > silenceLimits[phase] ? { kind: "silent", phase, silentMs } : { kind: "running" };
};

/** What a phase is, for a person. */
const PHASE_NAMES: Readonly<Record<WatchPhase, string>> = {
  starting: "all'avvio",
  preparing: "durante la preparazione",
  sweeping: "aprendo le storie",
  measuring: "durante le misure"
};

/** What a long step is, for a person. */
const ACTIVITY_NAMES: Readonly<Record<ActivityName, string>> = {
  pack: "preparo i pacchetti di Forgebook",
  install: "installo le dipendenze",
  clone: "scarico il codice della libreria",
  prepare: "preparo la libreria",
  sweep: "apro ogni storia",
  edit: "modifico i file e misuro l'aggiornamento"
};

/** Whether a status line's activity is one the benchmark writes, as against one of a newer benchmark. */
const isActivityName = (name: string): name is ActivityName => Object.hasOwn(ACTIVITY_NAMES, name);

/** A share, in whole percent. */
const percent = (done: number, total: number): number => (total > 0 ? Math.floor((done / total) * 100) : 0);

/**
 * What a status line says, for a person.
 *
 * @param line - the line, if any.
 */
export const describeStatus = (line: StatusLine | undefined): string => {
  if (line === undefined) return "avvio";
  if (line.kind === "end") return "chiudo";
  if (line.kind === "step") {
    const share = percent(line.done, line.total);
    return `misuro ${line.tool} · ${line.metric}, passo ${line.done + 1} di ${line.total} (${share}%)`;
  }
  const what = isActivityName(line.activity) ? ACTIVITY_NAMES[line.activity] : line.activity;
  const tool = line.tool === undefined ? "" : ` (${line.tool})`;
  const count = line.total === undefined ? "" : `: ${line.done ?? 0} di ${line.total}`;
  return `${what}${tool}${count}`;
};

/**
 * The line said every minute while a run goes on.
 *
 * @param label - the part.
 * @param watch - the watch.
 * @param now - the time, in milliseconds.
 */
export const heartbeatLine = (label: string, watch: Watch, now: number): string => {
  const silentMs = now - watch.lastSignAt;
  const quiet = silentMs < 2 * MINUTE ? "" : `, nessun segnale da ${formatDuration(silentMs)}`;
  return `Ancora in corso, ${label}: ${describeStatus(watch.status)}; da ${formatDuration(now - watch.startedAt)}${quiet}.`;
};

/**
 * Why a run was stopped, for a person.
 *
 * @param label - the part.
 * @param stopped - the verdict that stopped it.
 * @param status - its last status line.
 */
export const stoppedLine = (
  label: string,
  stopped: Exclude<Verdict, { readonly kind: "running" }>,
  status: StatusLine | undefined
): string =>
  stopped.kind === "silent"
    ? `${label}: fermata, nessun segnale da ${formatDuration(stopped.silentMs)} ${PHASE_NAMES[stopped.phase]} ` +
      `(ultimo passo: ${describeStatus(status)}).`
    : `${label}: fermata dopo ${formatDuration(stopped.elapsedMs)}, oltre il limite di ` +
      `${formatDuration(stopped.limitMs)} ricavato dalla stima (ultimo passo: ${describeStatus(status)}).`;
