/**
 * A part that folds open and shut animated (a sidebar family's components): its height grows from nothing to its
 * content's and back, and it stays drawn until its closing has played.
 *
 * @remarks
 * A fold changed again while it moves starts from the height it has then, so a quick open and close never jumps. A
 * fold that must not move (a search opening every family it finds something in, a reduced-motion preference) opens
 * and shuts at once.
 *
 * @module
 */
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/** How long a fold takes to open, in ms. */
const OPEN_MS = 200;

/** How long it takes to shut, in ms: shorter, as a thing going away. */
const SHUT_MS = 160;

/** What a folding part wires to its element. */
export type Fold = {
  /** Whether its content is drawn: open, or still shutting. */
  readonly isDrawn: boolean;
  /** The element whose height moves. */
  readonly ref: RefObject<HTMLDivElement | null>;
};

/**
 * The height a fold starts its move from: the height a running move left it at, else shut or its content's.
 *
 * @param element - the folding element.
 * @param isMoving - whether a move is running.
 * @param isOpening - whether it opens.
 */
const startHeight = (element: HTMLElement, isMoving: boolean, isOpening: boolean): number => {
  if (isMoving) return element.offsetHeight;
  return isOpening ? 0 : element.scrollHeight;
};

/**
 * Moves a fold's height to open or shut, clipped while it moves so its items' focus rings show the rest of the time.
 *
 * @param element - the folding element.
 * @param from - the height it starts from, in CSS px.
 * @param isOpening - whether it opens.
 */
const moveFold = (element: HTMLElement, from: number, isOpening: boolean): Animation => {
  element.style.overflow = "hidden";
  return element.animate(
    [{ height: `${from}px` }, { height: `${isOpening ? element.scrollHeight : 0}px` }],
    isOpening
      ? { duration: OPEN_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      : { duration: SHUT_MS, easing: "cubic-bezier(0.4, 0, 1, 1)" }
  );
};

/**
 * A part that folds open and shut.
 *
 * @param isOpen - whether it is open.
 * @param isInstant - whether it opens and shuts at once this time.
 */
export const useFold = (isOpen: boolean, isInstant: boolean): Fold => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDrawn, setIsDrawn] = useState(isOpen);
  const running = useRef<Animation | undefined>(undefined);
  const isFirst = useRef(true);
  // an opening part is drawn at once, so its content can be measured as it grows
  if (isOpen && !isDrawn) setIsDrawn(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: it moves when it opens or shuts, not when told how
  useLayoutEffect(() => {
    const element = ref.current;
    if (isFirst.current || element === null) {
      isFirst.current = false;
      return;
    }
    const from = startHeight(element, running.current !== undefined, isOpen);
    running.current?.cancel();
    running.current = undefined;
    if (isInstant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // a move cancelled here never finishes: the clip it set comes off now, or focus rings inside stay cut
      element.style.overflow = "";
      if (!isOpen) setIsDrawn(false);
      return;
    }
    const animation = moveFold(element, from, isOpen);
    running.current = animation;
    animation.finished
      .then(() => {
        if (running.current !== animation) return;
        running.current = undefined;
        element.style.overflow = "";
        if (!isOpen) setIsDrawn(false);
      })
      // a move cancelled by the next one leaves the rest to it
      .catch(() => undefined);
  }, [isOpen]);

  return { isDrawn, ref };
};
