/**
 * The touch simulation's reckoning, apart from the page: what a press was (a tap, a long press, a drag), where the
 * second finger is, which axes a `touch-action` lets a finger scroll, and how a flung scroll slows down.
 *
 * @remarks
 * Pure, so the frame's touch layer (`touchLayer.ts`) stays the events' plumbing. The numbers are the platforms'
 * usual ones: a finger may wander 10 px and still tap, a press held half a second is long, a fling loses about 5% of
 * its speed every 16 ms.
 *
 * @module
 */

/** How far a finger may move and still tap, in CSS px. */
export const TAP_SLOP_PX = 10;

/** How long a press lasts before it is a long press, in ms. */
export const LONG_PRESS_MS = 500;

/** How much of a fling's speed is kept every 16 ms. */
const FLING_KEPT = 0.95;

/** Below this speed a fling stops, in CSS px per ms. */
const FLING_STOP = 0.02;

/** A point in the frame's viewport, in CSS px. */
export type Point = {
  /** From the viewport's left edge. */
  readonly x: number;
  /** From its top edge. */
  readonly y: number;
};

/**
 * How far a finger moved from where it went down.
 *
 * @param start - where it went down.
 * @param current - where it is.
 */
export const distance = (start: Point, current: Point): number =>
  Math.hypot(current.x - start.x, current.y - start.y);

/**
 * Whether a finger that went down at `start` and is now at `current` has started to drag.
 *
 * @param start - where it went down.
 * @param current - where it is.
 */
export const isDragging = (start: Point, current: Point): boolean => distance(start, current) > TAP_SLOP_PX;

/**
 * The second finger of a two-finger gesture: mirrored around where the gesture started, so one movement of the mouse
 * pinches and rotates at once.
 *
 * @param center - where the gesture started.
 * @param first - the first finger, under the mouse.
 */
export const mirroredFinger = (center: Point, first: Point): Point => ({
  x: 2 * center.x - first.x,
  y: 2 * center.y - first.y
});

/**
 * The axis a drag goes along: the one it moved further on, which a scroll then keeps to, as a phone locks a drag's
 * axis.
 *
 * @param start - where the finger went down.
 * @param current - where it is.
 */
export const dragAxis = (start: Point, current: Point): "x" | "y" =>
  Math.abs(current.x - start.x) > Math.abs(current.y - start.y) ? "x" : "y";

/** The axes a finger may scroll. */
export type PanAxes = {
  /** Whether it may scroll sideways. */
  readonly x: boolean;
  /** Whether it may scroll up and down. */
  readonly y: boolean;
};

/**
 * The axes one element's `touch-action` lets a finger scroll.
 *
 * @param touchAction - its computed `touch-action`.
 */
export const panAxesOf = (touchAction: string): PanAxes => {
  const words = touchAction.split(/\s+/);
  if (words.includes("auto") || words.includes("manipulation")) return { x: true, y: true };
  return {
    x: words.some((word) => word === "pan-x" || word === "pan-left" || word === "pan-right"),
    y: words.some((word) => word === "pan-y" || word === "pan-up" || word === "pan-down")
  };
};

/**
 * The axes a finger may scroll through several elements: each one's `touch-action` narrows them, as the browser
 * intersects them from the touched element up to the scrolled one.
 *
 * @param touchActions - the computed `touch-action` of each element on the way.
 */
export const allowedPan = (touchActions: readonly string[]): PanAxes =>
  touchActions.map(panAxesOf).reduce((axes, each) => ({ x: axes.x && each.x, y: axes.y && each.y }), {
    x: true,
    y: true
  });

/**
 * A fling's speed after some time, or zero once it is too slow to see.
 *
 * @param speed - the speed now, in CSS px per ms (signed).
 * @param ms - the time passed.
 */
export const flungSpeed = (speed: number, ms: number): number => {
  const next = speed * FLING_KEPT ** (ms / 16);
  return Math.abs(next) < FLING_STOP ? 0 : next;
};
