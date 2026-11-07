/**
 * A story file's code for the Code card: each story's `render`, or the args it writes as code, as written, loaded from
 * the source's `code`.
 *
 * @module
 */
import type { StoryFileCode } from "@forgebook/story-format/source";

import { type Loaded, useLoaded } from "./useLoaded.ts";

/** Whether a value is a record of texts, as a story's written args are. */
const isTexts = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((each) => typeof each === "string");

/** Whether a value is one story's code: its render's text and HTML, or the args it writes as code. */
const isStoryCode = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  if ("args" in value) return isTexts(value.args);
  return (
    "text" in value && typeof value.text === "string" && "html" in value && typeof value.html === "string"
  );
};

/** Whether the plugin's answer is a file's code: each story's, by export name. */
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
