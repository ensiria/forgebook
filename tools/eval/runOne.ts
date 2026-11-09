/**
 * One run: the agent on one task in one arm, then the change measured in a copy that is the same for both arms.
 *
 * @remarks
 * The agent works in a copy of its arm's base. What it changed is committed by the harness and taken as a diff from
 * that base, so the set-up the harness made is never counted as the agent's. The diff is then applied to a copy of the
 * `measure` base, where Forgebook is set up without the agents' files and the task's probe stories are committed: every
 * measure runs there, both arms alike, with the change left uncommitted so `verify --since HEAD` and `check-code` see
 * exactly the agent's work.
 *
 * @module
 */
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Browser } from "@playwright/test";

import { folderLeftovers, processTable, stopProcesses } from "../bench/leftovers.ts";
import { toolEnvironment } from "../bench/toolEnvironment.ts";
import { runAgent } from "./agentRun.ts";
import { type Baseline, changeChecks } from "./appChecks.ts";
import { fileKind, isForJudges, isOutsideScope, parseNumstat, redactedDiff } from "./changedFiles.ts";
import { filledCommand } from "./definitions.ts";
import type { AgentProfile, Arm, EvalApp, EvalTask, RunMeasures } from "./eval.types.ts";
import { forgebookMeasures } from "./forgebookMeasures.ts";
import { claimOf, outcomeOf, RESULT_INSTRUCTION } from "./outcome.ts";
import { runPages } from "./pageRun.ts";
import type { PlannedRun } from "./runPlan.ts";
import { isPortTaken, type Server, startServer, stopServer, waitForAnswer } from "./servers.ts";
import { commitAll, copyFolder, git, restoreGitConfig, runCommand } from "./workspace.ts";

/** What every run of an evaluation shares. */
export type RunContext = {
  /** The app of the task. */
  readonly app: EvalApp;
  /** The task. */
  readonly task: EvalTask;
  /** The task's folder, where its probes are. */
  readonly taskFolder: string;
  /** The evaluation's folder, for a command that runs one of its scripts (`{evalDir}`). */
  readonly evalFolder: string;
  /** The agent. */
  readonly profile: AgentProfile;
  /** The bases of the app, by name. */
  readonly bases: Readonly<Record<Arm | "measure", string>>;
  /** How the app's checks went on the app as cloned. */
  readonly baseline: Baseline;
  /** The work folder. */
  readonly work: string;
  /** The first of three ports: the app's, Forgebook's, Forgebook's frames'. */
  readonly port: number;
  /** The browser the pages are pictured in. */
  readonly browser: Browser;
  /** Variables every command of the app gets: its own home, caches and browsers in the work folder. */
  readonly env: Readonly<Record<string, string>>;
  /** Variables both arms' agents get beside their own login: the browsers' folder. */
  readonly agentEnv: Readonly<Record<string, string>>;
  /** The Forgebook build's label and the definition's fingerprint, written into the measures. */
  readonly provenance: Pick<RunMeasures, "forgebook" | "definition">;
  /** Whether to keep the run's copies of the app. */
  readonly isKept: boolean;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** The folder of a run's outputs. */
export const runFolder = (work: string, id: string): string => join(work, "runs", id);

/** A diff with no program of the repository's configuration run: no external diff, no text conversion. */
const SAFE_DIFF = ["--no-ext-diff", "--no-textconv"];

/** What the agent's step gave: its copy, the commit it started from, the commit of its change, how it ran. */
type AgentStep = {
  readonly workspace: string;
  readonly base: string;
  readonly head: string;
  readonly agent: Awaited<ReturnType<typeof runAgent>>;
};

/** Runs the agent in a copy of its arm's base, and commits what it changed. */
const agentStep = async (planned: PlannedRun, context: RunContext, out: string): Promise<AgentStep> => {
  // a name that says nothing: an agent reads its own folder's path, and the prompt file's
  const room = join(context.work, "workspaces", randomUUID());
  const workspace = join(room, "app");
  await copyFolder(context.bases[planned.arm], workspace);
  const local = { cwd: workspace, io: context.io };
  const base = (await git(["rev-parse", "HEAD"], local)).trim();
  const promptFile = join(room, "prompt.md");
  const prompt = `${context.task.prompt}\n\n${RESULT_INSTRUCTION}\n`;
  await writeFile(promptFile, prompt);
  await writeFile(join(out, "prompt.md"), prompt);
  const command = filledCommand(context.profile.command, {
    prompt,
    promptFile,
    workspace,
    arm: planned.arm,
    task: context.taskFolder,
    evalDir: context.evalFolder
  });
  const agent = await runAgent({
    profile: context.profile,
    command,
    workspace,
    stdoutFile: join(out, "agent.stdout.txt"),
    stderrFile: join(out, "agent.stderr.txt"),
    env: context.io.env,
    shared: context.agentEnv
  });
  // what detached from the agent and still runs from its copy; never the harness's own children, its browser
  const left = folderLeftovers(await processTable(context.io), [workspace], process.pid);
  await stopProcesses(left);
  for (const each of left)
    context.io.stderr.write(`stopped a process the agent left running: ${each.pid} ${each.command}\n`);
  await restoreGitConfig(context.bases[planned.arm], workspace);
  const head = await commitAll("Change", local);
  return { workspace, base, head, agent };
};

/** The files of the change, sorted, and the judges' diff written. */
const filesStep = async (
  context: RunContext,
  workspace: string,
  base: string,
  head: string,
  out: string
): Promise<RunMeasures["files"] & { readonly redactions: number; readonly measured: readonly string[] }> => {
  const local = { cwd: workspace, io: context.io };
  const stats = parseNumstat(
    await git(["diff", ...SAFE_DIFF, "--numstat", "-z", "--no-renames", base, head], local)
  );
  const kinds = stats.map((stat) => ({ ...stat, kind: fileKind(stat.path) }));
  const of = (kind: string): string[] => kinds.filter((each) => each.kind === kind).map((each) => each.path);
  const product = of("product");
  const judged = kinds.filter((each) => isForJudges(each.kind)).map((each) => each.path);
  const diff =
    judged.length === 0
      ? ""
      : await git(["diff", ...SAFE_DIFF, "--no-renames", base, head, "--", ...judged], local);
  const { text, redactions } = redactedDiff(diff);
  await writeFile(join(out, "diff.patch"), text);
  await writeFile(
    join(out, "full.patch"),
    await git(["diff", ...SAFE_DIFF, "--binary", "--no-renames", base, head], local)
  );
  const productStats = kinds.filter((each) => each.kind === "product");
  return {
    product,
    stories: [...of("story"), ...of("test")],
    tooling: of("tooling"),
    outsideScope: product.filter((path) => isOutsideScope(path, context.task.scope)),
    added: productStats.reduce((sum, each) => sum + each.added, 0),
    removed: productStats.reduce((sum, each) => sum + each.removed, 0),
    redactions,
    // the set-up files are each arm's own and lockfiles an install's: the measurement copy has its own of both
    measured: kinds
      .filter((each) => each.kind !== "tooling" && each.kind !== "lockfile")
      .map((each) => each.path)
  };
};

/**
 * The measurement copy: the `measure` base, the probes committed, the agent's change to the product, its tests and
 * stories applied and left uncommitted.
 */
const measureCopy = async (
  context: RunContext,
  change: { readonly workspace: string; readonly base: string; readonly head: string },
  measured: readonly string[],
  out: string
): Promise<string> => {
  const folder = join(context.work, "workspaces", randomUUID(), "app");
  await copyFolder(context.bases.measure, folder);
  const local = { cwd: folder, io: context.io };
  for (const probe of context.task.probes) {
    await mkdir(dirname(join(folder, probe.target)), { recursive: true });
    await cp(join(context.taskFolder, probe.source), join(folder, probe.target));
  }
  await commitAll("Probe stories", local);
  if (measured.length === 0) return folder;
  const patch = join(out, "measured.patch");
  const source = { cwd: change.workspace, io: context.io };
  const diff = [
    "diff",
    ...SAFE_DIFF,
    "--binary",
    "--no-renames",
    change.base,
    change.head,
    "--",
    ...measured
  ];
  await writeFile(patch, await git(diff, source));
  await git(["apply", "--3way", "--whitespace=nowarn", patch], local);
  if (measured.some((path) => /(^|\/)package\.json$/.test(path))) {
    await runCommand([context.app.packageManager, "install"], {
      cwd: folder,
      io: context.io,
      env: { ...context.env, npm_config_ignore_scripts: "true", YARN_ENABLE_SCRIPTS: "false" }
    });
  }
  return folder;
};

/**
 * Starts one server in the measurement copy, after checking its ports are free, and waits until it answers.
 *
 * @param command - the server's command.
 * @param ports - the ports it takes.
 * @param address - what answers once it can draw.
 */
const serve = async (
  context: RunContext,
  folder: string,
  command: readonly string[],
  ports: readonly number[],
  address: string
): Promise<Server> => {
  for (const port of ports) {
    if (await isPortTaken(port)) throw new Error(`port ${port} is already taken: give --port another`);
  }
  const server = startServer(
    command,
    folder,
    toolEnvironment(context.io.env, { BROWSER: "none", ...context.env })
  );
  try {
    await waitForAnswer(server, address);
  } catch (error) {
    await stopServer(server);
    throw error;
  }
  return server;
};

/**
 * Runs work while a server runs, and stops it after. The app's server and Forgebook's never run together: both
 * pre-bundle into the project's Vite cache, and one rewriting it under the other makes the app's pages fail.
 */
const whileServing = async <TResult>(
  server: Promise<Server>,
  work: () => Promise<TResult>
): Promise<TResult> => {
  const running = await server;
  try {
    return await work();
  } finally {
    await stopServer(running);
  }
};

/**
 * Runs one run end to end and writes its measures.
 *
 * @param planned - the run.
 * @param context - what every run shares.
 */
export const runOne = async (planned: PlannedRun, context: RunContext): Promise<RunMeasures> => {
  const out = runFolder(context.work, planned.id);
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, "states"), { recursive: true });
  await mkdir(join(out, "forgebook"), { recursive: true });
  const change = await agentStep(planned, context, out);
  const files = await filesStep(context, change.workspace, change.base, change.head, out);
  const folder = await measureCopy(context, change, files.measured, out);
  const [app, catalogue, frames] = [context.port, context.port + 1, context.port + 2];
  const appOrigin = `http://localhost:${app}${context.app.basePath}`;
  const pages = await whileServing(
    serve(
      context,
      folder,
      context.app.dev.map((word) => word.replaceAll("{port}", String(app))),
      [app],
      `${appOrigin}${context.app.readyPath}`
    ),
    () =>
      runPages({
        browser: context.browser,
        origin: appOrigin,
        folder,
        states: context.task.states,
        acceptance: context.task.acceptance,
        pictures: join(out, "states")
      })
  );
  const forgebook = join(folder, "node_modules", ".bin", "forgebook");
  const verdicts = await whileServing(
    serve(
      context,
      folder,
      [forgebook, "dev", "--port", String(catalogue), "--frame-port", String(frames)],
      [catalogue, frames],
      `http://localhost:${catalogue}/`
    ),
    () =>
      forgebookMeasures({
        folder,
        url: `http://localhost:${catalogue}`,
        probes: context.task.probes.map((probe) => probe.target),
        env: context.env,
        keep: (name, text) => writeFile(join(out, "forgebook", name), text),
        io: context.io
      })
  );
  const checks = await changeChecks(context.app, folder, context.baseline, context.env, context.io);
  const claim = claimOf(await readFile(join(out, "agent.stdout.txt"), "utf8"));
  const isWorking =
    pages.acceptance.every((each) => each.isPassed) &&
    checks.typecheck.kind !== "failed" &&
    checks.test.kind !== "failed";
  const { redactions, measured: _measured, ...changed } = files;
  const measures: RunMeasures = {
    id: planned.id,
    task: planned.task,
    arm: planned.arm,
    repeat: planned.repeat,
    agent: context.profile.name,
    ...context.provenance,
    agentSeconds: change.agent.seconds,
    isTimedOut: change.agent.isTimedOut,
    agentExit: change.agent.exitCode,
    claim,
    isWorking,
    outcome: outcomeOf(claim, isWorking),
    acceptance: pages.acceptance,
    checks,
    states: pages.states,
    ...verdicts,
    files: changed,
    redactions
  };
  await writeFile(join(out, "measures.json"), `${JSON.stringify(measures, null, 2)}\n`);
  if (!context.isKept) {
    await rm(dirname(change.workspace), { recursive: true, force: true });
    await rm(dirname(folder), { recursive: true, force: true });
  }
  return measures;
};
