/**
 * The order of an evaluation's runs: every task in both arms, repeated, the arms interleaved and the order shuffled from
 * a seed, so a machine or a model service that changes during the evaluation does not land on one arm.
 *
 * @module
 */
import type { Arm } from "./eval.types.ts";
import { type Random, shuffled } from "./random.ts";

/** Both arms, in the order the reports list them. */
export const ARMS: readonly Arm[] = ["with", "without"];

/** One run to do. */
export type PlannedRun = {
  /** Its id, also its folder's name: `<task>--<arm>--<repeat>`. */
  readonly id: string;
  /** The task. */
  readonly task: string;
  /** The arm. */
  readonly arm: Arm;
  /** The repeat, from 1. */
  readonly repeat: number;
};

/**
 * A run's id.
 *
 * @param task - the task.
 * @param arm - the arm.
 * @param repeat - the repeat, from 1.
 */
export const runId = (task: string, arm: Arm, repeat: number): string => `${task}--${arm}--${repeat}`;

/**
 * The runs, in the order to do them: repeat by repeat, and within one the tasks shuffled, each task's two arms side by
 * side in a random order. Two arms of a task run close together, so what changes over hours (a model's load, the
 * machine's) weighs on both alike.
 *
 * @param tasks - the tasks' ids.
 * @param repeats - how many times each task runs in each arm.
 * @param random - the generator.
 */
export const planRuns = (tasks: readonly string[], repeats: number, random: Random): PlannedRun[] => {
  const runs: PlannedRun[] = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const task of shuffled(tasks, random)) {
      for (const arm of shuffled(ARMS, random))
        runs.push({ id: runId(task, arm, repeat), task, arm, repeat });
    }
  }
  return runs;
};
