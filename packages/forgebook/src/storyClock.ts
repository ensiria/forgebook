/**
 * The story clock's settings, shared by the shell (its controls), the frame (the clock it runs) and the tests (which
 * hold it): the speeds, the state the controls set, and the address that holds the clock at its start (D-504).
 *
 * @remarks
 * Pure. The clock a story reads is typed in `@forgebook/story-format/clock`; the frame runs it (`frame/frameClock.ts`).
 * Holding the clock goes through the frame's address, as everything that changes what a frame draws does (one
 * document per story): the generated and visual tests open a Live story held at its start, so its image never
 * changes and its play function moves it on with `advance` (D-628).
 *
 * @module
 */

/** How fast the clock runs against real time: real time, or ten times faster. */
export type ClockRate = 1 | 10;

/** Every speed, in the controls' order. */
export const CLOCK_RATES: readonly ClockRate[] = [1, 10];

/** What the shell's clock controls set on a frame's clock. */
export type ClockState = {
  /** Whether the clock runs; held, it keeps its moment until resumed or advanced. */
  readonly isRunning: boolean;
  /** How fast it runs. */
  readonly rate: ClockRate;
};

/** A Live story's clock when it opens: running, at real time. */
export const DEFAULT_CLOCK_STATE: ClockState = { isRunning: true, rate: 1 };

/** The frame address's parameter that holds the clock at its start, and its value. */
const HELD_PARAM = { name: "clock", value: "held" } as const;

/**
 * A frame's address with its story clock held at its start: what the tests open.
 *
 * @param address - the frame's address (`frame.html?story=…`).
 * @returns the same address, holding the clock.
 */
export const heldClockAddress = (address: string): string =>
  `${address}${address.includes("?") ? "&" : "?"}${HELD_PARAM.name}=${HELD_PARAM.value}`;

/**
 * Whether a frame's address holds its story clock at its start.
 *
 * @param search - the address's query (`?story=…&clock=held`).
 */
export const isClockHeldIn = (search: string): boolean =>
  new URLSearchParams(search).get(HELD_PARAM.name) === HELD_PARAM.value;

/**
 * Whether a value is one of the clock's speeds.
 *
 * @param value - any value.
 */
export const isClockRate = (value: unknown): value is ClockRate => CLOCK_RATES.some((rate) => rate === value);

/** Where a running clock stands: its moment at a real instant, and how fast it moves from there. */
export type ClockReading = {
  /** The story's moment, in ms since the Unix epoch. */
  readonly moment: number;
  /** The real instant it was read at, in ms of the page's monotonic clock (`performance.now()`). */
  readonly at: number;
};

/**
 * The clock's moment at a later real instant: it moves `rate` times as fast as real time while it runs, not at all
 * while held, and never backwards.
 *
 * @param reading - where it stood.
 * @param state - whether it runs, and how fast.
 * @param at - the later real instant, in ms of the same monotonic clock.
 * @returns where it stands then.
 */
export const readClock = (reading: ClockReading, state: ClockState, at: number): ClockReading => {
  const elapsed = Math.max(0, at - reading.at);
  return { moment: state.isRunning ? reading.moment + elapsed * state.rate : reading.moment, at };
};
