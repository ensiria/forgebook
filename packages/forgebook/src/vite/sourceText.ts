/**
 * What several readers of source text need: lines by offset, and whether a text is safe to parse.
 *
 * @module
 */

/** What opens or closes a level of a script. */
const NESTING = /<\/|\/>|<[A-Za-z]|[([{)\]}]/g;

/** What each closer closes. */
const CLOSES: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{", "</": "<", "/>": "<" };

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

/** Comments and strings, whose brackets are no nesting. */
const NOT_CODE = /\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/|\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'/g;

/**
 * Whether a text nests past what a parser and a walk over its tree can take: a crafted file must cost that file, and past
 * this depth the parser itself overflows, which no `catch` can answer. Each kind of bracket counts on its own and never
 * below zero, so closers of another kind or before their openers cancel nothing.
 *
 * @param text - a script.
 */
export const isTooDeep = (text: string): boolean => {
  const depths = new Map<string, number>();
  for (const match of text.replace(NOT_CODE, " ").matchAll(NESTING)) {
    const [token = ""] = match;
    const closes = CLOSES[token];
    const kind = closes ?? (token.startsWith("<") ? "<" : token);
    const depth = Math.max(0, (depths.get(kind) ?? 0) + (closes === undefined ? 1 : -1));
    depths.set(kind, depth);
    if (depth > MOST_NESTED) return true;
  }
  return false;
};

/**
 * A file's words as an answer may repeat them: what reaches an agent as data, with what can hide text or redraw a terminal
 * taken out, and short.
 *
 * @param text - the words.
 * @param longest - how many characters to keep.
 */
export const plainWords = (text: string, longest: number): string => {
  const plain = text.replaceAll(/[\p{Cc}\p{Cf}]/gu, " ");
  return plain.length > longest ? `${plain.slice(0, longest)}…` : plain;
};
