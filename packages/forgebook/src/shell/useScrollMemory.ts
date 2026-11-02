/**
 * Where a page's scrolling part stands when another page comes in: a page opened anew starts at its top, a page the
 * history brings back (back, forward) takes the position it was left at, as a browser does for its own pages.
 *
 * @remarks
 * The component page and the stage each keep one scrolling element from one page to the next (React reuses the node:
 * same component, same place), so without this its offset survives into a page it means nothing for. The shell
 * keeps the positions, by page, across both kinds of page. A position given back is set again whenever the content's
 * size changes while the page loads (its documentation, its frames), until the person scrolls themselves: what
 * arrives may leave it out of reach or move it; meanwhile the scrolling the browser does on its own (clamping,
 * anchoring) is not taken for the page's position.
 *
 * @module
 */
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

/**
 * A visit of a page: made anew whenever a page is opened or the history moves, never when only the view changes
 * (its args, its theme), so the person stays where they are then; the same page opened again is a new visit.
 */
export type PageVisit = {
  /** The page shown, whatever the view. */
  readonly pageKey: string;
  /** Whether the history brought the page back (back or forward), rather than a link or a picker opening it. */
  readonly isReturn: boolean;
};

/** What a page needs to know of its scroll position: its visit, and every page's last position. */
export type PageScroll = {
  /** The visit shown. */
  readonly visit: PageVisit;
  /** Each page's last position, by key: kept by the shell, so it outlives the page that wrote it. */
  readonly positions: Map<string, number>;
};

/** The input that means the person scrolls themselves: a position given back stops being chased. */
export const OWN_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Puts a page's scrolling element where the page should start, and keeps its position for when it comes back.
 *
 * @param ref - the scrolling element.
 * @param scroll - the visit and the shell's positions.
 */
export const useScrollMemory = (
  ref: RefObject<HTMLElement | null>,
  { visit, positions }: PageScroll
): void => {
  // read by the scroll listener, which lives as long as the element: the page shown now, and whether its position
  // is still being reached (until then the offset is the browser's clamping, not the page's position)
  const shownKey = useRef(visit.pageKey);
  const isReaching = useRef(false);

  useLayoutEffect(() => {
    const element = ref.current;
    shownKey.current = visit.pageKey;
    isReaching.current = false;
    if (element === null) return;
    const top = visit.isReturn ? (positions.get(visit.pageKey) ?? 0) : 0;
    element.scrollTop = top;
    if (top === 0) return;
    // the page still loads: what arrives may leave the position out of reach or, above it, move it (the browser's
    // scroll anchoring), so it is put back whenever the content's size changes, until the person scrolls
    isReaching.current = true;
    const stop = (): void => {
      isReaching.current = false;
      resizes.disconnect();
      for (const name of OWN_SCROLL_EVENTS) element.removeEventListener(name, stop);
    };
    const resizes = new ResizeObserver((): void => {
      element.scrollTop = top;
    });
    for (const child of element.children) resizes.observe(child);
    for (const name of OWN_SCROLL_EVENTS) element.addEventListener(name, stop, { passive: true });
    return stop;
  }, [ref, visit, positions]);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const onScroll = (): void => {
      if (!isReaching.current) positions.set(shownKey.current, element.scrollTop);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return (): void => element.removeEventListener("scroll", onScroll);
  }, [ref, positions]);
};
