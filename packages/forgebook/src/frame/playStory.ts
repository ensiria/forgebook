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
import type { StepFunction, StoryContext } from "@forgebook/story-format/csf";

import type { PlayAction, PlayStep, PlayTrace } from "../playTrace.ts";
import { type ActionRecorder, isSyncEvent, isSyncQuery, recordedTool } from "./playActions.ts";
import type { LoadedArgs, LoadedStory } from "./storyModule.ts";

/** A thrown value's message. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Milliseconds since an instant, rounded. */
const since = (start: number): number => Math.round(performance.now() - start);

/** The most actions a trace holds: each message carries the whole list. */
const MAX_ACTIONS = 200;

/** The play tools a project's Testing Library gives, as the frame uses them without depending on it. */
export type PlayTools = {
  /** Testing Library's `within`: its queries bound to an element. */
  readonly within: (element: HTMLElement) => unknown;
  /** Testing Library's `userEvent`. */
  readonly userEvent: unknown;
};

/**
 * Loads the play tools, on the first play that runs: a catalogue whose stories have no play never loads them. The
 * generated frame passes one when the project installs Testing Library.
 */
export type PlayToolsLoader = () => Promise<PlayTools>;

/** What holds a play before each action while it is stepped through. */
export type PlayStepper = {
  /** Whether the play still stops before an action; "continue" ends that. */
  readonly isHolding: () => boolean;
  /** Resolves when "next" or "continue" comes. */
  readonly wait: () => Promise<void>;
};

/**
 * Plays a story, then calls `onPlayed`.
 *
 * @param play - the story's play function, if it has one.
 * @param context - the args and the canvas the play reads; the play's `step` is added here.
 * @param onPlayed - called once the play is over, at once when there is none, whether it passed or failed.
 * @param onTrace - called with the trace after every change; never without a play.
 * @param tools - the play tools to hand the play (`canvas` bound to its canvas, `userEvent`); none without them.
 * @param stepper - holds the play before each action, while it is stepped through; none lets it run.
 * @returns the play's promise, rejected when the play failed.
 */
export const playStory = async (
  play: LoadedStory["play"],
  context: Omit<StoryContext<LoadedArgs>, "step">,
  onPlayed: () => void,
  onTrace: (trace: PlayTrace) => void = (): void => undefined,
  tools: PlayTools | undefined = undefined,
  stepper: PlayStepper | undefined = undefined
): Promise<void> => {
  if (play === undefined) {
    onPlayed();
    return;
  }
  let steps: readonly PlayStep[] = [];
  let actions: readonly PlayAction[] = [];
  let openStep: number | undefined;
  const report = (trace: Omit<PlayTrace, "steps" | "actions">): void =>
    onTrace({ ...trace, steps, ...(actions.length === 0 ? {} : { actions }) });
  const gate = async (label: string): Promise<void> => {
    if (stepper?.isHolding() !== true) return;
    report({ status: "running", pausedAt: label });
    await stepper.wait();
    report({ status: "running" });
  };
  const recorder: ActionRecorder = {
    gate,
    begin: (label: string): number => {
      // a `waitFor` runs its query again until it passes: its failures are one line, not one each
      const last = actions.at(-1);
      if (last?.label === label && last.status === "failed") return actions.length - 1;
      // a play in a loop must not grow every message past what a person reads
      if (actions.length >= MAX_ACTIONS) return actions.length;
      actions = [
        ...actions,
        { label, status: "running", ...(openStep === undefined ? {} : { step: openStep }) }
      ];
      report({ status: "running" });
      return actions.length - 1;
    },
    end: (index: number, action: PlayAction): void => {
      actions = actions.map((current, at) => (at === index ? { ...current, ...action } : current));
      report({ status: "running" });
    }
  };
  const setStep = (index: number, step: PlayStep): void => {
    steps = steps.map((current, at) => (at === index ? step : current));
    report({ status: "running" });
  };
  const step: StepFunction = async (label: string, run: () => Promise<void> | void): Promise<void> => {
    await gate(label);
    const index = steps.length;
    const outer = openStep;
    const start = performance.now();
    steps = [...steps, { label, status: "running" }];
    openStep = index;
    report({ status: "running" });
    try {
      await run();
      setStep(index, { label, status: "passed", ms: since(start) });
    } catch (error) {
      setStep(index, { label, status: "failed", ms: since(start), error: messageOf(error) });
      throw error;
    } finally {
      openStep = outer;
    }
  };
  const start = performance.now();
  report({ status: "running" });
  try {
    const toolsContext =
      tools === undefined
        ? {}
        : {
            canvas: recordedTool(tools.within(context.canvasElement), "canvas", recorder, isSyncQuery),
            userEvent: recordedTool(tools.userEvent, "userEvent", recorder, isSyncEvent)
          };
    await play({ ...context, step, ...toolsContext });
    report({ status: "passed", ms: since(start) });
  } catch (error) {
    report({ status: "failed", ms: since(start), error: messageOf(error) });
    throw error;
  } finally {
    onPlayed();
  }
};
