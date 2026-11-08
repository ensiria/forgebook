/**
 * How a frame starts a play and holds it: the step debugger's hold waits before each action for "next", until
 * "continue" lets the rest run.
 *
 * @remarks
 * Most stories have no play, and every frame loads this module with `storyRun.ts`: the play's runner (`playStory.ts`)
 * and the actions it records load with the first story that has a play, not with every frame.
 *
 * @module
 */
import type { PlayStepper, playStory } from "./playStory.ts";

/** A hold the shell's commands release. */
export type HeldStepper = PlayStepper & {
  /** Lets the play do its next action. */
  readonly next: () => void;
  /** Lets the play run to its end. */
  readonly release: () => void;
};

/** A new hold: the play stops before its first action. */
export const heldStepper = (): HeldStepper => {
  let isHolding = true;
  // a play may wait on several actions at once (`Promise.all`): "next" lets them all go
  let waiting: readonly (() => void)[] = [];
  const next = (): void => {
    for (const resume of waiting) resume();
    waiting = [];
  };
  return {
    isHolding: (): boolean => isHolding,
    wait: (): Promise<void> =>
      new Promise((resolve) => {
        waiting = [...waiting, resolve];
      }),
    next,
    release: (): void => {
      isHolding = false;
      next();
    }
  };
};

/**
 * Plays a story, then calls `onPlayed`: at once when it has no play, without loading the runner.
 *
 * @param args - what `playStory` takes, in its order: the play, its context, `onPlayed`, `onTrace`, the tools and the
 * stepper.
 * @returns the play's promise, rejected when the play failed.
 */
export const runPlay = async (...args: Parameters<typeof playStory>): Promise<void> => {
  const [play, , onPlayed] = args;
  if (play === undefined) {
    onPlayed();
    return;
  }
  const runner = await import("./playStory.ts");
  return runner.playStory(...args);
};
