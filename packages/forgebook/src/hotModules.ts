/**
 * How an edited module reaches the open pages of a dev server without a reload: the module accepts its own edit and
 * hands its successor to the page, which swaps what it drew from the one before.
 *
 * @remarks
 * A story file accepts its edit and asks, with a cancelable event, whether a frame draws its stories; the frame that
 * does draws them anew in place, and the reader keeps what they did in the story (a typed field, an open menu). A file
 * no frame draws hands its edit on to the files that import it: a story file that re-exports its stories draws them.
 * A story file's docs, code and page modules hand their successor to the shell, which shows the new value. The frame's
 * entry takes the edits of its previews and of what they import (a library's whole index, often): the frame draws its
 * story anew with the new previews instead of the page reloading. The code each module runs is written by the plugin
 * (`vite/hotSnippets.ts`); the events are read here, by the frame and the shell.
 *
 * @module
 */

/** The event a story file sends when it was edited, cancelled by the frame that draws its stories. */
export const STORY_FILE_EVENT = "forgebook:story-file";

/** The event a story file's docs, code or page module sends when it was renewed. */
export const RENEWED_MODULE_EVENT = "forgebook:module-renewed";

/**
 * The event the frame's entry sends when a preview, or a module one imports, was edited: the previews that changed,
 * by their place in the list, in a `CustomEvent` whose detail is `PreviewsRenewal`.
 */
export const PREVIEWS_EVENT = "forgebook:previews";

/**
 * The event an edit of a story file sends when it changes whether the file can be read: from the dev server to the
 * group's module, which hands it on to the page in a `CustomEvent` whose detail is `StoryFileRead`, for the shell to
 * name the file at once. The file stays in the list a page read: its frame keeps what it drew, and its fix draws in
 * place.
 */
export const STORY_FILE_READ_EVENT = "forgebook:story-file-read";

/** Whether an edited story file can be read now. */
export type StoryFileRead = {
  /** The file, absolute in Vite's form. */
  readonly file: string;
  /** Why it cannot, naming it with its line and column when they are known; none when it can. */
  readonly problem?: string;
};

/**
 * What an event says of an edited story file, when it is that event.
 *
 * @param event - the event.
 */
export const storyFileReadOf = (event: Event): StoryFileRead | undefined => {
  if (!(event instanceof CustomEvent)) return undefined;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null || !("file" in detail)) return undefined;
  if (typeof detail.file !== "string") return undefined;
  const problem = "problem" in detail && typeof detail.problem === "string" ? detail.problem : undefined;
  return { file: detail.file, ...(problem === undefined ? {} : { problem }) };
};

/** The previews an edit renewed: each one's new module, or `undefined` for one it did not change. */
export type PreviewsRenewal = {
  /** The previews' modules, in the catalogue's order. */
  readonly next: readonly unknown[];
};

/**
 * The previews an event carries, when it is the previews' event.
 *
 * @param event - the event.
 */
export const previewsRenewalOf = (event: Event): PreviewsRenewal | undefined => {
  if (!(event instanceof CustomEvent)) return undefined;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null || !("next" in detail) || !Array.isArray(detail.next))
    return undefined;
  const next: readonly unknown[] = detail.next;
  return { next };
};

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
