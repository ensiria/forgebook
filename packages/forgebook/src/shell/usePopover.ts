/**
 * A button's popover: open and closed, closed by a press outside or Escape (the focus going back to the button), with
 * the focus on its chosen option when it opens. The View and Compare menus use it.
 *
 * @remarks
 * The panel grows in from its button's corner and shrinks back into it when it closes, whatever closes it: it stays
 * drawn until its closing has played. A reduced-motion preference opens and closes it at once.
 *
 * @module
 */
import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** What a menu wires to its button and panel. */
export type Popover = {
  /** Whether the panel is open: what its button's state and a press on it read. */
  readonly isOpen: boolean;
  /** Whether the panel is drawn: open, or still closing. */
  readonly isDrawn: boolean;
  /**
   * Opens or closes the panel.
   *
   * @param isOpen - whether it opens.
   * @param press - the press that asked, when one did: opened by the pointer (`detail` above 0), Escape gives the
   *   focus back to the button without its ring.
   */
  readonly setIsOpen: (isOpen: boolean, press?: { readonly detail: number }) => void;
  /** The button. */
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  /** The panel. */
  readonly panelRef: RefObject<HTMLDivElement | null>;
  /** The panel's id, for the button's `aria-controls`. */
  readonly panelId: string;
};

/** How long the panel takes to open, in ms: the shell's `$duration-quick`. */
const OPEN_MS = 150;

/** How long it takes to close, in ms: shorter, as a thing going away. */
const CLOSE_MS = 110;

/** The panel's look when it is not open: faded, a little smaller and nearer its button. */
const CLOSED_FRAME: Keyframe = { opacity: 0, transform: "translateY(-0.25rem) scale(0.97)" };

/** Its look when open. */
const OPEN_FRAME: Keyframe = { opacity: 1, transform: "none" };

/** Whether the person asked for less motion. */
const isReduced = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A button's popover. */
export const usePopover = (): Popover => {
  const [isOpen, setOpen] = useState(false);
  const [isDrawn, setIsDrawn] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef<Animation | undefined>(undefined);
  const isByPointer = useRef(false);
  const panelId = useId();

  const setIsOpen = (isOpening: boolean, press?: { readonly detail: number }): void => {
    const panel = panelRef.current;
    if (isOpening) {
      isByPointer.current = (press?.detail ?? 0) > 0;
      // opened again while it closes: the closing stops and it grows in again
      closing.current?.cancel();
      closing.current = undefined;
      setOpen(true);
      setIsDrawn(true);
      return;
    }
    setOpen(false);
    if (panel === null || isReduced()) {
      setIsDrawn(false);
      return;
    }
    const animation = panel.animate([OPEN_FRAME, CLOSED_FRAME], {
      duration: CLOSE_MS,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards"
    });
    closing.current = animation;
    animation.finished
      .then(() => {
        if (closing.current !== animation) return;
        closing.current = undefined;
        setIsDrawn(false);
      })
      // a cancelled closing (opened again) leaves the panel open
      .catch(() => undefined);
  };

  // it grows in from its button's corner as it is drawn
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || panel === null || isReduced()) return;
    panel.animate([CLOSED_FRAME, OPEN_FRAME], {
      duration: OPEN_MS,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)"
    });
  }, [isOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setIsOpen reads only refs and the state's setter
  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const close = (event: PointerEvent | KeyboardEvent): void => {
      const target = event.target instanceof Node ? event.target : null;
      const isOutside =
        event instanceof PointerEvent &&
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target);
      const isEscape = event instanceof KeyboardEvent && event.key === "Escape";
      if (!isOutside && !isEscape) return;
      setIsOpen(false);
      // the focus goes back where it came from, its ring lit only for the keyboard that opened the panel
      if (isEscape) buttonRef.current?.focus({ focusVisible: !isByPointer.current });
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return (): void => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [isOpen]);

  return { isOpen, isDrawn, setIsOpen, buttonRef, panelRef, panelId };
};
