/**
 * The story clock for Preact components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how a Preact component reads it.
 * The frame's renderer provides it (`preactRenderer.tsx`). The moment is followed with Preact's own hooks, so a
 * catalogue loads no `preact/compat`.
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

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
  const [now, setNow] = useState(clock.now);
  useEffect(() => {
    // a tick between the first draw and this effect is not lost: the moment is read again once subscribed
    setNow(clock.now());
    return clock.subscribe(() => setNow(clock.now()));
  }, [clock]);
  return now;
};
