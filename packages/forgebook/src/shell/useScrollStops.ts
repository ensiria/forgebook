/**
 * Tab stops for what scrolls sideways: a part with nothing of its own to focus can only be scrolled by a keyboard from a
 * stop on the part itself.
 *
 * @remarks
 * A part takes a stop only while it overflows: on a wide window, where a code block or a props table fits, a stop would
 * be one more press on the way through the page with nothing to do there. The parts are read again whenever the root
 * changes size: the window narrowed, a fold opened, the fonts arrived.
 *
 * @module
 */
import { type RefObject, useEffect, useRef } from "react";

/**
 * Gives the parts of an element that overflow sideways a Tab stop, and takes it back when they fit.
 *
 * @param selector - the parts, inside the element; the element itself when absent.
 * @param content - what the parts are drawn from, when it can change with no change of the element's size.
 * @returns the ref for the element.
 */
export const useScrollStops = (selector?: string, content?: string): RefObject<HTMLDivElement | null> => {
  const rootRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` replaces the parts, whose stops go with them
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const update = (): void => {
      const parts = selector === undefined ? [root] : root.querySelectorAll<HTMLElement>(selector);
      for (const part of parts) {
        if (part.scrollWidth > part.clientWidth) part.tabIndex = 0;
        else part.removeAttribute("tabindex");
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return (): void => observer.disconnect();
  }, [selector, content]);
  return rootRef;
};
