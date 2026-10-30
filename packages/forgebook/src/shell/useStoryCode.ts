/**
 * A story file's code for the Code card: each story's `render` as written, loaded from the source's `code`.
 *
 * @module
 */
import type { StoryFileCode } from "@ensiria/story-format/source";

import { type Loaded, useLoaded } from "./useLoaded";

/** Whether a value is one story's code: its text and its HTML. */
const isStoryCode = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "text" in value &&
  typeof value.text === "string" &&
  "html" in value &&
  typeof value.html === "string";

/** Whether the plugin's answer is a file's code: each story's text and HTML, by export name. */
const isStoryFileCode = (value: unknown): value is StoryFileCode =>
  typeof value === "object" &&
  value !== null &&
  !("error" in value) &&
  Object.values(value).every(isStoryCode);

/** What the plugin answered, as a state. */
const codeState = (value: unknown): Loaded<StoryFileCode> => {
  if (isStoryFileCode(value)) return { status: "ready", value };
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return { status: "error", message: value.error };
  }
  return { status: "error", message: "The story file's code has an unexpected shape" };
};

/**
 * The code of a story file.
 *
 * @param load - the source's loader for the file; `undefined` when it has none.
 */
export const useStoryCode = (load: (() => Promise<unknown>) | undefined): Loaded<StoryFileCode> =>
  useLoaded(load, codeState);
