/**
 * The keys that walk a catalogue's stories: `[` and `]` open the previous and the next story in the sidebar's order;
 * on a component's page `]` opens its first story (`keyboard.ts`).
 *
 * @module
 */
import { useEffect, useMemo, useRef } from "react";

import { type StoryTree, sidebarStoryIds } from "../storyTree.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { steppedStory, storyStep } from "./keyboard.ts";

/**
 * Listens to the keys that walk the stories.
 *
 * @param tree - the tree.
 * @param shownStoryId - the shown story's id; none on a component's page.
 * @param firstOfPage - on a component's page, its first story's id.
 * @param openStory - opens a story by its id.
 */
export const useStoryKeys = (
  tree: StoryTree,
  shownStoryId: string | undefined,
  firstOfPage: string | undefined,
  openStory: (id: string) => void
): void => {
  const { storyGroups } = useCatalogue();
  const storyIds = useMemo(
    () =>
      sidebarStoryIds(
        tree,
        storyGroups.map((group) => group.id)
      ),
    [tree, storyGroups]
  );
  // the latest opener, without listening again on every render
  const openRef = useRef(openStory);
  openRef.current = openStory;
  useEffect(() => {
    const walk = (event: KeyboardEvent): void => {
      const step = storyStep(event);
      if (step === undefined) return;
      const id = steppedStory(storyIds, shownStoryId, step, step === 1 ? firstOfPage : undefined);
      if (id === undefined) return;
      event.preventDefault();
      openRef.current(id);
    };
    document.addEventListener("keydown", walk);
    return (): void => document.removeEventListener("keydown", walk);
  }, [storyIds, shownStoryId, firstOfPage]);
};
