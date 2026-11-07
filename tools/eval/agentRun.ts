/**
 * Starts the agent under test on a task and waits for it, with a time limit: whatever CLI the profile names, with the
 * prompt and nothing else.
 *
 * @remarks
 * The harness holds no key and calls no model. The agent keeps its own login: the variables its profile names, and
 * `HOME`, where a CLI keeps one, beside a program's basics; every other variable of the environment stays out. Its
 * output goes to the run's folder, outside the project, so it never reads what it said in an earlier run. It gets no
 * terminal and no input: a CLI that asks a question is stopped at its time limit and counted as not done.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

import { isOwnGroup, killTree, STOP_TIMEOUT, waitForExit } from "../bench/processTree.ts";
import { invocation } from "../bench/programs.ts";
import { toolEnvironment } from "../bench/toolEnvironment.ts";
import type { AgentProfile } from "./eval.types.ts";

/** What an agent's run gave. */
export type AgentResult = {
  /** How long it ran, in seconds. */
  readonly seconds: number;
  /** Its exit code; none when it was stopped. */
  readonly exitCode: number | null;
  /** Whether it was stopped at its time limit. */
  readonly isTimedOut: boolean;
};

/** What `runAgent` needs. */
export type AgentRequest = {
  /** The profile. */
  readonly profile: AgentProfile;
  /** The command, its placeholders filled. */
  readonly command: readonly string[];
  /** The project's folder: the agent's working folder. */
  readonly workspace: string;
  /** Where its standard output goes. */
  readonly stdoutFile: string;
  /** Where its standard error goes. */
  readonly stderrFile: string;
  /** The harness's environment, which the agent's is taken from. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Variables both arms' agents get alike (the browsers' folder). */
  readonly shared: Readonly<Record<string, string>>;
};

/**
 * The agent's environment: a program's basics, the variables its profile names, and what both arms share.
 *
 * @param profile - the profile.
 * @param env - the harness's environment.
 * @param shared - what both arms get.
 */
export const agentEnvironment = (
  profile: AgentProfile,
  env: Readonly<Record<string, string | undefined>>,
  shared: Readonly<Record<string, string>>
): Record<string, string> => {
  const own: Record<string, string> = {};
  for (const name of profile.env) {
    const value = env[name];
    if (value !== undefined) own[name] = value;
  }
  return toolEnvironment(env, { ...shared, ...own });
};

/**
 * Runs the agent to its end or its time limit.
 *
 * @param request - the agent, its command and where.
 */
export const runAgent = async (request: AgentRequest): Promise<AgentResult> => {
  const [program, ...args] = request.command;
  if (program === undefined) throw new Error("the agent's command is empty");
  const env = agentEnvironment(request.profile, request.env, request.shared);
  const resolved = invocation(program, args, { cwd: request.workspace, env });
  const stdout = createWriteStream(request.stdoutFile);
  const stderr = createWriteStream(request.stderrFile);
  const startedAt = Date.now();
  const child = spawn(resolved.program, [...resolved.args], {
    cwd: request.workspace,
    env,
    detached: isOwnGroup,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const failed = new Promise<Error>((resolve) => child.once("error", resolve));
  const limitMs = request.profile.timeoutMinutes * 60_000;
  const ended = await Promise.race([waitForExit(child, limitMs), failed]);
  if (ended instanceof Error) throw new Error(`the agent could not start: ${ended.message}`);
  const isTimedOut = !ended;
  // whatever it started goes with it: an agent's dev server left running would answer for the measurement's
  if (child.pid !== undefined) await killTree(child.pid);
  await waitForExit(child, STOP_TIMEOUT);
  await Promise.all([
    new Promise((resolve) => stdout.end(resolve)),
    new Promise((resolve) => stderr.end(resolve))
  ]);
  return { seconds: Math.round((Date.now() - startedAt) / 1000), exitCode: child.exitCode, isTimedOut };
};
