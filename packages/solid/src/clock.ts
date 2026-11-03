/**
 * The story clock for Solid components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how a Solid component reads it,
 * as accessors, Solid's way: the moment read inside JSX follows the clock's ticks and nothing else runs again. The
 * frame's renderer provides it (`solidRenderer.ts`).
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import {
  type Accessor,
  createContext,
  createRenderEffect,
  createSignal,
  onCleanup,
  useContext
} from "solid-js";

/** The story clock of the frame: held at the Unix epoch outside a catalogue. */
export const StoryClockContext = createContext<Accessor<StoryClock>>(() => heldStoryClock(0));

/**
 * The story's clock, for a component inside a story.
 *
 * @returns the clock the catalogue runs for the story, as an accessor.
 */
export const useStoryClock = (): Accessor<StoryClock> => useContext(StoryClockContext);

/**
 * The story's current moment, following each tick of the clock.
 *
 * @returns the moment, in milliseconds since the Unix epoch, as an accessor.
 */
export const useStoryNow = (): Accessor<number> => {
  const clock = useStoryClock();
  const [now, setNow] = createSignal(clock().now());
  createRenderEffect(() => {
    const current = clock();
    setNow(current.now());
    onCleanup(current.subscribe(() => setNow(current.now())));
  });
  return now;
};
