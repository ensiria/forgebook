/**
 * The story clock for Svelte components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how a Svelte component reads it,
 * each value a `current` that a template follows, as Svelte's own reactive values are read. The moment follows the
 * clock's ticks through `createSubscriber`, so it listens only while something reads it, and not at all on the server.
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import { createSubscriber } from "svelte/reactivity";

import { storyView } from "./storyView.ts";

/** A value of the moment, read as Svelte's reactive values are. */
export type StoryValue<TValue> = {
  /** The value; a template or an effect that reads it follows it. */
  readonly current: TValue;
};

/** The clock outside a catalogue. */
const HELD_CLOCK = heldStoryClock(0);

/**
 * The story's clock, for a component inside a story; called while the component is initialised.
 *
 * @returns the clock the catalogue runs for the story, which is replaced when the story starts over.
 */
export const getStoryClock = (): StoryValue<StoryClock> => {
  const view = storyView();
  return {
    get current(): StoryClock {
      return view?.clock ?? HELD_CLOCK;
    }
  };
};

/**
 * The story's current moment, which follows each tick of the clock; called while the component is initialised.
 *
 * @returns the moment, in milliseconds since the Unix epoch.
 */
export const getStoryNow = (): StoryValue<number> => {
  const clock = getStoryClock();
  // one subscriber per clock: a story that starts over has a new clock, and what read the old one stops listening
  const subscribers = new WeakMap<StoryClock, () => void>();
  const subscriberOf = (current: StoryClock): (() => void) => {
    const kept = subscribers.get(current);
    if (kept !== undefined) return kept;
    const subscriber = createSubscriber((update) => current.subscribe(update));
    subscribers.set(current, subscriber);
    return subscriber;
  };
  return {
    get current(): number {
      const current = clock.current;
      subscriberOf(current)();
      return current.now();
    }
  };
};
