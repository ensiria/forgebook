/**
 * What a sidebar lying over the page does beyond its look: Escape closes it, the focus moves into it as it opens and back
 * to the button that shows it as it closes. The page behind is made inert by the shell, and a tap on the shade closes it.
 *
 * @module
 */
import { type RefObject, useEffect, useRef } from "react";

/** What the shell reads, and wires to the sidebar and its buttons. */
export type SidebarOverlay = {
  /** Whether the sidebar lies over the page now: shown, on a narrow window. */
  readonly isOver: boolean;
  /** The sidebar. */
  readonly sidebarRef: RefObject<HTMLElement | null>;
  /** The sidebar's button that hides it: where the focus goes as it opens. */
  readonly hideButtonRef: RefObject<HTMLButtonElement | null>;
  /** The toolbar's button that shows it: where the focus goes back as it closes. */
  readonly showButtonRef: RefObject<HTMLButtonElement | null>;
};

/** What the wiring needs to know of the sidebar. */
export type SidebarOverlayState = {
  /** Whether the window is narrow, so that a shown sidebar lies over the page. */
  readonly isOverlay: boolean;
  /** Whether it is shown. */
  readonly isOpen: boolean;
  /** Closes it. */
  readonly onClose: () => void;
};

/**
 * Wires a sidebar lying over the page; nothing on a wide window, where the sidebar sits beside it.
 *
 * @param state - the sidebar's state.
 * @returns whether it lies over the page, and the references to give the sidebar and its buttons.
 */
export const useSidebarOverlay = ({ isOverlay, isOpen, onClose }: SidebarOverlayState): SidebarOverlay => {
  const sidebarRef = useRef<HTMLElement>(null);
  const hideButtonRef = useRef<HTMLButtonElement>(null);
  const showButtonRef = useRef<HTMLButtonElement>(null);
  const isOver = isOverlay && isOpen;

  useEffect(() => {
    if (!isOver) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      // a key an input method is composing with, or one the search used to empty itself, is not for the sidebar; neither
      // is one that closes a menu open in the sidebar, which handles it itself
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
      const openMenu = sidebarRef.current?.querySelector(".forgebook-popover");
      if (openMenu === null || openMenu === undefined) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return (): void => document.removeEventListener("keydown", closeOnEscape);
  }, [isOver, onClose]);

  const wasOver = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: also looked at when the window crosses the width, and never when a wide window's sidebar is hidden, which leaves the focus alone
  useEffect(() => {
    const focused = document.activeElement;
    const isFocusInSidebar = sidebarRef.current?.contains(focused) === true;
    // the platform's search key has already put the focus on the search field
    if (isOver && !isFocusInSidebar) hideButtonRef.current?.focus({ preventScroll: true });
    // the sidebar went away with the focus in it, closed or by the window crossing the width; one still shown keeps the
    // focus, and a search's result that has already taken it to what it found keeps it too
    const isFocusLost =
      isFocusInSidebar || (wasOver.current && (focused === document.body || focused === null));
    if (!isOver && sidebarRef.current?.inert === true && isFocusLost) {
      showButtonRef.current?.focus({ preventScroll: true });
    }
    wasOver.current = isOver;
  }, [isOver, isOverlay]);

  return { isOver, sidebarRef, hideButtonRef, showButtonRef };
};
