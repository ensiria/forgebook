/**
 * The stories' measured heights, read once from the file the catalogue's configuration names (`heights`), for the
 * loading boxes.
 *
 * @remarks
 * The file is generated (`forgebook-heights`) and may be missing, stale or, on a development server, answered with
 * the page itself: any answer that is not the heights' document is none, and the shell waits as it did without one.
 *
 * @module
 */
import { useMemo } from "react";

import { isStoryHeights, type StoryHeights } from "../storyHeights";
import { type Loaded, useLoaded } from "./useLoaded";

/** The file's answer as a state: the heights, or none for anything else. */
const heightsState = (value: unknown): Loaded<StoryHeights> =>
  isStoryHeights(value) ? { status: "ready", value } : { status: "none" };

/**
 * The stories' measured heights.
 *
 * @param url - the heights' file, relative to the page; none when the catalogue has none.
 * @returns the heights, or none while they load or when there are none.
 */
export const useStoryHeights = (url: string | undefined): StoryHeights | undefined => {
  const load = useMemo(
    () =>
      url === undefined
        ? undefined
        : (): Promise<unknown> =>
            fetch(url)
              .then((response) => (response.ok ? response.json() : undefined))
              .catch(() => undefined),
    [url]
  );
  const heights = useLoaded(load, heightsState);
  return heights.status === "ready" ? heights.value : undefined;
};
