/**
 * Brings a page's heading or prop into view when the address names one: at once when the page opens, smoothly when the
 * reader follows a link inside it, and lit for a moment after a search, since a table's row is hard to find with the eye.
 *
 * @remarks
 * What comes near as the page moves loads then, frames taking their real heights and tables arriving, which moves what
 * follows them, so a heading is placed again whenever the content's size changes, until the person scrolls themselves.
 * After a link inside the page or a search, focus moves to what was opened: without it, the next Tab starts again from
 * where the link was.
 *
 * @module
 */
import { type RefObject, useCallback, useLayoutEffect } from "react";

import { anchorSelector } from "../docPages.ts";
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

/** A heading of the page or a prop's row, by its anchor. */
const headingOf = (scroller: HTMLElement, anchor: string): Element | null =>
  scroller.querySelector(anchorSelector(anchor));

/** Gives the focus to what an address opened: a heading's own link, or the element itself. */
const focusHeading = (heading: Element): void => {
  const target = heading.querySelector("a") ?? heading;
  if (!(target instanceof HTMLElement)) return;
  // a table's row or a component's heading takes no focus of its own
  if (target.tabIndex < 0) target.tabIndex = -1;
  target.focus({ preventScroll: true });
};

/** Brings a heading into view from a link inside the page. */
const goToHeading = (scroller: HTMLElement, heading: Element): void => {
  placeHeading(scroller, heading, scrollStyle(true));
  focusHeading(heading);
};

/** Marks what a search opened for as long as its animation lasts (`[data-found]` in the style sheet). */
const markFound = (heading: Element): void => {
  focusHeading(heading);
  heading.setAttribute("data-found", "");
  heading.addEventListener("animationend", (): void => heading.removeAttribute("data-found"), { once: true });
};

/**
 * Keeps a page's heading in view.
 *
 * @param ref - the page's scrolling element.
 * @param anchor - the heading the address names; none when it names none.
 * @param visit - the visit of the page.
 * @param isReady - whether the page's text is there.
 * @returns what brings the named heading back into view: a link to it again changes no address.
 */
export const useAnchorScroll = (
  ref: RefObject<HTMLElement | null>,
  anchor: string | undefined,
  visit: PageVisit,
  isReady: boolean
): (() => void) => {
  useLayoutEffect(() => {
    const scroller = ref.current;
    if (scroller === null || anchor === undefined || !isReady) return;
    const heading = headingOf(scroller, anchor);
    if (heading === null) return;
    const isOwnLink = visit.isInPage === true;
    if (isOwnLink) goToHeading(scroller, heading);
    else placeHeading(scroller, heading, "auto");
    if (visit.movesFocus === true) markFound(heading);
    const resizes = new ResizeObserver((): void => placeHeading(scroller, heading, scrollStyle(isOwnLink)));
    const stop = (): void => {
      resizes.disconnect();
      for (const name of OWN_SCROLL_EVENTS) scroller.removeEventListener(name, stop);
    };
    for (const child of scroller.children) resizes.observe(child);
    for (const name of OWN_SCROLL_EVENTS) scroller.addEventListener(name, stop, { passive: true });
    return stop;
  }, [ref, anchor, visit, isReady]);
  return useCallback((): void => {
    const scroller = ref.current;
    const heading = scroller === null || anchor === undefined ? null : headingOf(scroller, anchor);
    if (scroller !== null && heading !== null) goToHeading(scroller, heading);
  }, [ref, anchor]);
};
