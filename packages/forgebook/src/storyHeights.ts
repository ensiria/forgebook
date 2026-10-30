/**
 * The stories' measured heights: how tall each story's frame is at a few widths, written by `forgebook-heights` and
 * read by the shell, which gives a story's box that height while the story loads instead of a short guess.
 *
 * @remarks
 * Only a hint for the wait: the frame takes its real height once its story reports it. The heights are measured in the
 * default view (light theme, English, standard text size); the view's other choices change a story's height a little,
 * which a loading box can live with. The document is generated, never committed: a style change would otherwise dirty
 * it on every edit. Pure.
 *
 * @module
 */

/** The document `forgebook-heights` writes and the shell reads. */
export type StoryHeights = {
  /** The widths the stories were measured at, in CSS px, ascending. */
  readonly widths: readonly number[];
  /** Each story's height at each of `widths`, in CSS px, by story id; a story that failed is left out. */
  readonly heights: Readonly<Record<string, readonly number[]>>;
};

/** The widths `forgebook-heights` measures at by default: the stage's presets, and a wide one for Fill. */
export const HEIGHT_WIDTHS: readonly number[] = [360, 560, 768, 1024, 1440];

/** Whether a value is a list of whole numbers of px. */
const isLengths = (value: unknown): value is readonly number[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0);

/**
 * Whether a value read from the file is the heights' document.
 *
 * @param value - the parsed file.
 */
export const isStoryHeights = (value: unknown): value is StoryHeights => {
  if (typeof value !== "object" || value === null) return false;
  if (!("widths" in value) || !isLengths(value.widths) || value.widths.length === 0) return false;
  const widthCount = value.widths.length;
  if (!("heights" in value) || typeof value.heights !== "object" || value.heights === null) return false;
  return Object.values(value.heights).every((heights) => isLengths(heights) && heights.length === widthCount);
};

/**
 * A story's measured height at the width nearest the one it is drawn at.
 *
 * @param document - the heights; none when the catalogue has none.
 * @param storyId - the story's id.
 * @param width - the width the story is drawn at, in CSS px.
 * @returns the height in CSS px, or none when the story was not measured.
 */
export const knownHeight = (
  document: StoryHeights | undefined,
  storyId: string,
  width: number
): number | undefined => {
  const heights = document?.heights[storyId];
  if (document === undefined || heights === undefined) return undefined;
  let nearest = 0;
  document.widths.forEach((measured, index) => {
    const best = document.widths[nearest] ?? measured;
    if (Math.abs(measured - width) < Math.abs(best - width)) nearest = index;
  });
  return heights[nearest];
};
