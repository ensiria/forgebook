/**
 * Whether a scrolling page has stopped flying past its content, for the frame queue (`useFrameQueue`).
 *
 * @remarks
 * A fast scroll to the end of a long page passes over stories the reader never looks at: a frame started for one of
 * them takes a loading place from the stories where the scroll stops. The page counts as unsettled while it scrolls
 * faster than `FAST_SCROLL`, and settles `SETTLE_MS` after its last fast step; a slow scroll, a reader's, stays
 * settled, so stories keep loading as they come near.
 *
 * @module
 */
import { type RefObject, useEffect, useState } from "react";

/** The scroll speed above which the page flies past its stories, in CSS px per millisecond: 2000 px a second. */
const FAST_SCROLL = 2;

/** How long after its last fast step the page counts as settled, in milliseconds. */
const SETTLE_MS = 150;

/**
 * The longest time read between two scroll events, in milliseconds: a jump after a pause (the End key, a link to a
 * story further down) counts as fast, not as a long slow step.
 */
const LONGEST_STEP_MS = 100;

/**
 * Whether the page is settled: true unless it scrolled fast in the last `SETTLE_MS`.
 *
 * @param root - the element that scrolls the page; the hook reads nothing when it is not there.
 */
export const useScrollSettled = (root: RefObject<HTMLElement | null>): boolean => {
  const [isSettled, setIsSettled] = useState(true);
  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    let lastTop = element.scrollTop;
    let lastTime = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = (): void => {
      const now = performance.now();
      const step = Math.min(Math.max(now - lastTime, 1), LONGEST_STEP_MS);
      const speed = Math.abs(element.scrollTop - lastTop) / step;
      lastTop = element.scrollTop;
      lastTime = now;
      if (speed <= FAST_SCROLL) return;
      setIsSettled(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsSettled(true), SETTLE_MS);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return (): void => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      setIsSettled(true);
    };
  }, [root]);
  return isSettled;
};
