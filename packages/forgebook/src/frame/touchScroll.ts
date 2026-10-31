/**
 * A simulated finger's scrolling: the container a drag scrolls, on the axes the `touch-action` on the way allows, and
 * the fling that carries on after the finger lifts.
 *
 * @remarks
 * An approximation of the browser's own scrolling, which a page cannot start: no rubber band at the ends, the fling
 * slows down at one fixed rate (`flungSpeed`), and a container that snaps snaps once the finger lifts. The scroll keeps to the drag's axis; the container is the nearest
 * ancestor that scrolls on it, up to the document's own scrolling element.
 *
 * @module
 */
import { allowedPan, flungSpeed, type PanAxes, type Point } from "./touchGesture.ts";

/** A scroll a finger drives. */
export type Pan = {
  /** The element it scrolls. */
  readonly scroller: Element;
  /** The axes it scrolls on. */
  readonly axes: PanAxes;
  /**
   * For a container that snaps, its own `scroll-snap-type` (inline) while the drag pauses its snapping, put back when
   * the finger lifts; none for one that does not snap.
   */
  readonly pausedSnap: string | undefined;
};

/** How far ahead a snapping container's fling is aimed, in ms of the finger's last speed. */
const SNAP_AIM_MS = 250;

/**
 * Whether an element scrolls on an axis: it overflows there and its style lets it.
 *
 * @param element - the element.
 * @param axis - the axis.
 */
const scrollsOn = (element: Element, axis: "x" | "y"): boolean => {
  const isDocument = element === element.ownerDocument.scrollingElement;
  const overflow = getComputedStyle(element)[axis === "x" ? "overflowX" : "overflowY"];
  const isScrollable = isDocument || overflow === "auto" || overflow === "scroll";
  const size =
    axis === "x" ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
  return isScrollable && size > 0;
};

/**
 * A drag's scroll begins: a container that snaps stops snapping while the finger drags it, or every step of the drag
 * would snap to a whole item.
 *
 * @param scroller - the container.
 * @param axis - the drag's axis.
 */
const startPan = (scroller: Element, axis: "x" | "y"): Pan => {
  const isSnapping = getComputedStyle(scroller).scrollSnapType !== "none";
  const style = scroller instanceof HTMLElement ? scroller.style : undefined;
  const pausedSnap = isSnapping && style !== undefined ? style.scrollSnapType : undefined;
  if (pausedSnap !== undefined && style !== undefined) style.scrollSnapType = "none";
  return { scroller, axes: { x: axis === "x", y: axis === "y" }, pausedSnap };
};

/**
 * The scroll a drag drives along its axis, or none when the `touch-action` on the way forbids that axis (a horizontal
 * swipe on a `pan-y` row stays the row's) or nothing on the way scrolls on it.
 *
 * @param target - the element the finger went down on.
 * @param axis - the drag's axis.
 */
export const panOf = (target: Element, axis: "x" | "y"): Pan | undefined => {
  const touchActions: string[] = [];
  for (let element: Element | null = target; element !== null; element = element.parentElement) {
    touchActions.push(getComputedStyle(element).touchAction);
    if (!allowedPan(touchActions)[axis]) return undefined;
    if (scrollsOn(element, axis)) return startPan(element, axis);
  }
  return undefined;
};

/**
 * Scrolls by a finger's move: the content follows the finger.
 *
 * @param pan - the scroll.
 * @param from - where the finger was.
 * @param to - where it is.
 */
export const panBy = (pan: Pan, from: Point, to: Point): void =>
  pan.scroller.scrollBy({
    left: pan.axes.x ? from.x - to.x : 0,
    top: pan.axes.y ? from.y - to.y : 0,
    behavior: "instant"
  });

/**
 * Carries a scroll on after the finger lifts, slowing down; the returned function stops it (a new touch does).
 *
 * @param pan - the scroll.
 * @param speed - the finger's last speed, in CSS px per ms, per axis.
 */
const fling = (pan: Pan, speed: Point): (() => void) => {
  const view = pan.scroller.ownerDocument.defaultView;
  if (view === null) return (): void => undefined;
  let current = { x: pan.axes.x ? speed.x : 0, y: pan.axes.y ? speed.y : 0 };
  let last = view.performance.now();
  let frame = 0;
  const step = (now: number): void => {
    const ms = now - last;
    last = now;
    pan.scroller.scrollBy({ left: -current.x * ms, top: -current.y * ms, behavior: "instant" });
    current = { x: flungSpeed(current.x, ms), y: flungSpeed(current.y, ms) };
    if (current.x !== 0 || current.y !== 0) frame = view.requestAnimationFrame(step);
  };
  frame = view.requestAnimationFrame(step);
  return (): void => view.cancelAnimationFrame(frame);
};

/**
 * Where a snapping container's items start along an axis, in its scroll coordinates: its children that snap.
 *
 * @param scroller - the container.
 * @param axis - the axis.
 */
const snapPoints = (scroller: HTMLElement, axis: "x" | "y"): number[] => {
  const box = scroller.getBoundingClientRect();
  return [...scroller.children]
    .filter((child) => getComputedStyle(child).scrollSnapAlign !== "none")
    .map((child) => {
      const childBox = child.getBoundingClientRect();
      return axis === "x"
        ? childBox.left - box.left + scroller.scrollLeft
        : childBox.top - box.top + scroller.scrollTop;
    });
};

/**
 * A drag's scroll ends as the finger lifts: a container that snaps snaps again, to the item nearest where the finger
 * aimed (its place now plus its last speed, at most half the container ahead, so a flick goes to the next item and
 * never past it), with the browser's smooth scroll; any other flings on. The returned function stops a fling (a new
 * touch does).
 *
 * @param pan - the scroll.
 * @param speed - the finger's last speed, in CSS px per ms, per axis.
 */
export const endPan = (pan: Pan, speed: Point): (() => void) => {
  if (pan.pausedSnap === undefined || !(pan.scroller instanceof HTMLElement)) return fling(pan, speed);
  const scroller = pan.scroller;
  const axis = pan.axes.x ? "x" : "y";
  const room = axis === "x" ? scroller.clientWidth : scroller.clientHeight;
  const now = axis === "x" ? scroller.scrollLeft : scroller.scrollTop;
  const aim =
    now + Math.max(-room / 2, Math.min(room / 2, -(axis === "x" ? speed.x : speed.y) * SNAP_AIM_MS));
  const target = snapPoints(scroller, axis).reduce(
    (best, point) => (Math.abs(point - aim) < Math.abs(best - aim) ? point : best),
    aim
  );
  // snapping comes back only now: back on, it would snap the place the finger left before the target is read
  scroller.style.scrollSnapType = pan.pausedSnap;
  scroller.scrollTo({ [axis === "x" ? "left" : "top"]: target, behavior: "smooth" });
  return (): void => undefined;
};
