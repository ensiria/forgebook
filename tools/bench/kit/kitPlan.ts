/**
 * What the bench kit runs: its two profiles, what each needs of the machine, and how long each should take here.
 *
 * @remarks
 * The estimate scales a reference machine's durations by a calibration both machines ran: a small benchmark of
 * Forgebook alone. A run has two phases with different bottlenecks, so each is scaled by its own ratio: preparing
 * (packing, installs, clones: the network and the disk) and measuring (servers, builds, the browser: the CPU). The
 * calibration cannot tell how a large monorepo's install compares with a small project's, so the estimate is a range.
 * Measuring is scaled by the calibration's build when both machines have one: a phase that holds a failed metric's
 * timeout (Forgebook's dev server on Windows) says nothing of the machine's speed, and a build does.
 * Everything here is pure.
 *
 * @module
 */

/** A part of a profile: the generated library, or a real one. */
export type KitItemId = "generated" | "primer" | "carbon" | "fluentui" | "spectrum";

/** A profile: the generated library with the three tools, or that and the real libraries. */
export type KitProfile = "quick" | "full";

/** A part of a profile, as the benchmark runs it. */
export type KitItem = {
  /** Its id. */
  readonly id: KitItemId;
  /** The benchmark's arguments, besides the work folder, the status file and `--json`. */
  readonly args: readonly string[];
  /** The report it writes in the work folder. */
  readonly report: string;
};

/** The benchmark's arguments for a real library: its own Storybook beside Forgebook, the fewer runs it can afford. */
const corpusItem = (id: Exclude<KitItemId, "generated">): KitItem => ({
  id,
  args: ["--corpus", id, "--compare", "--runs", "3", "--edits", "20"],
  report: `report-${id}.json`
});

/** The generated library of 500 stories with Forgebook, Storybook and Ladle, as the reference runs are made. */
const GENERATED: KitItem = {
  id: "generated",
  args: ["--compare", "--runs", "5", "--edits", "60"],
  report: "report.json"
};

/** Why Spectrum is left out on Windows, said to the person running the kit. */
export const SPECTRUM_ON_WINDOWS =
  "Spectrum non è incluso su Windows: la sua Storybook costruisce l'anteprima con Parcel su una porta fissa (3000) e " +
  "apre un socket Unix per la documentazione. Su Windows non è mai stato provato e i suoi numeri non sarebbero " +
  "affidabili.";

/**
 * The parts of a profile on a system.
 *
 * @param profile - the profile.
 * @param platform - `process.platform`: Spectrum's Storybook is not run on Windows.
 */
export const profileItems = (profile: KitProfile, platform: NodeJS.Platform): KitItem[] => {
  if (profile === "quick") return [GENERATED];
  const corpora: Exclude<KitItemId, "generated">[] = ["primer", "carbon", "fluentui"];
  return [GENERATED, ...corpora.map(corpusItem), ...(platform === "win32" ? [] : [corpusItem("spectrum")])];
};

/** The parameters of the calibration: Forgebook alone on a small library, one run of a start and a build. */
export const CALIBRATION_ARGS: readonly string[] = [
  "--components",
  "20",
  "--stories",
  "100",
  "--runs",
  "1",
  "--edits",
  "5",
  "--metric",
  "start",
  "--metric",
  "build"
];

/** A gigabyte, in bytes. */
const GB = 1024 ** 3;

/** What a profile needs of the machine. */
export type Requirements = {
  /** Free disk, in bytes, below which it does not start. */
  readonly disk: number;
  /** Memory, in bytes, below which it does not start. */
  readonly minimumMemory: number;
  /** Memory, in bytes, below which it warns: a real library's build may run out of it. */
  readonly memory: number;
};

/**
 * What a profile needs, beyond the kit's own tools: the generated library takes a few gigabytes, the real libraries'
 * clones and installs about ten more.
 *
 * @param profile - the profile.
 */
export const requirements = (profile: KitProfile): Requirements =>
  profile === "quick"
    ? { disk: 5 * GB, minimumMemory: 4 * GB, memory: 8 * GB }
    : { disk: 25 * GB, minimumMemory: 8 * GB, memory: 16 * GB };

/** How long a run's two phases took, in milliseconds. */
export type PhaseTiming = {
  /** Started → the first measurement: packing, installs, clones. */
  readonly prepareMs: number;
  /** The first measurement → the end. */
  readonly measureMs: number;
};

/**
 * The phases of a run, from its status file: measuring starts at the first sample.
 *
 * @param startedAt - when the benchmark was started, in milliseconds.
 * @param endedAt - when it ended, in milliseconds.
 * @param status - the status file: a JSON line per step, each with `at`; a line of a long step outside the
 * measurements (an install) has no metric, and belongs to the preparation.
 */
export const phaseTiming = (startedAt: number, endedAt: number, status: string): PhaseTiming => {
  const firstStep = status
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): unknown => JSON.parse(line))
    .find(
      (step): step is { readonly at: number } =>
        typeof step === "object" &&
        step !== null &&
        "metric" in step &&
        "at" in step &&
        typeof step.at === "number"
    );
  const measuring = firstStep?.at ?? endedAt;
  return { prepareMs: Math.max(0, measuring - startedAt), measureMs: Math.max(0, endedAt - measuring) };
};

/** A calibration's durations: its phases, and its build's time when it built. */
export type CalibrationTiming = PhaseTiming & {
  /** The build's time, in milliseconds. */
  readonly buildMs?: number;
};

/** A reference machine's durations, against which this one is scaled. */
export type Reference = {
  /** The machine, described for a person. */
  readonly machine: string;
  /** Its calibration. */
  readonly calibration: CalibrationTiming;
  /** Each part's phases there. */
  readonly items: Readonly<Partial<Record<KitItemId, PhaseTiming>>>;
};

/** The estimate of a profile. */
export type Estimate = {
  /** The likeliest total, in milliseconds. */
  readonly totalMs: number;
  /** The low end of the range. */
  readonly lowMs: number;
  /** The high end of the range. */
  readonly highMs: number;
  /** Each part's estimate, or nothing for a part the reference never ran. */
  readonly items: readonly { readonly id: KitItemId; readonly ms: number | undefined }[];
};

/** How far the estimate may be off, either way: what a calibration of a few minutes can promise. */
const SPREAD = 0.3;

/** A ratio of two durations; one when the reference has nothing to divide by. */
const ratio = (here: number, there: number): number => (there > 0 ? here / there : 1);

/**
 * How long parts should take on this machine.
 *
 * @param reference - the reference machine's durations.
 * @param calibration - this machine's calibration.
 * @param items - the parts.
 */
export const estimate = (
  reference: Reference,
  calibration: CalibrationTiming,
  items: readonly KitItem[]
): Estimate => {
  const prepare = ratio(calibration.prepareMs, reference.calibration.prepareMs);
  const builds = { here: calibration.buildMs, there: reference.calibration.buildMs };
  const measure =
    builds.here !== undefined && builds.there !== undefined
      ? ratio(builds.here, builds.there)
      : ratio(calibration.measureMs, reference.calibration.measureMs);
  const parts = items.map(({ id }) => {
    const timing = reference.items[id];
    return {
      id,
      ms: timing === undefined ? undefined : timing.prepareMs * prepare + timing.measureMs * measure
    };
  });
  const totalMs = parts.reduce((sum, { ms }) => sum + (ms ?? 0), 0);
  return { totalMs, lowMs: totalMs * (1 - SPREAD), highMs: totalMs * (1 + SPREAD), items: parts };
};

/**
 * A duration as a person reads it, in Italian: minutes under an hour, hours and minutes above.
 *
 * @param ms - the duration, in milliseconds.
 */
export const formatDuration = (ms: number): string => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return minutes === 1 ? "1 minuto" : `${minutes} minuti`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = hours === 1 ? "1 ora" : `${hours} ore`;
  if (rest === 0) return hourText;
  return `${hourText} e ${rest === 1 ? "1 minuto" : `${rest} minuti`}`;
};
