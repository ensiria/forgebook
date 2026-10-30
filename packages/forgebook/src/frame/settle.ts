/**
 * Waiting for a story's animations to end, for the Replay control's exit.
 *
 * @remarks
 * An endless animation (a loading shimmer, a spinner) never finishes, so waiting for every animation of the document
 * would never return: only the animations with an end are awaited.
 *
 * @module
 */

/** An animation as the wait reads it: its timing, and the promise of its end. */
export type SettlingAnimation = Pick<Animation, "effect" | "finished">;

/**
 * The animations that end: every one but the endless ones.
 *
 * @param animations - the document's animations.
 */
export const endingAnimations = <TAnimation extends SettlingAnimation>(
  animations: readonly TAnimation[]
): TAnimation[] => animations.filter((animation) => animation.effect?.getTiming().iterations !== Infinity);

/**
 * Resolves once every animation of the document that ends has finished or been cancelled, a frame after the call.
 *
 * @param document - the frame's document.
 */
export const animationsSettled = async (document: Document): Promise<void> => {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await Promise.allSettled(endingAnimations(document.getAnimations()).map((animation) => animation.finished));
};
