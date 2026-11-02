/**
 * Brings a docs page's heading into view when the address names one: at once when the page opens, smoothly when the
 * reader follows a link inside it.
 *
 * @remarks
 * While a page loads, its frames take their real heights and move what follows them, so an opened anchor is placed again
 * whenever the content's size changes, until the person scrolls themselves. After a link inside the page, focus moves
 * to the heading's own link: without it, the next Tab starts again from where the link was.
 *
 * @module
 */
import { type RefObject, useLayoutEffect, useRef } from "react";

import { headingElementId } from "../docPages.ts";
import { OWN_SCROLL_EVENTS, type PageVisit } from "./useScrollMemory.ts";

/** The room left above a heading brought into view, in CSS px. */
const TOP_ROOM = 16;

/** How a heading comes into view: at once, or smoothly when the reader's preference allows. */
const scrollStyle = (isOwnLink: boolean): ScrollBehavior =>
  isOwnLink && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";

/** Scrolls an element so a heading of it sits at its top. */
const placeHeading = (scroller: HTMLElement, heading: Element, behavior: ScrollBehavior): void => {
  const top = heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollTo({ top: scroller.scrollTop + top - TOP_ROOM, behavior });
};

/**
 * Keeps a page's heading in view.
 *
 * @param ref - the page's scrolling element.
 * @param anchor - the heading the address names; none when it names none.
 * @param visit - the visit of the page: a link inside the page keeps it.
 * @param isReady - whether the page's text is there.
 */
export const useAnchorScroll = (
  ref: RefObject<HTMLElement | null>,
  anchor: string | undefined,
  visit: PageVisit,
  isReady: boolean
): void => {
  const placedVisit = useRef<PageVisit | undefined>(undefined);
  useLayoutEffect(() => {
    const scroller = ref.current;
    if (scroller === null || !isReady) return;
    const isOwnLink = placedVisit.current === visit;
    placedVisit.current = visit;
    if (anchor === undefined) return;
    const heading = scroller.querySelector(`[id="${CSS.escape(headingElementId(anchor))}"]`);
    if (heading === null) return;
    placeHeading(scroller, heading, scrollStyle(isOwnLink));
    if (isOwnLink) {
      heading.querySelector("a")?.focus({ preventScroll: true });
      return;
    }
    const resizes = new ResizeObserver((): void => placeHeading(scroller, heading, "auto"));
    const stop = (): void => {
      resizes.disconnect();
      for (const name of OWN_SCROLL_EVENTS) scroller.removeEventListener(name, stop);
    };
    for (const child of scroller.children) resizes.observe(child);
    for (const name of OWN_SCROLL_EVENTS) scroller.addEventListener(name, stop, { passive: true });
    return stop;
  }, [ref, anchor, visit, isReady]);
};
