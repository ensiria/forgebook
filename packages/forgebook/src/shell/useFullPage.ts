/**
 * An example's box opened to fill the page, over it, without leaving it: the box grows from where it sits to the
 * page's size and shrinks back into its place, animated; Escape, a press on the shade or its button brings it back.
 *
 * @remarks
 * The box is never moved in the page: an iframe moved to another parent loads again, and the story would lose its
 * state. It is drawn fixed over the page instead, and a slot of its height keeps its place in the list, so nothing
 * under it moves. Its size and place are animated (not scaled), so the story lays itself out at each size as it would
 * in a window being resized. A reduced-motion preference opens and closes it at once. The address does not remember
 * it: it is a moment's look, not a page.
 *
 * @module
 */
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/** How long the box takes to fill the page, in ms: the shell's `$duration-medium`. */
const OPEN_MS = 260;

/** How long it takes to go back to its place, in ms. */
const CLOSE_MS = 200;

/** The page's easing for a thing that moves and settles: the shell's `$ease-slide`. */
const EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/** What an example wires to its box, its slot and its shade. */
export type FullPage = {
  /** Whether the box fills the page: what its button's state and a press on it read. */
  readonly isFull: boolean;
  /** Whether it is drawn over the page: filling it, or still going back to its place. */
  readonly isOver: boolean;
  /** The height the slot keeps in the list while the box is over the page, in CSS px. */
  readonly slotHeight: number;
  /** The box. */
  readonly boxRef: RefObject<HTMLDivElement | null>;
  /** The slot that keeps the box's place. */
  readonly slotRef: RefObject<HTMLDivElement | null>;
  /** The shade under the box. */
  readonly shadeRef: RefObject<HTMLDivElement | null>;
  /** The box's stage, whose room the story fills while the box is over the page. */
  readonly stageRef: RefObject<HTMLDivElement | null>;
  /** The stage's height while the box is over the page, in CSS px: the story is drawn at least this tall. */
  readonly stageHeight: number | undefined;
  /**
   * Opens the box to fill the page, or brings it back.
   *
   * @param press - the press that asked, when one did: a press by the pointer (`detail` above 0) leaves no focus ring
   *   on the button when Escape closes the box later.
   */
  readonly toggle: (press?: { readonly detail: number }) => void;
};

/** A rectangle as the keyframes of a fixed box write it. */
const frameOf = (rect: DOMRect): Keyframe => ({
  top: `${rect.top}px`,
  left: `${rect.left}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`
});

/** Whether the person asked for less motion. */
const isReduced = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** An example's box opened to fill the page. */
export const useFullPage = (): FullPage => {
  const [isFull, setIsFull] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [slotHeight, setSlotHeight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState<number | undefined>(undefined);
  // where the box was before it filled the page, for its growing in
  const from = useRef<DOMRect | undefined>(undefined);
  // the move back to its place, kept to its end so the box is never drawn full for a frame before it is put back
  const closing = useRef<Animation | undefined>(undefined);
  // opened by the pointer: Escape, a key, would otherwise light the focused button's ring as if the keyboard moved
  const isByPointer = useRef(false);

  const open = (): void => {
    const box = boxRef.current;
    if (box === null) return;
    closing.current?.cancel();
    closing.current = undefined;
    const rect = box.getBoundingClientRect();
    from.current = rect;
    setSlotHeight(rect.height);
    setIsFull(true);
    setIsOver(true);
  };

  const close = (): void => {
    const box = boxRef.current;
    const slot = slotRef.current;
    setIsFull(false);
    if (box === null || slot === null || isReduced()) {
      setIsOver(false);
      return;
    }
    const animation = box.animate(
      [frameOf(box.getBoundingClientRect()), frameOf(slot.getBoundingClientRect())],
      {
        duration: CLOSE_MS,
        easing: EASING,
        fill: "forwards"
      }
    );
    shadeRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, fill: "forwards" });
    closing.current = animation;
    animation.finished
      .then(() => {
        if (closing.current === animation) setIsOver(false);
      })
      // opened again while it went back: the opening takes over
      .catch(() => undefined);
  };

  // it grows from where it sat to the page's size as it is first drawn over the page
  useLayoutEffect(() => {
    const box = boxRef.current;
    const start = from.current;
    if (!isFull || box === null || start === undefined || isReduced()) return;
    box.animate([frameOf(start), frameOf(box.getBoundingClientRect())], {
      duration: OPEN_MS,
      easing: EASING
    });
    shadeRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS });
  }, [isFull]);

  // back in its place: the move that put it there is let go before the page is drawn
  useLayoutEffect(() => {
    if (isOver) return;
    closing.current?.cancel();
    closing.current = undefined;
  }, [isOver]);

  // the room the story has over the page, followed as the box grows, shrinks and the window changes
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!isOver || stage === null) {
      setStageHeight(undefined);
      return;
    }
    const measure = (): void => setStageHeight(stage.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return (): void => observer.disconnect();
  }, [isOver]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close reads only refs and the states' setters
  useEffect(() => {
    if (!isFull) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      close();
      const focused = document.activeElement;
      if (isByPointer.current && focused instanceof HTMLElement && boxRef.current?.contains(focused)) {
        focused.blur();
        focused.focus({ focusVisible: false });
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return (): void => document.removeEventListener("keydown", closeOnEscape);
  }, [isFull]);

  return {
    isFull,
    isOver,
    slotHeight,
    boxRef,
    slotRef,
    shadeRef,
    stageRef,
    stageHeight,
    toggle: (press?: { readonly detail: number }): void => {
      if (isFull) {
        close();
        return;
      }
      isByPointer.current = (press?.detail ?? 0) > 0;
      open();
    }
  };
};
