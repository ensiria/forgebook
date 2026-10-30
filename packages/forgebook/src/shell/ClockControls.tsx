/**
 * The story clock's controls on the stage, for a Live story: pause and resume, restart, and the speed (D-504).
 *
 * @remarks
 * The state lives in the shell, per shown story: a new story starts running at real time, and a frame that loads
 * again (an edit, another language) receives the state it had. The frame runs the clock (`frame/frameClock.ts`);
 * these controls only send it what to do, so the shell never reads the story's time.
 *
 * @module
 */
import { type ReactNode, type RefObject, useEffect, useState } from "react";

import type { ShellMessage } from "../messages.ts";
import { CLOCK_RATES, type ClockRate, type ClockState, DEFAULT_CLOCK_STATE } from "../storyClock.ts";
import { Icon } from "./icons.tsx";
import { Segmented } from "./Segmented.tsx";
import { STRINGS } from "./strings.ts";

/** The clock's state for the shown story, and how to change it in its frame. */
export type StoryClockControls = {
  /** Whether the clock runs, and how fast. */
  readonly state: ClockState;
  /** Changes part of the state, over the latest one (two presses before a render both count), in the shell and in the frame. */
  readonly change: (patch: Partial<ClockState>) => void;
  /** Brings the clock back to its start, the story mounted again. */
  readonly restart: () => void;
  /** Sends the state to a frame that just loaded. */
  readonly sendTo: (frame: Window) => void;
};

/**
 * The clock controls' state for the shown story, started over for each story.
 *
 * @param frameRef - the story's frame.
 * @param storyId - the shown story.
 * @returns the state and what changes it.
 */
export const useStoryClockControls = (
  frameRef: RefObject<HTMLIFrameElement | null>,
  storyId: string
): StoryClockControls => {
  const [state, setLocalState] = useState<ClockState>(DEFAULT_CLOCK_STATE);
  const [shownId, setShownId] = useState(storyId);
  if (shownId !== storyId) {
    setShownId(storyId);
    setLocalState(DEFAULT_CLOCK_STATE);
  }
  const send = (message: ShellMessage): void =>
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  // the frame hears every state once it is drawn, so a change builds on the latest state, never on a render's copy
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "forgebook:clock", state } satisfies ShellMessage,
      window.location.origin
    );
  }, [frameRef, state]);
  return {
    state,
    change: (patch: Partial<ClockState>): void =>
      setLocalState((current: ClockState) => ({ ...current, ...patch })),
    restart: (): void => send({ type: "forgebook:clock-restart" }),
    sendTo: (frame: Window): void =>
      frame.postMessage({ type: "forgebook:clock", state } satisfies ShellMessage, window.location.origin)
  };
};

/** The controls' props. */
export type ClockControlsProps = {
  /** The clock's state and what changes it. */
  readonly controls: StoryClockControls;
};

/**
 * The clock's controls: a pause or resume button, Restart, and the speed.
 *
 * @param props - the clock's state and what changes it.
 */
export const ClockControls = ({ controls }: ClockControlsProps): ReactNode => {
  const { state, change, restart } = controls;
  const toggleLabel = state.isRunning ? STRINGS.clockPause : STRINGS.clockResume;
  return (
    <fieldset className="forgebook-clock">
      <legend className="forgebook-visually-hidden">{STRINGS.clockLabel}</legend>
      <button
        type="button"
        className="forgebook-button forgebook-button--icon"
        title={toggleLabel}
        aria-label={toggleLabel}
        onClick={(): void => change({ isRunning: !state.isRunning })}
      >
        <Icon name={state.isRunning ? "pause" : "play"} size={14} />
      </button>
      <button type="button" className="forgebook-button" onClick={restart}>
        <Icon name="restart" size={14} />
        {STRINGS.clockRestart}
      </button>
      <Segmented
        label={STRINGS.clockSpeed}
        options={CLOCK_RATES.map((rate) => ({ value: rate, label: STRINGS.clockRate(rate) }))}
        value={state.rate}
        onValueChange={(rate: ClockRate): void => change({ rate })}
      />
    </fieldset>
  );
};
