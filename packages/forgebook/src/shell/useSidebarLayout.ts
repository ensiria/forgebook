/**
 * The sidebar's width and whether it is shown: on a wide window, this browser's convenience, kept for the next visit, not
 * the address's; on a narrow one, a moment's look over the page, which leaves what was kept alone.
 *
 * @remarks
 * Beside the page, a sidebar on a phone's window leaves the page about 110 px. There it slides over the page instead
 * (`useSidebarOverlay.ts`), starts closed, and belongs to the visit it was opened on. A choice kept from a wide window
 * would otherwise cover the page at every load, and opening it on a phone would change what the wide window shows next.
 *
 * @module
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { boundedSidebarWidth, SIDEBAR_WIDTH } from "./SidebarHandle.tsx";
import { useStored } from "./useStored.ts";

/** The narrowest window with room for the sidebar beside the page and for the search's list beside it, in CSS px. */
export const SIDE_BY_SIDE_WIDTH = 720;

/** The media query of a window too narrow for the sidebar beside the page. */
const NARROW_WINDOW = `(max-width: ${SIDE_BY_SIDE_WIDTH - 1}px)`;

/** The sidebar's layout and its setters. */
export type SidebarLayout = {
  /** Its width, in CSS px. */
  readonly width: number;
  /** Sets its width. */
  readonly setWidth: (width: number) => void;
  /** Whether it is shown. */
  readonly isOpen: boolean;
  /** Shows or hides it: kept for the next visit on a wide window, only for this visit of the page on a narrow one. */
  readonly setIsOpen: (isOpen: boolean) => void;
  /** Whether the window is narrow, so that the sidebar, when shown, lies over the page and not beside it. */
  readonly isOverlay: boolean;
};

/** The width a stored text holds, or the default. */
const storedWidth = (stored: string | null): number => {
  const width = Number(stored);
  return stored === null || !Number.isFinite(width) ? SIDEBAR_WIDTH.initial : boundedSidebarWidth(width);
};

/** Listens to the window crossing the narrow width. */
const subscribeToNarrow = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(NARROW_WINDOW);
  query.addEventListener("change", onChange);
  return (): void => query.removeEventListener("change", onChange);
};

/** Whether the window is narrow now. */
const isNarrowNow = (): boolean => window.matchMedia(NARROW_WINDOW).matches;

/**
 * The sidebar's layout.
 *
 * @param visit - the page's visit, new whenever a page is opened or the history moves, the shown page opened again
 *   included: whatever changes the page under a sidebar lying over it closes the sidebar, in the same render, so that
 *   the new page is never drawn out of reach.
 */
export const useSidebarLayout = (visit: object): SidebarLayout => {
  const [width, setWidth] = useStored("sidebar-width", storedWidth, String);
  const [isKeptOpen, setIsKeptOpen] = useStored(
    "sidebar",
    (stored: string | null): boolean => stored !== "hidden",
    (shown: boolean): string => (shown ? "shown" : "hidden")
  );
  const isOverlay = useSyncExternalStore(subscribeToNarrow, isNarrowNow, () => false);
  const [overlayVisit, setOverlayVisit] = useState<object | undefined>(undefined);
  // it does not come back open when the window turns narrow again
  useEffect(() => {
    if (!isOverlay) setOverlayVisit(undefined);
  }, [isOverlay]);
  const setIsOpen = useCallback(
    (isOpen: boolean): void => {
      if (isOverlay) setOverlayVisit(isOpen ? visit : undefined);
      else setIsKeptOpen(isOpen);
    },
    [isOverlay, visit, setIsKeptOpen]
  );
  return { width, setWidth, isOpen: isOverlay ? overlayVisit === visit : isKeptOpen, setIsOpen, isOverlay };
};
