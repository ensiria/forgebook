/**
 * Which waiting frames of a page start first: the ones the reader is looking at, then their neighbours outward.
 *
 * @remarks
 * A page lists its stories top to bottom, but the reader may be anywhere on it: after a scroll to the end, the stories
 * in view must not wait behind the ones above them that are still near. Read by `useFrameQueue`.
 *
 * @module
 */

/** A box's vertical extent, in the same coordinates as the visible part of the page. */
export type VerticalBox = {
  /** Its top edge, in CSS px. */
  readonly top: number;
  /** Its bottom edge, in CSS px. */
  readonly bottom: number;
};

/**
 * How far a box is from the visible part of the page: 0 when any of it is in view, otherwise the gap to the nearest
 * edge.
 *
 * @param box - the box of a story's frame.
 * @param view - the visible part of the page.
 * @returns The distance, in CSS px.
 */
export const distanceFromView = (box: VerticalBox, view: VerticalBox): number => {
  if (box.bottom <= view.top) return view.top - box.bottom;
  if (box.top >= view.bottom) return box.top - view.bottom;
  return 0;
};

/**
 * The frames to start now: the nearest to the visible part first, in the page's order among equals, at most `free`.
 *
 * @param waiting - the stories waiting for their frame, in the page's order.
 * @param distances - each story's distance from the visible part, in CSS px; a story with none comes after every
 * other.
 * @param free - how many frames may start.
 * @returns The stories to start, nearest first.
 */
export const nearestFrames = (
  waiting: readonly string[],
  distances: ReadonlyMap<string, number>,
  free: number
): string[] => {
  const distanceOf = (storyId: string): number => distances.get(storyId) ?? Number.POSITIVE_INFINITY;
  // a stable sort keeps the page's order among stories at the same distance, the demo first among those in view
  // (compared rather than subtracted: two stories with no distance would give NaN)
  const byDistance = (first: string, second: string): number => {
    const [one, other] = [distanceOf(first), distanceOf(second)];
    if (one === other) return 0;
    return one < other ? -1 : 1;
  };
  return [...waiting].sort(byDistance).slice(0, Math.max(0, free));
};
