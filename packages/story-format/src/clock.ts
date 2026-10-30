/**
 * The story clock: the time a Live story reads, which the catalogue starts at a fixed moment and then runs, holds,
 * restarts and speeds up (D-504).
 *
 * @remarks
 * A component that counts (a countdown, a stream, a toast's wait) never reads the time itself: it takes a clock from
 * its owner. In a story, that owner is the story, and the story's time comes from here: `context.clock` in a render
 * or a play function; a framework's package gives components their own access (`useStoryClock()`, `useStoryNow()` in
 * `@forgebook/react/clock`). The catalogue
 * provides the clock; the library shown converts its milliseconds into its own time type, so this package names no
 * date library and the catalogue none of the libraries it shows (D-67).
 *
 * The clock is stepped: `now()` is the moment of its last tick, the same value until the next one, so a render reads
 * one moment throughout and a component can subscribe to it. A story that reads the clock declares
 * `parameters.clock` with its start; the visual and generated tests hold the clock at that start, and a play
 * function moves it with `advance` ("30 s later it says Expired"), never with a real wait. Without a catalogue (a
 * story rendered on its own) the clock is held at the Unix epoch.
 *
 * @module
 */
/** The time a story reads. */
export type StoryClock = {
  /**
   * The story's current moment, in whole milliseconds since the Unix epoch (what a date library takes as is): the
   * moment of the clock's last tick.
   */
  readonly now: () => number;
  /**
   * Calls `onTick` at each tick and on every jump (advanced, restarted); returns what stops it.
   *
   * @param onTick - called once the clock moved.
   */
  readonly subscribe: (onTick: () => void) => () => void;
  /**
   * Moves the clock forward at once, whether it runs or is held: what a play function does instead of waiting.
   *
   * @param ms - how far, in milliseconds; a negative or non-finite value moves nothing.
   */
  readonly advance: (ms: number) => void;
};

/** A story's clock setting (`parameters.clock`): the story reads the clock, from this moment. */
export type StoryClockSetting = {
  /**
   * The moment the clock starts at, and comes back to on Restart: an ISO 8601 instant with its offset
   * (`2026-03-02T10:00:00Z`), so the story draws the same at its start every time.
   */
  readonly start: string;
};

/**
 * A clock held at a moment: it moves only when advanced.
 *
 * @param start - its moment, in milliseconds since the Unix epoch.
 * @returns the clock.
 */
export const heldStoryClock = (start: number): StoryClock => {
  let current = start;
  const listeners = new Set<() => void>();
  return {
    now: (): number => Math.floor(current),
    subscribe: (onTick: () => void): (() => void) => {
      listeners.add(onTick);
      return (): void => {
        listeners.delete(onTick);
      };
    },
    advance: (ms: number): void => {
      if (!Number.isFinite(ms) || ms <= 0) return;
      current += ms;
      for (const listener of listeners) listener();
    }
  };
};
