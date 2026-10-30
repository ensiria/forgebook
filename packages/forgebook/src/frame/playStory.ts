/**
 * Runs a story's play function, records its trace, and says when it is over, so the frame tells the tests it is
 * ready only then.
 *
 * @remarks
 * A play may change the story over time (press buttons, wait for a state); a check that ran before it finished would
 * read a half-played story. The frame's ready status therefore waits for this. A play that fails is still over: the
 * frame becomes ready and the failure surfaces as an unhandled rejection, which the tests record as a page error.
 * The trace (the play's status, its time, each `step` it named) goes to the shell's Interactions tab after every
 * change; a story without a play has no trace.
 *
 * @module
 */
import type { StepFunction, StoryContext } from "@ensiria/story-format/csf";

import type { PlayStep, PlayTrace } from "../playTrace";
import type { LoadedArgs, LoadedStory } from "./storyModule";

/** A thrown value's message. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Milliseconds since an instant, rounded. */
const since = (start: number): number => Math.round(performance.now() - start);

/**
 * Plays a story, then calls `onPlayed`.
 *
 * @param play - the story's play function, if it has one.
 * @param context - the args and the canvas the play reads; the play's `step` is added here.
 * @param onPlayed - called once the play is over, at once when there is none, whether it passed or failed.
 * @param onTrace - called with the trace after every change; never without a play.
 * @returns the play's promise, rejected when the play failed.
 */
export const playStory = async (
  play: LoadedStory["play"],
  context: Omit<StoryContext<LoadedArgs>, "step">,
  onPlayed: () => void,
  onTrace: (trace: PlayTrace) => void = (): void => undefined
): Promise<void> => {
  if (play === undefined) {
    onPlayed();
    return;
  }
  let steps: readonly PlayStep[] = [];
  const report = (trace: Omit<PlayTrace, "steps">): void => onTrace({ ...trace, steps });
  const setStep = (index: number, step: PlayStep): void => {
    steps = steps.map((current, at) => (at === index ? step : current));
    report({ status: "running" });
  };
  const step: StepFunction = async (label: string, run: () => Promise<void> | void): Promise<void> => {
    const index = steps.length;
    const start = performance.now();
    steps = [...steps, { label, status: "running" }];
    report({ status: "running" });
    try {
      await run();
      setStep(index, { label, status: "passed", ms: since(start) });
    } catch (error) {
      setStep(index, { label, status: "failed", ms: since(start), error: messageOf(error) });
      throw error;
    }
  };
  const start = performance.now();
  report({ status: "running" });
  try {
    await play({ ...context, step });
    report({ status: "passed", ms: since(start) });
  } catch (error) {
    report({ status: "failed", ms: since(start), error: messageOf(error) });
    throw error;
  } finally {
    onPlayed();
  }
};
