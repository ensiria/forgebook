/**
 * The story clock a frame runs for its story: it starts at the story's moment and then moves with real time, at the
 * speed the shell's controls set, or stays held (D-504).
 *
 * @remarks
 * The clock is stepped: it ticks every `TICK_MS` of real time while it runs, and `now()` is the moment of its last
 * tick, so a render reads one moment throughout and React can subscribe to it (`useStoryNow`, D-627). Pausing keeps the
 * moment; Restart brings it back to the start (the frame mounts the story again with it); `advance` jumps at once,
 * held or not. Listeners hear every tick and every jump. The clock names no date library: the library shown turns
 * the milliseconds into its own time type (D-67).
 *
 * @module
 */
import type { StoryClock } from "@ensiria/story-format/clock";

import { type ClockReading, type ClockState, DEFAULT_CLOCK_STATE, readClock } from "../storyClock";

/** How often a running clock ticks, in ms of real time: often enough for a stream's words, a ring's sweep. */
const TICK_MS = 50;

/** The clock a frame runs: the story's clock, and what the shell's controls do to it. */
export type FrameClock = StoryClock & {
  /** Sets whether it runs and how fast, from its moment now. */
  readonly setState: (state: ClockState) => void;
  /** Brings it back to its start, keeping whether it runs and how fast. */
  readonly restart: () => void;
};

/** What a frame clock starts from. */
export type FrameClockOptions = {
  /** The story's start, in ms since the Unix epoch. */
  readonly start: number;
  /** Whether it runs, and how fast, from the start. */
  readonly state: ClockState;
};

/**
 * Starts a story's clock.
 *
 * @param options - its start, and whether it runs and how fast.
 * @returns the clock.
 */
export const createFrameClock = ({ start, state: initial }: FrameClockOptions): FrameClock => {
  let state = initial;
  let reading: ClockReading = { moment: start, at: performance.now() };
  let timer: number | undefined;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  const tick = (): void => {
    reading = readClock(reading, state, performance.now());
    notify();
  };
  // a held clock needs no timer: nothing moves it but a jump, which notifies on its own
  const schedule = (): void => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = state.isRunning ? window.setInterval(tick, TICK_MS) : undefined;
  };
  schedule();
  return {
    // whole milliseconds, as the story clock promises: the reading itself keeps the fractions, so nothing drifts
    now: (): number => Math.floor(reading.moment),
    subscribe: (onTick: () => void): (() => void) => {
      listeners.add(onTick);
      return (): void => {
        listeners.delete(onTick);
      };
    },
    advance: (ms: number): void => {
      if (!Number.isFinite(ms) || ms <= 0) return;
      const now = readClock(reading, state, performance.now());
      reading = { moment: now.moment + ms, at: now.at };
      notify();
    },
    setState: (next: ClockState): void => {
      reading = readClock(reading, state, performance.now());
      state = next;
      schedule();
      notify();
    },
    restart: (): void => {
      reading = { moment: start, at: performance.now() };
      notify();
    }
  };
};

/**
 * The clock a frame runs for its story: a Live story's from its start, held there when the frame's address says so;
 * a still's held at the epoch.
 *
 * @param clockStart - the story's clock start, in ms since the Unix epoch; none for a still.
 * @param isHeld - whether the frame's address holds the clock (`clock=held`, what the tests open).
 * @returns the clock.
 */
export const storyFrameClock = (clockStart: number | undefined, isHeld: boolean): FrameClock => {
  if (clockStart === undefined) return heldFrameClock(0);
  return isHeld
    ? heldFrameClock(clockStart)
    : createFrameClock({ start: clockStart, state: DEFAULT_CLOCK_STATE });
};

/**
 * A story's clock held at its start: what a still, a test frame and the server render read.
 *
 * @param start - the start, in ms since the Unix epoch.
 * @returns the clock, held until the controls run it or a play advances it.
 */
export const heldFrameClock = (start: number): FrameClock =>
  createFrameClock({ start, state: { ...DEFAULT_CLOCK_STATE, isRunning: false } });
