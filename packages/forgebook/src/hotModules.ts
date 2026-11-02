/**
 * How an edited module reaches the open pages of a dev server without a reload: the module accepts its own edit and
 * hands its successor to the page, which swaps what it drew from the one before.
 *
 * @remarks
 * A story file accepts its edit and asks, with a cancelable event, whether a frame draws its stories; the frame that
 * does draws them anew in place, and the reader keeps what they did in the story (a typed field, an open menu). A file
 * no frame draws hands its edit on to the files that import it: a story file that re-exports its stories draws them.
 * A story file's docs, code and page modules hand their successor to the shell, which shows the new value. The code
 * each module runs is written by the plugin (`vite/hotSnippets.ts`); the events are read here, by the frame and the
 * shell.
 *
 * @module
 */

/** The event a story file sends when it was edited, cancelled by the frame that draws its stories. */
export const STORY_FILE_EVENT = "forgebook:story-file";

/** The event a story file's docs, code or page module sends when it was renewed. */
export const RENEWED_MODULE_EVENT = "forgebook:module-renewed";

/** A module and the one that replaced it. */
export type ModuleSuccession = {
  /** What the module before gave: a story file's exports, or another module's default export. */
  readonly previous: unknown;
  /** What its successor gives. */
  readonly next: unknown;
};

/**
 * The module and its successor an event carries, when it is one of these events.
 *
 * @param event - the event.
 */
export const successionOf = (event: Event): ModuleSuccession | undefined => {
  if (!(event instanceof CustomEvent)) return undefined;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null) return undefined;
  if (!("previous" in detail) || !("next" in detail)) return undefined;
  return { previous: detail.previous, next: detail.next };
};
