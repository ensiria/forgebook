/**
 * The index's problems as a dev server's edits leave them: a story file that an edit left unreadable is named at once,
 * without a reload that would take its story away from the reader, and no longer once a later edit fixed it.
 *
 * @module
 */
import { useEffect, useMemo, useState } from "react";

import { STORY_FILE_READ_EVENT, storyFileReadOf } from "../hotModules.ts";

/** No file an edit left unreadable. */
const NONE: ReadonlyMap<string, string> = new Map();

/**
 * The problems to show.
 *
 * @param problems - the index's problems, as the page read them.
 */
export const useEditedProblems = (problems: readonly string[]): readonly string[] => {
  const [edited, setEdited] = useState(NONE);
  useEffect(() => {
    // a build has no edits
    if (import.meta.hot === undefined) return undefined;
    const follow = (event: Event): void => {
      const read = storyFileReadOf(event);
      if (read === undefined) return;
      setEdited((before) => {
        const next = new Map(before);
        if (read.problem === undefined) next.delete(read.file);
        else next.set(read.file, read.problem);
        return next;
      });
    };
    window.addEventListener(STORY_FILE_READ_EVENT, follow);
    return (): void => window.removeEventListener(STORY_FILE_READ_EVENT, follow);
  }, []);
  // an edit's word on a file replaces what the page read of it: the problem names its file first
  return useMemo(() => {
    const kept = problems.filter((problem) => ![...edited.keys()].some((file) => problem.startsWith(file)));
    return [...kept, ...edited.values()];
  }, [problems, edited]);
};
