/**
 * What the harness keeps of a server's output, to say why it stopped before it answered: the first lines of its first
 * error (the message and its first frames) and its last lines.
 *
 * @remarks
 * The last lines alone lost the message: a stack runs longer than they do (Storybook's, loading its main
 * configuration). Pure: lines in, the reason's text out.
 *
 * @module
 */

/** How many lines of the first error are kept, from the line that names it. */
const ERROR_LINES = 20;

/** How many of the last lines are kept. */
const LAST_LINES = 12;

/** A line that names an error. */
const ERROR_LINE = /error|ERR!|failed|cannot|could not/i;

/** A server's output as kept: its first error's lines and its last lines. */
export type KeptOutput = {
  /** The first error's lines, from the one that names it; empty until one does. */
  readonly error: string[];
  /** The last lines. */
  readonly last: string[];
};

/** Nothing kept yet. */
export const emptyOutput = (): KeptOutput => ({ error: [], last: [] });

/**
 * Keeps what a chunk of output adds.
 *
 * @param kept - what is kept so far; changed in place.
 * @param text - the chunk's text.
 */
export const keepOutput = (kept: KeptOutput, text: string): void => {
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const isOpen = kept.error.length > 0 && kept.error.length < ERROR_LINES;
    if (isOpen || (kept.error.length === 0 && ERROR_LINE.test(line))) kept.error.push(line);
    kept.last.push(line);
    if (kept.last.length > LAST_LINES) kept.last.shift();
  }
};

/**
 * The output as a reason's text: the first error, then the last lines that it does not already hold.
 *
 * @param kept - what is kept.
 */
export const outputText = (kept: KeptOutput): string => {
  const last = kept.last.filter((line) => !kept.error.includes(line));
  return [...kept.error, ...(kept.error.length > 0 && last.length > 0 ? ["…"] : []), ...last].join(" / ");
};
