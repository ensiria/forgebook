/**
 * The catalogue's story ids, written into the page for its command-line tools: `forgebook-heights` opens the
 * catalogue and reads them, so a tool needs no source of its own to know which stories there are.
 *
 * @remarks
 * A `<script type="application/json">` in the head, which the browser never runs: data on the page, not a global.
 *
 * @module
 */
import { useEffect } from "react";

import { STORY_IDS_ELEMENT } from "../storyIdsElement";

/**
 * Keeps the page's list of story ids current.
 *
 * @param storyIds - every story's id, in the sidebar's order.
 */
export const useStoryIdsElement = (storyIds: readonly string[]): void => {
  useEffect(() => {
    let element = document.getElementById(STORY_IDS_ELEMENT);
    if (element === null) {
      element = document.createElement("script");
      element.id = STORY_IDS_ELEMENT;
      element.setAttribute("type", "application/json");
      document.head.append(element);
    }
    element.textContent = JSON.stringify(storyIds);
  }, [storyIds]);
};
