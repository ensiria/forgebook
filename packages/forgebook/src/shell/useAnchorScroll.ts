/**
 * Brings a docs page's heading into view when the address names one: at once when the page opens, smoothly when the
 * reader follows a link inside it.
 *
 * @remarks
 * What comes near as the page moves loads then, frames taking their real heights and tables arriving, which moves what
 * follows them, so a heading is placed again whenever the content's size changes, until the person scrolls themselves.
 * After a link inside the page, focus moves to the heading's own link: without it, the next Tab starts again from where
 * the link was.
 *
 * @module
 */
import { type RefObject, useCallback, useLayoutEffect } from "react";

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

/** A heading of the page, by its anchor. */
const headingOf = (scroller: HTMLElement, anchor: string): Element | null =>
  scroller.querySelector(`[id="${CSS.escape(headingElementId(anchor))}"]`);

/** Brings a heading into view from a link inside the page. */
const goToHeading = (scroller: HTMLElement, heading: Element): void => {
  placeHeading(scroller, heading, scrollStyle(true));
  heading.querySelector("a")?.focus({ preventScroll: true });
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
