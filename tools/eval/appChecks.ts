/**
 * The app's own checks, its type check, tests and linter, run after a change, each compared with the same check on the
 * app as cloned: a check already red there says nothing of the change, and is reported so.
 *
 * @module
 */
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { execProgram } from "../bench/programs.ts";
import { toolEnvironment } from "../bench/toolEnvironment.ts";
import type { CheckResult, Command, EvalApp, RunMeasures } from "./eval.types.ts";

/** How long one check may run, in milliseconds. */
const CHECK_TIMEOUT = 30 * 60_000;

/** How much of a failed check's output is kept, in characters: enough for its reason. */
const TAIL = 1500;

/** The kinds of check, in report order. */
export const CHECK_KINDS = ["typecheck", "test", "lint"] as const;

/** Whether each check passed on the app as cloned. */
export type Baseline = Readonly<Record<(typeof CHECK_KINDS)[number], boolean>>;

/** Runs one check and says how it went. */
const runCheck = async (
  command: Command,
  folder: string,
  env: Readonly<Record<string, string>>,
  io: ScriptIo
): Promise<{ readonly isPassed: boolean; readonly seconds: number; readonly tail: string }> => {
  const [program, ...args] = command;
  if (program === undefined) return { isPassed: true, seconds: 0, tail: "" };
  const startedAt = Date.now();
  try {
    const { code, stdout, stderr } = await execProgram(program, args, {
      cwd: folder,
      io,
      output: "capture",
      check: false,
      env: toolEnvironment(io.env, { CI: "1", ...env }),
      timeoutMs: CHECK_TIMEOUT
    });
    return {
      isPassed: code === 0,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      tail: `${stdout}\n${stderr}`.trim().slice(-TAIL)
    };
  } catch (error) {
    // a time limit reached, or a program missing: a failure of the check, with its reason
    return {
      isPassed: false,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      tail: String(error).slice(-TAIL)
    };
  }
};

/**
 * Runs the app's checks on the app as cloned.
 *
 * @param app - the app.
 * @param folder - a copy of it, unchanged.
 * @param env - variables every command of the app gets.
 * @param io - the script's streams.
 */
export const baselineChecks = async (
  app: EvalApp,
  folder: string,
  env: Readonly<Record<string, string>>,
  io: ScriptIo
): Promise<Baseline> => {
  const passed = async (kind: (typeof CHECK_KINDS)[number]): Promise<boolean> => {
    const command = app.checks[kind];
    return command === undefined ? true : (await runCheck(command, folder, env, io)).isPassed;
  };
  return { typecheck: await passed("typecheck"), test: await passed("test"), lint: await passed("lint") };
};

/**
 * Runs the app's checks after a change.
 *
 * @param app - the app.
 * @param folder - the measurement copy.
 * @param baseline - how each went on the app as cloned.
 * @param env - variables every command of the app gets.
 * @param io - the script's streams.
 */
export const changeChecks = async (
  app: EvalApp,
  folder: string,
  baseline: Baseline,
  env: Readonly<Record<string, string>>,
  io: ScriptIo
): Promise<RunMeasures["checks"]> => {
  const result = async (kind: (typeof CHECK_KINDS)[number]): Promise<CheckResult> => {
    const command = app.checks[kind];
    if (command === undefined) return { kind: "absent" };
    if (!baseline[kind]) return { kind: "failing-at-base" };
    const { isPassed, seconds, tail } = await runCheck(command, folder, env, io);
    return isPassed ? { kind: "passed", seconds } : { kind: "failed", seconds, tail };
  };
  return { typecheck: await result("typecheck"), test: await result("test"), lint: await result("lint") };
};
