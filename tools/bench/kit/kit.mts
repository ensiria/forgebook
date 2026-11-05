#!/usr/bin/env node
/**
 * The bench kit's run, started by `start-bench.cmd` or `start-bench.sh` once Node, Git and this checkout are in place:
 * it calibrates, estimates, asks the profile, runs the benchmark and writes one results file to the Desktop.
 *
 * @remarks
 * The person running it is not a developer, so its text is Italian and every question has a safe default; every
 * question comes before the run starts, and none after, so a run left alone ends with its results file written. What
 * it did is saved after each step (`state.json` in the kit's folder): a run that stopped resumes, and the last answer
 * can be to remove everything. The benchmark runs as a child process, one part at a time, watched: a line every
 * minute, and a part stuck past its limits is stopped and the run goes on (`kitRunner.ts`). What it says is also in
 * `logs/kit.log`. See `README.md`.
 *
 * @module
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join, resolve } from "node:path";

import { select } from "@ensiria/cli-kit/prompts";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";

import { journaled } from "./kitJournal.ts";
import { writeReference, writeResults } from "./kitOutput.ts";
import {
  type Estimate,
  estimate,
  formatDuration,
  type KitItem,
  type KitProfile,
  profileItems,
  SPECTRUM_ON_WINDOWS
} from "./kitPlan.ts";
import { calibrate, clearLeftovers, runItem, stopRunning } from "./kitRunner.ts";
import {
  type Asker,
  askYesNo,
  CLEAN_MARKER,
  checkMachine,
  checkoutCommit,
  ITEM_NAMES,
  kitPaths,
  loadReference,
  loadState,
  type Session,
  saveState
} from "./kitSession.ts";
import type { KitState } from "./kitState.ts";

/** The estimate of a profile, as a line. */
const estimateLine = (profileEstimate: Estimate | undefined): string => {
  if (profileEstimate === undefined) return "durata non stimabile";
  const { totalMs, lowMs, highMs, items } = profileEstimate;
  const missing = items.filter(({ ms }) => ms === undefined).map(({ id }) => id);
  const range = `circa ${formatDuration(totalMs)} (tra ${formatDuration(lowMs)} e ${formatDuration(highMs)})`;
  return missing.length === 0 ? range : `${range}, escluse le parti senza stima (${missing.join(", ")})`;
};

/** A profile's name, for a person. */
const PROFILE_NAMES: Readonly<Record<KitProfile, string>> = { quick: "rapida", full: "completa" };

/** What to do with what an earlier launch left. */
type EarlierChoice = "resume" | "restart" | "results" | "clean" | "quit";

/** Asks what to do with an earlier run, when there is one. */
const earlierRun = async (state: KitState, asker: Asker): Promise<EarlierChoice | undefined> => {
  if (state.profile === undefined) return undefined;
  const items = profileItems(state.profile, platform());
  const ended = items.filter(({ id }) => state.items[id] !== undefined).length;
  const isComplete = ended === items.length;
  const description = isComplete
    ? `La prova ${PROFILE_NAMES[state.profile]} è finita${state.archive === undefined ? "" : ` e i risultati sono in ${basename(state.archive)}`}.`
    : `Una prova ${PROFILE_NAMES[state.profile]} si è fermata: ${ended} parti su ${items.length} completate.`;
  asker.log.info(description);
  return select<EarlierChoice>(
    {
      message: "Cosa faccio?",
      choices: [
        ...(isComplete ? [] : [{ value: "resume" as const, label: "Riprendi da dove si era fermata" }]),
        { value: "restart", label: "Ricomincia una corsa nuova" },
        // the logs alone say why a run went wrong, so the file is worth writing before any part ended
        { value: "results", label: "Crea il file dei risultati con quello che c'è" },
        { value: "clean", label: "Cancella tutto quello che il kit ha installato ed esci" },
        { value: "quit", label: "Esci" }
      ],
      default: isComplete ? "quit" : "resume"
    },
    asker
  );
};

/** Asks the profile, showing each one's estimate. */
const chooseProfile = async (
  given: string | undefined,
  estimates: Readonly<Record<KitProfile, Estimate | undefined>>,
  asker: Asker
): Promise<KitProfile> => {
  if (given === "quick" || given === "full") return given;
  if (given !== undefined)
    throw new ScriptError(`profilo sconosciuto: ${given}`, { hint: "quick oppure full" });
  return select<KitProfile>(
    {
      message: "Quale prova faccio?",
      choices: [
        { value: "quick", label: `Rapida: la libreria generata. ${estimateLine(estimates.quick)}` },
        { value: "full", label: `Completa: anche tre design system reali. ${estimateLine(estimates.full)}` }
      ],
      default: "quick"
    },
    asker
  );
};

/**
 * Does what was chosen about an earlier run.
 *
 * @returns `stop` when the launch ends here, `resume` to run the parts left, `new` to start a run.
 */
const answerEarlierRun = async (
  session: Session,
  choice: EarlierChoice | undefined
): Promise<"stop" | "resume" | "new"> => {
  const { paths, asker } = session;
  if (choice === undefined) return "new";
  if (choice === "resume") return "resume";
  if (choice === "clean") {
    const message = `Cancello ${paths.home}? I file dei risultati già creati restano dove sono.`;
    if (await askYesNo(message, false, asker)) writeFileSync(join(paths.home, CLEAN_MARKER), "");
    return "stop";
  }
  if (choice === "results") {
    session.update({ archive: await writeResults(session.state(), paths, session.desktop, asker) });
    return "stop";
  }
  if (choice === "quit") return "stop";
  rmSync(paths.reports, { recursive: true, force: true });
  mkdirSync(paths.reports, { recursive: true });
  const { commit, machine, calibration } = session.state();
  session.replace({ commit, machine, items: {}, ...(calibration === undefined ? {} : { calibration }) });
  return "new";
};

/**
 * Does work that runs the benchmark, and when it fails writes the results file of what there is before the failure
 * is reported: the person then has something to send back without a second launch.
 *
 * @param session - the launch.
 * @param work - the work.
 */
const orResults = async <TResult,>(session: Session, work: () => Promise<TResult>): Promise<TResult> => {
  try {
    return await work();
  } catch (error) {
    session.asker.log.warn("Qualcosa non è andato: creo il file dei risultati con quello che c'è.");
    try {
      session.update({
        archive: await writeResults(session.state(), session.paths, session.desktop, session.asker)
      });
    } catch (writing) {
      session.asker.log.warn(`Non riesco a creare il file dei risultati: ${String(writing)}`);
    }
    throw error;
  }
};

/**
 * Starts a run: checks the machine, calibrates once, shows the estimates, asks the profile and the go.
 *
 * @returns whether the run starts.
 */
const startRun = async (session: Session, given: string | undefined): Promise<boolean> => {
  const { paths, asker } = session;
  const { io, log } = asker;
  await checkMachine("quick", paths, asker);
  const calibration =
    session.state().calibration ?? (await orResults(session, () => calibrate(paths, io, log)));
  session.update({ calibration });
  const reference = loadReference();
  const estimateOf = (profile: KitProfile): Estimate | undefined =>
    reference === undefined ? undefined : estimate(reference, calibration, profileItems(profile, platform()));
  const estimates = { quick: estimateOf("quick"), full: estimateOf("full") };
  if (reference !== undefined) log.info(`Stime ricavate dalle durate su ${reference.machine}.`);
  if (platform() === "win32") log.info(SPECTRUM_ON_WINDOWS);
  const profile = await chooseProfile(given, estimates, asker);
  await checkMachine(profile, paths, asker);
  log.step(`Prova ${PROFILE_NAMES[profile]}: ${estimateLine(estimates[profile])}.`);
  for (const item of profileItems(profile, platform())) log.plain(`  · ${ITEM_NAMES[item.id]}`);
  log.plain(
    "  Durante la prova lascia il PC acceso e collegato alla corrente, e non usarlo: altri programmi aperti " +
      "falsano i tempi. Lo schermo può spegnersi."
  );
  if (!(await askYesNo("Inizio?", true, asker))) return false;
  const estimated = estimates[profile];
  session.update({
    profile,
    startedAt: new Date().toISOString(),
    items: {},
    ...(estimated === undefined ? {} : { estimateMs: estimated.totalMs })
  });
  return true;
};

/** Each part's estimate on this machine, by id, when the reference and the calibration give one. */
const partEstimates = (session: Session, items: readonly KitItem[]): ReadonlyMap<string, number> => {
  const reference = loadReference();
  const { calibration } = session.state();
  if (reference === undefined || calibration === undefined) return new Map();
  return new Map(
    estimate(reference, calibration, items).items.flatMap(({ id, ms }) =>
      ms === undefined ? [] : [[id, ms]]
    )
  );
};

/** Runs the parts of the run not yet ended, saving each outcome as it comes. */
const runParts = async (session: Session): Promise<void> => {
  const { profile } = session.state();
  if (profile === undefined) return;
  const items = profileItems(profile, platform());
  const estimates = partEstimates(session, items);
  for (const item of items) {
    if (session.state().items[item.id] !== undefined) continue;
    session.asker.log.step(`Inizio: ${ITEM_NAMES[item.id]}`);
    const { io, log } = session.asker;
    const result = await runItem(item, estimates.get(item.id), session.paths, io, log);
    session.update({ items: { ...session.state().items, [item.id]: result } });
  }
};

await defineScript({
  name: "bench-kit",
  command: "node tools/bench/kit/kit.mts",
  summary:
    "Run the benchmark on this machine for someone else: calibrate, estimate, measure, write one results file.",
  icon: "check",
  prompts: true,
  options: {
    home: {
      type: "string",
      required: true,
      valueName: "folder",
      description: "The kit's own folder: its tools, this checkout, the work and the state."
    },
    desktop: {
      type: "string",
      valueName: "folder",
      description: "Where the results file goes; the user's Desktop by default."
    },
    profile: {
      type: "string",
      valueName: "quick|full",
      description: "The profile, instead of asking: quick is the generated library, full adds the real ones."
    },
    results: {
      type: "boolean",
      description:
        "Only write the results file, with whatever there is, and end: what to send after a failure."
    },
    "write-reference": {
      type: "string",
      valueName: "file",
      description: "Also write this machine's durations as the reference other machines' estimates scale."
    }
  },
  examples: [
    { command: "bench-kit --home ~/.local/share/forgebook-bench", description: "As the launchers run it." },
    {
      command: "bench-kit --home /tmp/kit --profile quick --yes",
      description: "Without questions: the quick profile, every default taken."
    },
    { command: "bench-kit --home /tmp/kit --results", description: "The results file of what there is." }
  ],
  run: async ({ options, io, log: console, isYes, onExit }) => {
    const paths = kitPaths(resolve(options.home));
    for (const folder of [paths.work, paths.calibration, paths.status, paths.logs, paths.reports]) {
      mkdirSync(folder, { recursive: true });
    }
    const log = journaled(console, join(paths.logs, "kit.log"));
    onExit(stopRunning);
    await clearLeftovers(paths, io, log);
    let state = loadState(paths, await checkoutCommit(io), log);
    const session: Session = {
      paths,
      asker: { io, log, isYes },
      desktop: options.desktop ?? join(homedir(), "Desktop"),
      state: () => state,
      update: (change) => {
        state = { ...state, ...change };
        saveState(paths, state);
      },
      replace: (next) => {
        state = next;
        saveState(paths, state);
      }
    };
    if (options.results) {
      session.update({ archive: await writeResults(state, paths, session.desktop, session.asker) });
      return;
    }
    const next = await answerEarlierRun(session, await earlierRun(state, session.asker));
    if (next === "stop") return;
    if (next === "new" && !(await startRun(session, options.profile))) return;
    await orResults(session, () => runParts(session));
    const reference = options["write-reference"];
    if (reference !== undefined) await writeReference(state, reference, io);
    session.update({ archive: await writeResults(state, paths, session.desktop, session.asker) });
    log.info("Finito. Rilanciando il kit puoi cancellare tutto quello che ha installato.");
  }
}).run();
