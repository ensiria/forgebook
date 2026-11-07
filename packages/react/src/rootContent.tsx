/**
 * What a React story still waits for, read from its root: a `Suspense` boundary showing its fallback, wherever the
 * story or a library put it, and work React has not finished.
 *
 * @remarks
 * React has no public way to ask this, and no sign of it in the page: a client render marks neither a fallback nor the
 * content it hides. So this reads React's own tree, the one thing that is exactly what is on screen: its current tree
 * only changes when React commits, so React's throttling of a fallback's end keeps it pending until the content is
 * really in the page, in a development and a production build alike. No wrapper in the story's tree, which would change
 * what the story does when it has no boundary of its own, and `act`, which a production build lacks, would flush that
 * same throttle.
 *
 * The fields read are private, so a React that moved them must not read as nothing pending. `checkedContent` therefore
 * tries the reading on a boundary known to be pending and on one known not to be, once per page, before it believes a
 * story with nothing pending: a reading that no longer sees them says it cannot tell. A root the story creates itself
 * is out of reach: only this root's tree is read.
 *
 * @module
 */

import type { ContentState } from "forgebook/renderer";
import { lazy, type ReactNode, Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

/** A story that waits for nothing. */
export const SETTLED: ContentState = { state: "settled" };

/** React's type of an `Activity`, the symbol every copy of React shares; React 18 has none. */
const ACTIVITY = Symbol.for("react.activity");

/** Why this React cannot be read, in a sentence. */
const UNREADABLE: ContentState = {
  state: "unknown",
  reason:
    "Forgebook cannot read this version of React, so it cannot tell whether a Suspense boundary still shows its fallback: update @forgebook/react, or set parameters.suspense.expected in the preview to accept that"
};

/**
 * A field of one of React's private objects.
 *
 * @param value - the object, if it is one.
 * @param name - the field.
 */
const fieldOf = (value: unknown, name: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined;

/**
 * How many boundaries of a tree show their fallback: what a boundary hides is not looked into, since it is not shown.
 *
 * @remarks
 * A boundary is told by its type, React's public `Suspense`, and not by the number React tags it with; its state is null
 * while it shows its content. Walked with a list of its own: a deep tree must not overflow the stack, and the `return`
 * links of React's current tree may point into its other one.
 *
 * @param current - the root's current tree.
 */
const pendingBoundaries = (current: unknown): number => {
  let pending = 0;
  const fibers: unknown[] = [current];
  while (fibers.length > 0) {
    const fiber = fibers.pop();
    const sibling = fieldOf(fiber, "sibling");
    if (sibling !== null && sibling !== undefined) fibers.push(sibling);
    // what a hidden `Activity` prepares is not shown: a fallback there is no one's to wait for
    if (
      fieldOf(fiber, "elementType") === ACTIVITY &&
      fieldOf(fieldOf(fiber, "memoizedProps"), "mode") === "hidden"
    )
      continue;
    if (fieldOf(fiber, "elementType") === Suspense && fieldOf(fiber, "memoizedState") !== null) {
      pending += 1;
      continue;
    }
    const child = fieldOf(fiber, "child");
    if (child !== null && child !== undefined) fibers.push(child);
  }
  return pending;
};

/**
 * What a root's story waits for now.
 *
 * @remarks
 * Its pending work counts too: a state an effect just set may be about to show a fallback, and a transition or a deferred
 * value that waits shows no fallback at all.
 *
 * @param root - the root.
 */
export const contentOfRoot = (root: Root): ContentState => {
  const fiberRoot: unknown = Reflect.get(root, "_internalRoot");
  const current = fieldOf(fiberRoot, "current");
  const work = fieldOf(fiberRoot, "pendingLanes");
  if (typeof current !== "object" || current === null || typeof work !== "number") return UNREADABLE;
  const pending = pendingBoundaries(current);
  if (pending > 0)
    return {
      state: "waiting",
      reason: `${pending} React Suspense ${pending === 1 ? "boundary still shows its" : "boundaries still show their"} fallback`
    };
  return work === 0
    ? SETTLED
    : { state: "waiting", reason: "React still has work for this story: a transition or a deferred value" };
};

/** Never comes: what a boundary known to be pending waits for. */
const Never = lazy(() => new Promise<{ readonly default: () => ReactNode }>(() => undefined));

/**
 * Whether a reading sees what is in a root: a boundary that waits as pending, and one that does not as settled.
 *
 * @param read - the reading.
 */
export const isReadingSound = (read: (root: Root) => ContentState): boolean => {
  const probe = createRoot(document.createElement("div"));
  try {
    flushSync(() =>
      probe.render(
        <Suspense fallback={null}>
          <Never />
        </Suspense>
      )
    );
    const isPendingSeen = read(probe).state === "waiting";
    flushSync(() => probe.render(<Suspense fallback={null}>{null}</Suspense>));
    return isPendingSeen && read(probe).state === "settled";
  } catch {
    return false;
  } finally {
    probe.unmount();
  }
};

/** Whether the reading held on this page: it takes one try, and React does not change while a page lives. */
let isSound: boolean | undefined;

/**
 * A reading, believed only once it was shown to work: what it finds pending needs no proof, since waiting for it cannot
 * report a story ready too early, while a reading that went blind would find nothing pending in every story.
 *
 * @param content - what the reading found.
 * @param isGone - whether the story was taken away meanwhile: nothing is asked of a page being left.
 */
export const checkedContent = (content: ContentState, isGone: boolean): ContentState => {
  if (content.state !== "settled" || isGone) return content;
  isSound ??= isReadingSound(contentOfRoot);
  return isSound ? content : UNREADABLE;
};
