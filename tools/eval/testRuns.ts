/**
 * Runs' measures for the evaluation's tests: every field filled with a neutral value, so a test sets only what it reads.
 *
 * @module
 */
import type { Arm, RunMeasures } from "./eval.types.ts";
import { runId } from "./runPlan.ts";

/**
 * A run's measures, neutral but for its task, arm and repeat, and what the test overrides.
 *
 * @param task - the task.
 * @param arm - the arm.
 * @param repeat - the repeat.
 * @param overrides - the fields the test sets.
 */
export const measured = (
  task: string,
  arm: Arm,
  repeat: number,
  overrides: Partial<RunMeasures> = {}
): RunMeasures => ({
  id: runId(task, arm, repeat),
  task,
  arm,
  repeat,
  agent: "dry-run",
  forgebook: "sha256:0",
  definition: "0",
  agentSeconds: 1,
  isTimedOut: false,
  agentExit: 0,
  claim: "done",
  isWorking: true,
  outcome: "done-and-working",
  acceptance: [],
  checks: { typecheck: { kind: "absent" }, test: { kind: "absent" }, lint: { kind: "absent" } },
  states: [],
  verify: "not run",
  checkCode: "not run",
  stress: "not run",
  files: { product: [], stories: [], tooling: [], outsideScope: [], added: 0, removed: 0 },
  redactions: 0,
  ...overrides
});
