/**
 * The events a simulated finger sends a story: pointer events of the `touch` type, touch events with their `Touch`
 * objects where the browser lets a page build them (Chromium), and the mouse events a tap adds for old code.
 *
 * @remarks
 * A page cannot make trusted events, so these are dispatched ones: the story's handlers see a finger, the browser's
 * own reactions (scrolling, focus) do not follow them. A touch pointer is captured by the element it went down on,
 * as the browser does; a story that captures it elsewhere moves it there (`touchLayer.ts` patches the capture calls
 * for the simulated pointers' ids).
 *
 * @module
 */
import type { Point } from "./touchGesture.ts";

/** A simulated finger. */
export type Finger = {
  /** Its pointer id, and its touch's identifier. */
  readonly id: number;
  /** Whether it is the first finger down. */
  readonly isPrimary: boolean;
  /** Where it is. */
  point: Point;
  /** The element it went down on: its touch events' target. */
  readonly startTarget: Element;
  /** The element that holds its pointer: where it went down, or where the story captured it. */
  captureTarget: Element;
};

/** A finger's contact size, in CSS px: about a fingertip's. */
const CONTACT_PX = 22;

/** The pointer events a finger sends, and whether each bubbles. */
const BUBBLES: Readonly<Record<string, boolean>> = {
  pointerover: true,
  pointerenter: false,
  pointerdown: true,
  pointermove: true,
  pointerup: true,
  pointercancel: true,
  pointerout: true,
  pointerleave: false,
  gotpointercapture: true,
  lostpointercapture: true
};

/**
 * Sends a finger's pointer event to the element that holds its pointer.
 *
 * @param type - the event (`pointerdown`, `pointermove`…).
 * @param finger - the finger.
 * @param isDown - whether it touches the screen after this event.
 * @returns whether no handler cancelled it.
 */
export const sendPointer = (type: string, finger: Finger, isDown: boolean): boolean => {
  const view = finger.captureTarget.ownerDocument.defaultView;
  return finger.captureTarget.dispatchEvent(
    new PointerEvent(type, {
      bubbles: BUBBLES[type] ?? true,
      cancelable: type !== "pointerenter" && type !== "pointerleave" && type !== "lostpointercapture",
      composed: true,
      view,
      pointerId: finger.id,
      pointerType: "touch",
      isPrimary: finger.isPrimary,
      clientX: finger.point.x,
      clientY: finger.point.y,
      screenX: finger.point.x,
      screenY: finger.point.y,
      width: CONTACT_PX,
      height: CONTACT_PX,
      pressure: isDown ? 0.5 : 0,
      button: type === "pointerdown" || type === "pointerup" ? 0 : -1,
      buttons: isDown ? 1 : 0
    })
  );
};

/** Whether the browser lets a page build touch events (Chromium does; Safari and Firefox on a computer do not). */
export const canBuildTouches = (): boolean => {
  if (typeof Touch !== "function" || typeof TouchEvent !== "function") return false;
  try {
    new Touch({ identifier: 0, target: document.documentElement });
    return true;
  } catch {
    return false;
  }
};

/**
 * A finger as a `Touch`.
 *
 * @param finger - the finger.
 */
const touchOf = (finger: Finger): Touch => {
  const view = finger.startTarget.ownerDocument.defaultView;
  return new Touch({
    identifier: finger.id,
    target: finger.startTarget,
    clientX: finger.point.x,
    clientY: finger.point.y,
    pageX: finger.point.x + (view?.scrollX ?? 0),
    pageY: finger.point.y + (view?.scrollY ?? 0),
    screenX: finger.point.x,
    screenY: finger.point.y,
    radiusX: CONTACT_PX / 2,
    radiusY: CONTACT_PX / 2,
    force: 0.5
  });
};

/**
 * Sends a touch event for the fingers that changed, to the element the first of them went down on; nothing where the
 * browser cannot build one.
 *
 * @param type - the event (`touchstart`, `touchmove`, `touchend`, `touchcancel`).
 * @param down - every finger on the screen after this event.
 * @param changed - the fingers this event is about.
 * @param isCancelable - whether a handler may cancel it (a move once the page scrolls may not).
 * @returns whether no handler cancelled it; `true` where no event was sent.
 */
export const sendTouch = (
  type: string,
  down: readonly Finger[],
  changed: readonly Finger[],
  isCancelable: boolean
): boolean => {
  const [first] = changed;
  if (first === undefined || !canBuildTouches()) return true;
  const target = first.startTarget;
  return target.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      cancelable: isCancelable,
      composed: true,
      view: target.ownerDocument.defaultView,
      touches: down.map(touchOf),
      targetTouches: down.filter((finger) => finger.startTarget === target).map(touchOf),
      changedTouches: changed.map(touchOf)
    })
  );
};

/**
 * Sends a mouse event at a finger's point, to the element under it: a tap's compatibility events (`mousedown`,
 * `mouseup`) and a long press's `contextmenu`.
 *
 * @param type - the event.
 * @param finger - the finger.
 * @returns whether no handler cancelled it.
 */
export const sendMouse = (type: string, finger: Finger): boolean => {
  const document = finger.startTarget.ownerDocument;
  const target = document.elementFromPoint(finger.point.x, finger.point.y) ?? finger.startTarget;
  return target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: document.defaultView,
      clientX: finger.point.x,
      clientY: finger.point.y,
      screenX: finger.point.x,
      screenY: finger.point.y,
      button: type === "contextmenu" ? 2 : 0,
      buttons: type === "mousedown" ? 1 : 0
    })
  );
};

/**
 * Sends a tap's click, of the `touch` type, to the element the real click went to: the element still reacts as to a
 * click (a checkbox toggles, a link opens), and a handler that reads `pointerType` sees a finger.
 *
 * @param target - the real click's target.
 * @param finger - the finger that tapped.
 */
export const sendClick = (target: EventTarget, finger: Finger): void => {
  target.dispatchEvent(
    new PointerEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: finger.startTarget.ownerDocument.defaultView,
      detail: 1,
      pointerId: finger.id,
      pointerType: "touch",
      isPrimary: true,
      clientX: finger.point.x,
      clientY: finger.point.y,
      screenX: finger.point.x,
      screenY: finger.point.y,
      width: CONTACT_PX,
      height: CONTACT_PX
    })
  );
};
