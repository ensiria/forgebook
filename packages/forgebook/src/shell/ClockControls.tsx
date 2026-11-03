/**
 * The story clock's controls on the stage, for a Live story: pause and resume, restart, and the speed.
 *
 * @remarks
 * The state lives in the shell, per shown story: a new story starts running at real time, and a frame that loads
 * again (an edit, another language) receives the state it had. The frame runs the clock (`frame/frameClock.ts`);
 * these controls only send it what to do, so the shell never reads the story's time. Few stories have a clock, so the
 * controls themselves (`ClockBar.tsx`) load with the first that has one.
 *
 * @module
 */
import { type ReactNode, type RefObject, useEffect, useState } from "react";

import type { ShellMessage } from "../messages.ts";
import { type ClockState, DEFAULT_CLOCK_STATE } from "../storyClock.ts";
import type { ClockBarProps } from "./ClockBar.tsx";
import { framesOrigin } from "./framesOrigin.ts";
import { LazyView, lazyModule } from "./lazyModule.tsx";

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
    frameRef.current?.contentWindow?.postMessage(message, framesOrigin());
  // the frame hears every state once it is drawn, so a change builds on the latest state, never on a render's copy
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "forgebook:clock", state } satisfies ShellMessage,
      framesOrigin()
    );
  }, [frameRef, state]);
  return {
    state,
    change: (patch: Partial<ClockState>): void =>
      setLocalState((current: ClockState) => ({ ...current, ...patch })),
    restart: (): void => send({ type: "forgebook:clock-restart" }),
    sendTo: (frame: Window): void =>
      frame.postMessage({ type: "forgebook:clock", state } satisfies ShellMessage, framesOrigin())
  };
};

/** The controls' module, loaded with the first story that reads the clock. */
const CLOCK_BAR = lazyModule(() => import("./ClockBar.tsx").then((module) => module.ClockBar));

/**
 * The clock's controls, once their module is there.
 *
 * @param props - the clock's state and what changes it.
 */
export const ClockControls = (props: ClockBarProps): ReactNode => (
  <LazyView module={CLOCK_BAR} props={props} loading={null} failed={(): null => null} />
);
