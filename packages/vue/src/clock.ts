/**
 * The story clock for Vue components inside a story: the clock the catalogue runs, held at the Unix epoch outside a
 * catalogue.
 *
 * @remarks
 * The clock itself is the format's (`@forgebook/story-format/clock`); this module is how a Vue component reads it. The
 * frame's renderer provides it (`vueRenderer.ts`), as a ref, since a story's clock is replaced when it starts over.
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import {
  type ComputedRef,
  computed,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type Ref,
  shallowRef,
  watch
} from "vue";

/** What the frame provides: the story's clock of the moment. */
export const STORY_CLOCK: InjectionKey<Readonly<Ref<StoryClock>>> = Symbol("forgebook story clock");

/**
 * The story's clock, for a component inside a story.
 *
 * @returns the clock the catalogue runs for the story, as a ref.
 */
export const useStoryClock = (): ComputedRef<StoryClock> => {
  const provided = inject(STORY_CLOCK, undefined);
  return computed(() => provided?.value ?? heldStoryClock(0));
};

/**
 * The story's current moment, updated at each tick of the clock.
 *
 * @returns the moment, in milliseconds since the Unix epoch, as a ref.
 */
export const useStoryNow = (): Readonly<Ref<number>> => {
  const clock = useStoryClock();
  const now = shallowRef(clock.value.now());
  let unsubscribe = (): void => undefined;
  const follow = (): void => {
    unsubscribe();
    now.value = clock.value.now();
    unsubscribe = clock.value.subscribe((): void => {
      now.value = clock.value.now();
    });
  };
  // on the server no effect runs: a story there reads the moment it starts at
  onMounted(follow);
  watch(clock, follow);
  onBeforeUnmount(() => unsubscribe());
  return now;
};
