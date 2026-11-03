/**
 * Which frames of a page of many stories may load: those near the visible part of the page, a few at a time, so the
 * browser is never asked for thousands of modules at once.
 *
 * @remarks
 * In development every frame loads its sources' modules one by one (a few hundred requests); twenty frames at once
 * exhaust the browser ("insufficient resources") and stories stay blank. A frame loads once its story is near the
 * visible part of the scrolling page and fewer than `MAX_LOADING` frames are still loading; once loaded it stays.
 *
 * @module
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** The most frames loading at once. */
const MAX_LOADING = 2;

/** How far beyond the visible part a story counts as near, as an IntersectionObserver margin. */
const NEAR_MARGIN = "600px 0px";

/** What the queue gives a page. */
export type FrameQueue = {
  /** The stories whose frames may be mounted. */
  readonly mounted: ReadonlySet<string>;
  /**
   * The ref of an element that holds a story's frame, to know when it is near; the same function each time, or every
   * render would observe the element anew. A story shown twice names each place with its own `place`.
   */
  readonly observerOf: (storyId: string, place?: number) => (element: HTMLElement | null) => void;
  /** Records a story whose frame finished loading. */
  readonly markReady: (storyId: string) => void;
};

/**
 * The queue of a page's frames.
 *
 * @param storyIds - the stories, in the page's order.
 * @param root - the element that scrolls the page.
 */
export const useFrameQueue = (
  storyIds: readonly string[],
  root: RefObject<HTMLElement | null>
): FrameQueue => {
  const [near, setNear] = useState<ReadonlySet<Element>>(new Set());
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set());
  const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  const elements = useRef(new Map<Element, string>());
  const observers = useRef(new Map<string, (element: HTMLElement | null) => void>());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(entry.target);
            else next.delete(entry.target);
          }
          return next;
        }),
      { root: root.current, rootMargin: NEAR_MARGIN }
    );
    for (const element of elements.current.keys()) observer.observe(element);
    observerRef.current = observer;
    return (): void => observer.disconnect();
  }, [root]);

  // a few more frames whenever a story comes near or a frame finishes loading; a frame the page no longer lists never
  // finishes, and must not hold a place
  useEffect(() => {
    setMounted((current) => {
      const nearIds = new Set([...near].map((element) => elements.current.get(element)));
      const loading = [...current].filter((id) => storyIds.includes(id) && !ready.has(id)).length;
      const waiting = storyIds.filter((id) => nearIds.has(id) && !current.has(id));
      const next = waiting.slice(0, Math.max(0, MAX_LOADING - loading));
      return next.length === 0 ? current : new Set([...current, ...next]);
    });
  }, [storyIds, near, ready]);

  const observerOf = useCallback((storyId: string, place = 0) => {
    const key = `${storyId}\n${place}`;
    const known = observers.current.get(key);
    if (known !== undefined) return known;
    let shown: HTMLElement | null = null;
    const observe = (element: HTMLElement | null): void => {
      if (shown !== null) {
        const gone = shown;
        observerRef.current?.unobserve(gone);
        elements.current.delete(gone);
        setNear((current) => {
          const next = new Set(current);
          next.delete(gone);
          return next;
        });
      }
      shown = element;
      if (element === null) return;
      elements.current.set(element, storyId);
      observerRef.current?.observe(element);
    };
    observers.current.set(key, observe);
    return observe;
  }, []);

  const markReady = useCallback(
    (storyId: string): void =>
      setReady((current) => (current.has(storyId) ? current : new Set(current).add(storyId))),
    []
  );

  return { mounted, observerOf, markReady };
};
