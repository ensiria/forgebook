/**
 * The story clock for Angular components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how an Angular component reads it.
 * The frame's renderer provides it (`angularRenderer.ts`) as a signal, since a story's clock is replaced when it starts
 * over.
 *
 * @module
 */

import { computed, DestroyRef, effect, InjectionToken, inject, type Signal, signal } from "@angular/core";
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";

/** What the frame provides: the story's clock of the moment. */
export const STORY_CLOCK = new InjectionToken<Signal<StoryClock>>("forgebook story clock");

/**
 * The story's clock, for a component inside a story; called in an injection context.
 *
 * @returns the clock the catalogue runs for the story, as a signal.
 */
export const injectStoryClock = (): Signal<StoryClock> => {
  const provided = inject(STORY_CLOCK, { optional: true });
  return computed(() => provided?.() ?? heldStoryClock(0));
};

/**
 * The story's current moment, updated at each tick of the clock; called in an injection context.
 *
 * @returns the moment, in milliseconds since the Unix epoch, as a signal.
 */
export const injectStoryNow = (): Signal<number> => {
  const clock = injectStoryClock();
  const now = signal(clock().now());
  let unsubscribe = (): void => undefined;
  effect(() => {
    const current = clock();
    unsubscribe();
    now.set(current.now());
    unsubscribe = current.subscribe((): void => {
      now.set(current.now());
    });
  });
  inject(DestroyRef).onDestroy(() => unsubscribe());
  return now.asReadonly();
};
