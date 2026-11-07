/**
 * An evaluation's runs, from the definitions to each run's measures: the Forgebook under test packed or named, each
 * app's bases made once, then every planned run in its turn.
 *
 * @remarks
 * A run that fails leaves its reason in its folder and the evaluation goes on: a failure is a result to report, never
 * a reason to lose the other runs. A run whose measures are already written is kept, so an evaluation stopped halfway
 * starts again where it was; `--fresh` runs everything again.
 *
 * @module
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { chromium } from "@playwright/test";

import { stopLeftovers } from "../bench/leftovers.ts";
import { packForgebook } from "../bench/prepare.ts";
import { baselineChecks } from "./appChecks.ts";
import { parseApp, parseProfile, parseTask } from "./definitions.ts";
import type { AgentProfile, EvalApp, EvalTask, RunMeasures } from "./eval.types.ts";
import { packagesFor, setUpForgebook } from "./forgebookSetup.ts";
import { seeded } from "./random.ts";
import { runFolder, runOne } from "./runOne.ts";
import { type PlannedRun, planRuns } from "./runPlan.ts";
import { parseMeasures } from "./storedDocuments.ts";
import { appBase, basePath, copyFolder, derivedBase } from "./workspace.ts";

/** The evaluation's own folder: its apps, tasks and agents' profiles. */
export const EVAL_FOLDER = import.meta.dirname;

/** The profile of the dry-run stand-in, the only one allowed to read its arm. */
export const STAND_IN = "dry-run";

/** Every definition, read and checked. */
export type Definitions = {
  /** The apps, by name. */
  readonly apps: ReadonlyMap<string, EvalApp>;
  /** The tasks, in their folders' order. */
  readonly tasks: readonly EvalTask[];
};

/**
 * Reads every app and task under the evaluation's folder.
 *
 * @param folder - the evaluation's folder.
 * @throws when one does not read, naming every problem.
 */
export const readDefinitions = (folder: string = EVAL_FOLDER): Definitions => {
  const appFiles = readdirSync(join(folder, "apps")).filter((file) => file.endsWith(".json"));
  const apps = new Map(
    appFiles.map((file) => {
      const name = file.replace(/\.json$/, "");
      return [name, parseApp(readFileSync(join(folder, "apps", file), "utf8"), name)] as const;
    })
  );
  const taskIds = readdirSync(join(folder, "tasks"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const problems: string[] = [];
  const tasks = taskIds.flatMap((id) => {
    try {
      const file = join(folder, "tasks", id, "task.json");
      const task = parseTask(readFileSync(file, "utf8"), id, [...apps.keys()]);
      for (const probe of task.probes) {
        if (!existsSync(join(folder, "tasks", id, probe.source)))
          problems.push(`${id}: the probe ${probe.source} is missing`);
      }
      return [task];
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  });
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return { apps, tasks };
};

/**
 * Reads an agent's profile: a name under `agents/`, or a file.
 *
 * @param argument - what `--agent` names.
 */
export const readProfile = (argument: string): AgentProfile => {
  const file = resolve(existsSync(argument) ? argument : join(EVAL_FOLDER, "agents", `${argument}.json`));
  // the stand-in by its file, never by a name another file could take
  return parseProfile(readFileSync(file, "utf8"), file === join(EVAL_FOLDER, "agents", `${STAND_IN}.json`));
};

/** What `runEvaluation` needs. */
export type EvaluationRequest = {
  /** The tasks to run. */
  readonly tasks: readonly EvalTask[];
  /** The apps, by name. */
  readonly apps: ReadonlyMap<string, EvalApp>;
  /** The agent. */
  readonly profile: AgentProfile;
  /** How many times each task runs in each arm. */
  readonly repeats: number;
  /** The seed of the runs' order. */
  readonly seed: number;
  /** The work folder, outside the repository. */
  readonly work: string;
  /** The repository, whose Forgebook is packed when no version is named. */
  readonly repository: string;
  /** A published release to evaluate instead of this checkout. */
  readonly version?: string;
  /** The first of the three ports a measurement takes. */
  readonly port: number;
  /** Whether to run again the runs already measured. */
  readonly isFresh: boolean;
  /** Whether to keep each run's copies of the app. */
  readonly isKept: boolean;
  /** Told as each step starts. */
  readonly onStep: (message: string) => void;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** One run's end: its measures, or why it has none. */
export type RunEnd =
  | { readonly id: string; readonly kind: "measured"; readonly measures: RunMeasures }
  | { readonly id: string; readonly kind: "failed"; readonly reason: string };

/** The Forgebook under test: each package's specifier by name, and a label naming exactly that build. */
type ForgebookUnderTest = {
  /** Each package's specifier, by name: `file:` tarballs or the release's version. */
  readonly packages: Readonly<Record<string, string>>;
  /** The release's version, or `sha256:` of the tarballs' bytes, so two runs of different builds never mix. */
  readonly label: string;
};

/** The package name of a folder under `packages/`. */
const packageName = (folder: string): string => (folder === "forgebook" ? folder : `@forgebook/${folder}`);

/** Forgebook's packages for every framework of the apps, packed once from this checkout or named by release. */
const forgebookUnderTest = async (request: EvaluationRequest): Promise<ForgebookUnderTest> => {
  const frameworks = new Set(request.tasks.map((task) => request.apps.get(task.app)?.framework ?? "react"));
  const folders = [...new Set([...frameworks].flatMap(packagesFor))];
  if (request.version !== undefined) {
    const version = request.version;
    return {
      packages: Object.fromEntries(folders.map((folder) => [packageName(folder), version])),
      label: version
    };
  }
  const packages = await packForgebook(
    { repository: request.repository, work: request.work },
    request.io,
    folders
  );
  const hash = createHash("sha256");
  for (const [name, specifier] of Object.entries(packages).sort())
    hash.update(name).update(readFileSync(specifier.replace(/^file:/, "")));
  return { packages, label: `sha256:${hash.digest("hex").slice(0, 16)}` };
};

/**
 * A task's definition with its app's, fingerprinted: a run measured under another definition is not resumed.
 *
 * @param task - the task.
 * @param app - its app.
 */
export const definitionHash = (task: EvalTask, app: EvalApp): string =>
  createHash("sha256").update(JSON.stringify({ task, app })).digest("hex").slice(0, 16);

/** The bases an app's runs start from, and how its checks went as cloned. */
const appBases = async (
  request: EvaluationRequest,
  app: EvalApp,
  forgebook: ForgebookUnderTest,
  env: Readonly<Record<string, string>>
) => {
  const { io, work } = request;
  request.onStep(`${app.name}: the clone at ${app.commit.slice(0, 12)}, installed`);
  const without = await appBase(app, work, env, io);
  const own = new Set(packagesFor(app.framework).map(packageName));
  const packages = Object.fromEntries(Object.entries(forgebook.packages).filter(([name]) => own.has(name)));
  const stamp = (isForAgents: boolean): string =>
    JSON.stringify({ commit: app.commit, packages, isForAgents, hooks: request.profile.hooks ?? null });
  const setup = (isForAgents: boolean) => async (folder: string) =>
    setUpForgebook({
      app,
      folder,
      packages,
      isForAgents,
      ...(isForAgents && request.profile.hooks !== undefined ? { hooks: request.profile.hooks } : {}),
      env,
      answerFile: join(work, "apps", app.name, `init-${isForAgents ? "agents" : "measure"}.json`),
      io
    });
  request.onStep(`${app.name}: Forgebook set up by init --agents, for the arm with it`);
  const withBase = await derivedBase(
    without,
    basePath(work, app.name, `with-${request.profile.hooks ?? "default"}`),
    stamp(true),
    setup(true),
    "Set up Forgebook",
    io
  );
  request.onStep(`${app.name}: Forgebook set up for the measurements`);
  const measure = await derivedBase(
    without,
    basePath(work, app.name, "measure"),
    stamp(false),
    setup(false),
    "Set up Forgebook",
    io
  );
  request.onStep(`${app.name}: its own checks on the clone as it is`);
  const check = join(work, "workspaces", `${app.name}--baseline`);
  // on the copy the changes are measured in, Forgebook's files included, so a check they break is red at base too
  await copyFolder(measure, check);
  const baseline = await baselineChecks(app, check, env, io);
  return { bases: { with: withBase, without, measure }, baseline };
};

/**
 * Runs an evaluation.
 *
 * @param request - the tasks, the agent and where.
 * @returns each run's end, in the order run.
 */
export const runEvaluation = async (request: EvaluationRequest): Promise<RunEnd[]> => {
  const { work, io } = request;
  const startedAt = Date.now();
  await mkdir(join(work, "runs"), { recursive: true });
  // both arms' agents and every command of an app use the work folder's browsers, never the person's folder
  const agentEnv = {
    PLAYWRIGHT_BROWSERS_PATH: join(work, "browsers"),
    PLAYWRIGHT_SKIP_BROWSER_GC: "1"
  };
  // the person's home stays: a package manager there picks its version and settings from it, and an app installed
  // with another would not be the app its repository describes; the evaluation runs in a machine of its own
  const env = agentEnv;
  const plan = planRuns(
    request.tasks.map((task) => task.id),
    request.repeats,
    seeded(request.seed)
  );
  await writeFile(
    join(work, "plan.json"),
    `${JSON.stringify({ seed: request.seed, runs: plan }, null, 2)}\n`
  );
  const forgebook = await forgebookUnderTest(request);
  const browser = await chromium.launch();
  const shared: RunShared = { env, agentEnv, forgebook, browser, prepared: new Map() };
  const ends: RunEnd[] = [];
  try {
    for (const planned of plan) ends.push(await oneRun(planned, request, shared));
  } finally {
    await browser.close();
    await stopLeftovers(work, startedAt, io);
  }
  return ends;
};

/** What every run of one evaluation shares. */
type RunShared = {
  /** Variables every command of an app gets. */
  readonly env: Readonly<Record<string, string>>;
  /** Variables both arms' agents get. */
  readonly agentEnv: Readonly<Record<string, string>>;
  /** The Forgebook under test. */
  readonly forgebook: ForgebookUnderTest;
  /** The browser. */
  readonly browser: Awaited<ReturnType<typeof chromium.launch>>;
  /** Each app's bases, once made. */
  readonly prepared: Map<string, Awaited<ReturnType<typeof appBases>>>;
};

/** One planned run, its app's bases made first when they are not yet. */
const oneRun = async (
  planned: PlannedRun,
  request: EvaluationRequest,
  shared: RunShared
): Promise<RunEnd> => {
  const { env, agentEnv, forgebook, browser, prepared } = shared;
  const task = request.tasks.find((each) => each.id === planned.task);
  const app = task === undefined ? undefined : request.apps.get(task.app);
  if (task === undefined || app === undefined)
    return { id: planned.id, kind: "failed", reason: "no such task" };
  const provenance = { forgebook: forgebook.label, definition: definitionHash(task, app) };
  const done = join(runFolder(request.work, planned.id), "measures.json");
  if (!request.isFresh && existsSync(done)) {
    const measures = parseMeasures(readFileSync(done, "utf8"), done);
    // a run of another agent, another Forgebook build or another definition is run again, never mixed in
    const isSame =
      measures.agent === request.profile.name &&
      measures.forgebook === provenance.forgebook &&
      measures.definition === provenance.definition;
    if (isSame) {
      request.onStep(`${planned.id}: measured already`);
      return { id: planned.id, kind: "measured", measures };
    }
    request.onStep(`${planned.id}: measured with another agent, build or definition; running it again`);
  }
  try {
    let bases = prepared.get(app.name);
    if (bases === undefined) {
      bases = await appBases(request, app, forgebook, env);
      prepared.set(app.name, bases);
    }
    request.onStep(`${planned.id}: the agent at work`);
    const measures = await runOne(planned, {
      app,
      task,
      taskFolder: join(EVAL_FOLDER, "tasks", task.id),
      evalFolder: EVAL_FOLDER,
      profile: request.profile,
      bases: bases.bases,
      baseline: bases.baseline,
      work: request.work,
      port: request.port,
      browser,
      env,
      agentEnv,
      provenance,
      isKept: request.isKept,
      io: request.io
    });
    return { id: planned.id, kind: "measured", measures };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await mkdir(runFolder(request.work, planned.id), { recursive: true });
    await writeFile(join(runFolder(request.work, planned.id), "failed.txt"), `${reason}\n`);
    return { id: planned.id, kind: "failed", reason };
  }
};
