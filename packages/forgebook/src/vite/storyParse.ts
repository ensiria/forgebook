/**
 * A story file parsed with Vite's parser, as the index and the story's code read it.
 *
 * @remarks
 * A `.js` story file parses as JSX: the libraries that write their stories in JavaScript write JSX there (Carbon's
 * do), and JSX is a superset of what a `.js` file can otherwise hold. Without it such a file is an error and its stories
 * are missing from the sidebar.
 *
 * @module
 */
import { parseSync } from "vite";

/** The extension of a file that says nothing about JSX. */
const PLAIN_SCRIPT = /\.[cm]?js$/;

/**
 * A story file parsed.
 *
 * @param file - the file's path; its extension decides TypeScript and JSX.
 * @param text - the file's source.
 */
export const parseStoryFile = (file: string, text: string): ReturnType<typeof parseSync> =>
  parseSync(file, text, PLAIN_SCRIPT.test(file) ? { lang: "jsx" } : {});
