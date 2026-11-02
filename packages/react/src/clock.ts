/**
 * The story clock for React components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how a React component reads it.
 * The frame's renderer provides it (`reactFrameRenderer.tsx`).
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import { createContext, useContext, useSyncExternalStore } from "react";

/** The story clock of the frame: held at the Unix epoch outside a catalogue. */
export const StoryClockContext = createContext<StoryClock>(heldStoryClock(0));

/**
 * The story's clock, for a component inside a story.
 *
 * @returns the clock the catalogue runs for the story.
 */
export const useStoryClock = (): StoryClock => useContext(StoryClockContext);

/**
 * The story's current moment, drawn again at each tick of the clock.
 *
 * @returns the moment, in milliseconds since the Unix epoch.
 */
export const useStoryNow = (): number => {
  const clock = useStoryClock();
  return useSyncExternalStore(clock.subscribe, clock.now, clock.now);
};
