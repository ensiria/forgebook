/**
 * The title a story file's path makes, for a meta that writes none, as Storybook's auto-title makes it: the file's
 * path from the static start of its pattern, without `.stories.*`.
 *
 * @remarks
 * `src/**\/*.stories.tsx` matching `src/inputs/Select/Select.stories.tsx` gives `inputs/Select`: the folder and a file
 * of the same name make one segment, and an `index` file takes its folder's name. The plugin, the tests' index and
 * `forgebook-docs` all give the index the same title, so a story's id is the same everywhere. Pure.
 *
 * @module
 */

/** A story file's name, by its extension: `.stories.` then a JavaScript or TypeScript extension. */
export const STORY_FILE = /\.stories\.(?:[cm]?[jt]sx?)$/;

/** Whether a pattern's segment has a glob character, from which point the pattern names no folder. */
const isGlob = (segment: string): boolean => /[*?[\]{}!]/.test(segment);

/**
 * The static start of a pattern: its folders before the first segment with a glob character (`../src` for
 * `../src/**\/*.stories.tsx`).
 *
 * @param pattern - the pattern.
 */
export const patternBase = (pattern: string): string => {
  const segments = pattern.split("/");
  const firstGlob = segments.findIndex(isGlob);
  const folders = firstGlob === -1 ? segments.slice(0, -1) : segments.slice(0, firstGlob);
  return folders.join("/");
};

/**
 * The title a story file's path makes, or none when its path gives no segment.
 *
 * @param base - the folder the title starts from, as `patternBase` gives it (relative paths, `/`-separated).
 * @param file - the file, relative to the same folder as `base`.
 */
export const autoTitle = (base: string, file: string): string | undefined => {
  const baseSegments = base.split("/").filter((segment) => segment !== "" && segment !== ".");
  const fileSegments = file.split("/").filter((segment) => segment !== "" && segment !== ".");
  const isUnderBase = baseSegments.every((segment, index) => fileSegments[index] === segment);
  const segments = (isUnderBase ? fileSegments.slice(baseSegments.length) : fileSegments).filter(
    (segment) => segment !== ".."
  );
  const last = segments.pop()?.replace(STORY_FILE, "");
  if (last !== undefined && last !== "index" && last.toLowerCase() !== segments.at(-1)?.toLowerCase())
    segments.push(last);
  return segments.length === 0 ? undefined : segments.join("/");
};
