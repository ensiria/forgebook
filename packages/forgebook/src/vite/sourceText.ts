/**
 * What several readers of source text need: lines by offset, and whether a text is safe to parse.
 *
 * @module
 */

/** What opens or closes a level of a script. */
const NESTING = /<\/|\/>|<[A-Za-z]|[([{)\]}]/g;

/** How deep a script may nest before it is left out. */
const MOST_NESTED = 400;

/**
 * Where each line of a text starts, to find a line by offset without reading from the start each time.
 *
 * @param text - the text.
 */
export const lineStarts = (text: string): readonly number[] => {
  const starts = [0];
  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) starts.push(at + 1);
  return starts;
};

/**
 * The line of an offset, from 1.
 *
 * @param starts - where each line starts.
 * @param offset - the offset.
 */
export const lineAt = (starts: readonly number[], offset: number): number => {
  let [low, high] = [0, starts.length - 1];
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((starts[middle] ?? 0) <= offset) low = middle;
    else high = middle - 1;
  }
  return low + 1;
};

/**
 * Whether a text nests past what a parser and a walk over its tree can take: a crafted file must cost that file, and past
 * this depth the parser itself overflows, which no `catch` can answer.
 *
 * @param text - a script.
 */
export const isTooDeep = (text: string): boolean => {
  let depth = 0;
  for (const match of text.matchAll(NESTING)) {
    const [token = ""] = match;
    depth +=
      token.startsWith("</") || token === ")" || token === "]" || token === "}" || token === "/>" ? -1 : 1;
    if (depth > MOST_NESTED) return true;
  }
  return false;
};
