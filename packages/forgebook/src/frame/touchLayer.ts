/**
 * The frame's simulated touch, on while the root has `data-forgebook-touch` (the Touch switch): the real mouse's
 * events are caught before the story and sent again as a finger, or as two with Shift held.
 *
 * @remarks
 * A press sends `pointerdown` (touch) and `touchstart`; a move sends `touchmove`, and `pointermove` until a drag
 * starts scrolling, when the pointer is cancelled as the browser cancels it (`touchScroll.ts`); a lift sends
 * `pointerup` and `touchend`. A tap then sends the mouse's compatibility events and its own click of the `touch` type
 * in place of the real one, so a button, a link or a checkbox reacts as it would; a press held half a second sends `contextmenu`. A moving mouse with
 * no button down sends nothing: a finger does not hover. Shift fixes a centre beside the mouse (the second finger shows 80 px to its left); a press then puts a
 * second finger mirrored around it, so dragging pinches and rotates. The real cursor is hidden and the fingers are
 * dots (`touchDots.ts`). While it is on, `navigator.maxTouchPoints` and `ontouchstart` say touch, and capturing a
 * simulated pointer works. A simulation: the events are not trusted, so the browser's own scrolling, focus from a
 * touch, a virtual keyboard and real Safari stay a device's (or `forgebook dev --touch`'s).
 *
 * @module
 */
import { isRealTouchWindow } from "../realTouch.ts";
import { type TouchDots, touchDots } from "./touchDots.ts";
import { type Finger, sendClick, sendMouse, sendPointer, sendTouch } from "./touchEvents.ts";
import { dragAxis, isDragging, LONG_PRESS_MS, mirroredFinger, type Point } from "./touchGesture.ts";
import { endPan, type Pan, panBy, panOf } from "./touchScroll.ts";

/** The root's attribute that turns the simulation on. */
const TOUCH_ATTRIBUTE = "data-forgebook-touch";

/** The simulated pointers' ids: apart from the real mouse's, so the browser never confuses them. */
const FINGER_IDS = [100, 101] as const;

/** How far apart two fingers start, in CSS px: Shift fixes the centre half of it to the left of the mouse. */
const START_SPREAD_PX = 80;

/** A finger held still longer than this before it lifts, in ms, lifts without a fling. */
const STILL_MS = 80;

/** The real events that never reach the story while touch is simulated (the hover a finger does not have). */
const SWALLOWED = ["mousedown", "mouseup", "mousemove", "mouseover", "mouseout", "mouseenter", "mouseleave"];

/** The real pointer events that never reach the story: the fingers send their own. */
const SWALLOWED_POINTER = ["pointerover", "pointerout", "pointerenter", "pointerleave"];

/** What a press under way holds. */
type Press = {
  /** The fingers down. */
  readonly fingers: Finger[];
  /** Where the first finger went down. */
  readonly start: Point;
  /** The two-finger gesture's centre; none for one finger. */
  readonly center: Point | undefined;
  /** Whether the first finger moved past a tap. */
  isDrag: boolean;
  /** Whether the press lasted long enough to be a long one. */
  isLongPress: boolean;
  /** Whether a handler cancelled `pointerdown` (no compatibility mouse events then). */
  isDownCancelled: boolean;
  /** Whether a handler cancelled a touch event (no click then, no scroll for a move). */
  isTouchCancelled: boolean;
  /** The scroll the drag drives, once it scrolls. */
  pan: Pan | undefined;
  /** The finger's last place and time, for the fling's speed. */
  last: { readonly point: Point; readonly time: number };
  /** Its speed, in CSS px per ms. */
  speed: Point;
  /** The long press's timer. */
  timer: number | undefined;
};

/** The simulation's state while it is on. */
type LayerState = {
  readonly document: Document;
  readonly dots: TouchDots;
  /** Where the mouse is. */
  mouse: Point | undefined;
  /** Where Shift fixed the two-finger centre; none without Shift. */
  center: Point | undefined;
  /** The press under way. */
  press: Press | undefined;
  /** The finger of a tap whose click is to come: the real click is then sent again as its; none otherwise. */
  tapper: Finger | undefined;
  /** The timer of a tap's click about to be sent; none when none is. */
  clickTimer: number | undefined;
  /** Stops a fling under way. */
  stopFling: () => void;
};

/**
 * The two-finger centre Shift fixes when it goes down with the mouse at a point: half the fingers' spread to its left,
 * so the second finger shows at once beside the first, and moves mirrored from then on.
 *
 * @param point - where the mouse is.
 */
const shiftCenter = (point: Point): Point => ({ x: point.x - START_SPREAD_PX / 2, y: point.y });

/**
 * The fingers' dots: the fingers of a press, or the mouse (and the second finger to come, with Shift) between presses.
 *
 * @param state - the simulation's state.
 */
const drawDots = (state: LayerState): void => {
  const { press, mouse, center } = state;
  if (press !== undefined) {
    state.dots.draw(press.fingers.map((finger) => ({ point: finger.point, isPressed: true })));
    return;
  }
  if (mouse === undefined) {
    state.dots.draw([]);
    return;
  }
  // the second finger where a press will put it: mirrored around Shift's centre
  const second = center === undefined ? [] : [{ point: mirroredFinger(center, mouse), isPressed: false }];
  state.dots.draw([{ point: mouse, isPressed: false }, ...second]);
};

/**
 * The second finger going down at a point.
 *
 * @param document - the frame's document.
 * @param id - its id.
 * @param point - where.
 * @param fallback - the element when none is under the point.
 */
const fingerAt = (document: Document, id: number, point: Point, fallback: Element): Finger => {
  const target = document.elementFromPoint(point.x, point.y) ?? fallback;
  return { id, isPrimary: false, point, startTarget: target, captureTarget: target };
};

/**
 * A press begins: its fingers go down, each sending its pointer and touch events.
 *
 * @param state - the simulation's state.
 * @param event - the real pointer's press.
 */
const pressDown = (state: LayerState, event: PointerEvent): void => {
  state.stopFling();
  const point = { x: event.clientX, y: event.clientY };
  const target = event.target instanceof Element ? event.target : state.document.documentElement;
  const center = event.shiftKey ? (state.center ?? shiftCenter(point)) : undefined;
  // the first finger goes down where the real press did, on the element the browser found under it
  const fingers: Finger[] = [
    { id: FINGER_IDS[0], isPrimary: true, point, startTarget: target, captureTarget: target }
  ];
  if (center !== undefined)
    fingers.push(fingerAt(state.document, FINGER_IDS[1], mirroredFinger(center, point), target));
  // the press is the layer's before its first event: a story that captures the pointer in its pointerdown finds it
  const press: Press = {
    fingers,
    start: point,
    center,
    isDrag: false,
    isLongPress: false,
    isDownCancelled: false,
    isTouchCancelled: false,
    pan: undefined,
    last: { point, time: event.timeStamp },
    speed: { x: 0, y: 0 },
    timer: undefined
  };
  state.press = press;
  for (const finger of fingers) {
    sendPointer("pointerover", finger, true);
    sendPointer("pointerenter", finger, true);
    if (!sendPointer("pointerdown", finger, true)) press.isDownCancelled = true;
  }
  press.isTouchCancelled = !sendTouch("touchstart", fingers, fingers, true);
  // a long press opens the story's menu, as on a phone
  press.timer = window.setTimeout((): void => {
    if (press.isDrag || press.fingers.length > 1 || state.press !== press) return;
    press.isLongPress = true;
    const [first] = press.fingers;
    if (first !== undefined) sendMouse("contextmenu", first);
  }, LONG_PRESS_MS);
  drawDots(state);
};

/**
 * Starts the drag of a press, the first time its finger passes a tap's reach: a single finger whose move no handler
 * cancelled scrolls what it can (the pointer is then cancelled, as the browser cancels it).
 *
 * @param press - the press.
 * @param isMoveCancelled - whether a handler cancelled this `touchmove`.
 */
const startDrag = (press: Press, isMoveCancelled: boolean): void => {
  press.isDrag = true;
  window.clearTimeout(press.timer);
  const [first] = press.fingers;
  if (isMoveCancelled || press.isTouchCancelled || press.fingers.length > 1 || first === undefined) return;
  press.pan = panOf(first.startTarget, dragAxis(press.start, first.point));
  if (press.pan !== undefined) sendPointer("pointercancel", first, false);
};

/**
 * The fingers follow the mouse: touch events always, pointer events until the drag scrolls, the scroll otherwise.
 *
 * @param state - the simulation's state.
 * @param press - the press.
 * @param event - the real pointer's move.
 */
const pressMove = (state: LayerState, press: Press, event: PointerEvent): void => {
  const point = { x: event.clientX, y: event.clientY };
  // the mouse goes with the finger: after the lift, its dot stays where the finger left the screen
  state.mouse = point;
  const [first, second] = press.fingers;
  if (first === undefined) return;
  const from = first.point;
  first.point = point;
  if (second !== undefined && press.center !== undefined) second.point = mirroredFinger(press.center, point);
  const isMoveCancelled = !sendTouch("touchmove", press.fingers, press.fingers, press.pan === undefined);
  if (!press.isDrag && isDragging(press.start, point)) startDrag(press, isMoveCancelled);
  const ms = Math.max(1, event.timeStamp - press.last.time);
  press.speed = { x: (point.x - press.last.point.x) / ms, y: (point.y - press.last.point.y) / ms };
  press.last = { point, time: event.timeStamp };
  if (press.pan !== undefined) panBy(press.pan, from, point);
  else for (const finger of press.fingers) sendPointer("pointermove", finger, true);
  drawDots(state);
};

/**
 * A press ends: the fingers lift, a scroll flings on, a tap sends the mouse's compatibility events and readies its
 * click.
 *
 * @param state - the simulation's state.
 * @param press - the press.
 * @param isCancel - whether the browser cancelled the real pointer, or the layer stops mid-press.
 * @param time - when, as the events' `timeStamp`.
 */
const pressUp = (state: LayerState, press: Press, isCancel: boolean, time: number): void => {
  window.clearTimeout(press.timer);
  // a finger that stopped before it lifted throws nothing
  if (time - press.last.time > STILL_MS) press.speed = { x: 0, y: 0 };
  if (press.pan === undefined) {
    // the press is still the layer's while its pointer ends: a story's pointerup may release its capture
    for (const finger of press.fingers) {
      sendPointer(isCancel ? "pointercancel" : "pointerup", finger, false);
      // a touch pointer is captured from its press on (by its target, or where the story moved it), and lost here
      sendPointer("lostpointercapture", finger, false);
      sendPointer("pointerout", finger, false);
      sendPointer("pointerleave", finger, false);
    }
  }
  state.press = undefined;
  const isEndCancelled = !sendTouch(
    isCancel ? "touchcancel" : "touchend",
    [],
    press.fingers,
    press.pan === undefined
  );
  if (press.pan !== undefined) state.stopFling = endPan(press.pan, press.speed);
  const [first] = press.fingers;
  const isTap = !isCancel && !press.isDrag && !press.isLongPress && press.fingers.length === 1;
  const isClicking = isTap && !press.isTouchCancelled && !isEndCancelled;
  state.tapper = isClicking ? first : undefined;
  if (isClicking && !press.isDownCancelled && first !== undefined) {
    sendMouse("mousedown", first);
    sendMouse("mouseup", first);
  }
  drawDots(state);
};

/**
 * A real event the layer handles apart from the pointer's, before the story: the mouse's click (a tap's is sent again as
 * a finger's, a drag's or a long press's is none), a text selection or an image dragged by the finger, the right
 * button's menu. A click from the keyboard (Enter or Space on a button, Enter in a form) and the keyboard's menu key
 * reach the story as they are: a finger changes nothing of the keyboard.
 *
 * @param state - the simulation's state.
 * @param event - the real event.
 * @returns whether the event was one of them, handled here.
 */
const handledApart = (state: LayerState, event: Event): boolean => {
  const isMouseEvent = event instanceof MouseEvent;
  if (event.type === "click") {
    // a click the keyboard made has no press behind it (`detail` 0) and no tap waiting for it
    if (state.tapper === undefined && isMouseEvent && event.detail === 0) return true;
    event.preventDefault();
    event.stopImmediatePropagation();
    const finger = state.tapper;
    state.tapper = undefined;
    // after the real click's dispatch: cancelling it undoes a checkbox's toggle at its end, a click sent inside it too
    const { target } = event;
    if (finger !== undefined && target !== null)
      state.clickTimer = window.setTimeout((): void => {
        state.clickTimer = undefined;
        sendClick(target, finger);
      }, 0);
    return true;
  }
  if (event.type === "contextmenu" && !(isMouseEvent && event.button === 2)) return true;
  if (event.type !== "selectstart" && event.type !== "dragstart" && event.type !== "contextmenu")
    return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
};

/**
 * The mouse moves: a press under way follows it (or lifts, when its button came up out of sight), the dots follow it
 * between presses, and Shift held fixes the two-finger centre.
 *
 * @param state - the simulation's state.
 * @param event - the real pointer's move.
 */
const pointerMove = (state: LayerState, event: PointerEvent): void => {
  const { press } = state;
  if (press !== undefined && (event.buttons & 1) === 0) {
    // the button came up where the frame could not see it (outside the window): the finger lifts here
    state.mouse = { x: event.clientX, y: event.clientY };
    pressUp(state, press, false, event.timeStamp);
  } else if (press !== undefined) pressMove(state, press, event);
  else {
    // Shift read from the pointer, which carries it even when the frame has no focus (the shell usually does): held,
    // it fixes the two-finger centre beside the mouse
    if (!event.shiftKey) state.center = undefined;
    else state.center ??= shiftCenter(state.mouse ?? { x: event.clientX, y: event.clientY });
    state.mouse = { x: event.clientX, y: event.clientY };
    drawDots(state);
  }
};

/**
 * What the simulation does with one real pointer event: the press, the move and the lift of the fingers, the dots
 * between presses.
 *
 * @param state - the simulation's state.
 * @param event - the real pointer event.
 */
const pointerInput = (state: LayerState, event: PointerEvent): void => {
  const { press } = state;
  if (event.type === "pointermove") pointerMove(state, event);
  else if (event.type === "pointerout" && event.relatedTarget === null && press === undefined) {
    state.mouse = undefined;
    drawDots(state);
  } else if (event.type === "pointerdown" && event.button === 0 && press === undefined)
    pressDown(state, event);
  else if ((event.type === "pointerup" || event.type === "pointercancel") && press !== undefined) {
    state.mouse = { x: event.clientX, y: event.clientY };
    pressUp(state, press, event.type === "pointercancel", event.timeStamp);
  }
};

/**
 * What the simulation does with one real event, before the story sees it: the story never sees a real one.
 *
 * @param state - the simulation's state.
 * @param event - the real event (the story's own dispatched events are left alone).
 */
const intercept = (state: LayerState, event: Event): void => {
  if (!event.isTrusted || handledApart(state, event)) return;
  event.stopImmediatePropagation();
  if (event instanceof PointerEvent) pointerInput(state, event);
};

/**
 * Makes the frame say it is a touch device, and lets the story capture a simulated pointer.
 *
 * @param state - the simulation's state.
 * @returns what puts the frame back as it was.
 */
const pretendTouch = (state: LayerState): (() => void) => {
  const view = state.document.defaultView;
  if (view === null) return (): void => undefined;
  Object.defineProperty(view.navigator, "maxTouchPoints", { configurable: true, get: (): number => 5 });
  Object.defineProperty(view, "ontouchstart", { configurable: true, writable: true, value: null });
  const proto = view.Element.prototype;
  const native = {
    set: proto.setPointerCapture,
    release: proto.releasePointerCapture,
    has: proto.hasPointerCapture
  };
  const fingerOf = (id: number): Finger | undefined =>
    state.press?.fingers.find((finger) => finger.id === id);
  // a simulated pointer's id never reaches the browser, which knows no such pointer: once its finger lifted, setting its
  // capture fails as the browser fails it, releasing it does nothing
  const isSimulated = (id: number): boolean => FINGER_IDS.some((each) => each === id);
  proto.setPointerCapture = function setPointerCapture(this: Element, id: number): void {
    const finger = fingerOf(id);
    if (finger === undefined && isSimulated(id))
      throw new DOMException("No active pointer with the given id is found.", "NotFoundError");
    if (finger === undefined) {
      native.set.call(this, id);
      return;
    }
    finger.captureTarget = this;
    sendPointer("gotpointercapture", finger, true);
  };
  proto.releasePointerCapture = function releasePointerCapture(this: Element, id: number): void {
    const finger = fingerOf(id);
    if (finger === undefined) {
      if (!isSimulated(id)) native.release.call(this, id);
      return;
    }
    sendPointer("lostpointercapture", finger, true);
    finger.captureTarget = finger.startTarget;
  };
  proto.hasPointerCapture = function hasPointerCapture(this: Element, id: number): boolean {
    const finger = fingerOf(id);
    if (finger === undefined) return isSimulated(id) ? false : native.has.call(this, id);
    return finger.captureTarget === this;
  };
  return (): void => {
    Reflect.deleteProperty(view.navigator, "maxTouchPoints");
    Reflect.deleteProperty(view, "ontouchstart");
    proto.setPointerCapture = native.set;
    proto.releasePointerCapture = native.release;
    proto.hasPointerCapture = native.has;
  };
};

/** The events the simulation catches, on the window, before the story. */
const CAUGHT: readonly string[] = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  ...SWALLOWED_POINTER,
  ...SWALLOWED,
  "click",
  "contextmenu",
  "selectstart",
  "dragstart"
];

/**
 * Starts the simulation in a frame.
 *
 * @param document - the frame's document.
 * @returns what stops it.
 */
const startTouch = (document: Document): (() => void) => {
  const state: LayerState = {
    document,
    dots: touchDots(document),
    mouse: undefined,
    center: undefined,
    press: undefined,
    tapper: undefined,
    clickTimer: undefined,
    stopFling: (): void => undefined
  };
  const restore = pretendTouch(state);
  const onEvent = (event: Event): void => intercept(state, event);
  // Shift fixes the two-finger centre where the mouse is, and shows where the second finger will be
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Shift" || state.press !== undefined) return;
    state.center =
      event.type === "keydown" && state.mouse !== undefined ? shiftCenter(state.mouse) : undefined;
    drawDots(state);
  };
  const view: Window | null = document.defaultView;
  for (const type of CAUGHT) view?.addEventListener(type, onEvent, { capture: true });
  view?.addEventListener("keydown", onKey);
  view?.addEventListener("keyup", onKey);
  return (): void => {
    // a press under way is cancelled, as the browser cancels a touch it takes over: its timers, its scroll's snapping
    // and a tap's click to come end with it
    if (state.press !== undefined) pressUp(state, state.press, true, performance.now());
    window.clearTimeout(state.clickTimer);
    state.tapper = undefined;
    for (const type of CAUGHT) view?.removeEventListener(type, onEvent, { capture: true });
    view?.removeEventListener("keydown", onKey);
    view?.removeEventListener("keyup", onKey);
    state.stopFling();
    restore();
    state.dots.remove();
  };
};

/**
 * Follows the root's touch attribute from now on: the simulation runs while it is set.
 *
 * @param document - the frame's document.
 */
export const followTouch = (document: Document): void => {
  let stop: (() => void) | undefined;
  // in Chromium's real touch window the pages see real touch: simulating it on top would send every touch twice
  const view = document.defaultView;
  if (view !== null && isRealTouchWindow(view)) return;
  const update = (): void => {
    const isOn = document.documentElement.hasAttribute(TOUCH_ATTRIBUTE);
    if (isOn && stop === undefined) stop = startTouch(document);
    else if (!isOn && stop !== undefined) {
      stop();
      stop = undefined;
    }
  };
  new MutationObserver(update).observe(document.documentElement, { attributeFilter: [TOUCH_ATTRIBUTE] });
  update();
};
