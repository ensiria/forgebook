/**
 * The step debugger's hold on a play: before each action it waits for "next", until "continue" lets the rest run.
 *
 * @module
 */
import type { PlayStepper } from "./playStory.ts";

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
