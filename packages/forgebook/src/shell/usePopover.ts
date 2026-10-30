/**
 * A button's popover: open and closed, closed by a press outside or Escape (the focus going back to the button), with
 * the focus on its chosen option when it opens. The View and Compare menus use it.
 *
 * @module
 */
import { type RefObject, useEffect, useId, useRef, useState } from "react";

/** What a menu wires to its button and panel. */
export type Popover = {
  /** Whether the panel is shown. */
  readonly isOpen: boolean;
  /** Opens or closes the panel. */
  readonly setIsOpen: (isOpen: boolean) => void;
  /** The button. */
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  /** The panel. */
  readonly panelRef: RefObject<HTMLDivElement | null>;
  /** The panel's id, for the button's `aria-controls`. */
  readonly panelId: string;
};

/** A button's popover. */
export const usePopover = (): Popover => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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
      if (isEscape) buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return (): void => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, buttonRef, panelRef, panelId };
};
