/**
 * A sentence's code spans, read as CommonMark reads them: a run of backticks opens a span that the next run of the same
 * length closes, so a span holding a backtick is written with a longer run of them. Used by `CodeText.tsx`, and by
 * what writes a sentence around a type that may hold backticks (a template literal type).
 *
 * @module
 */

/** One piece of a sentence: text, or code. */
export type SentencePiece = {
  /** The piece's text, a code span's without its backticks. */
  readonly text: string;
  /** Whether it is code. */
  readonly isCode: boolean;
};

/** A code span's text as CommonMark trims it: one space each side, when both are there and it is not only spaces. */
const trimmedSpan = (text: string): string =>
  text.length >= 2 && text.startsWith(" ") && text.endsWith(" ") && text.trim() !== ""
    ? text.slice(1, -1)
    : text;

/**
 * A sentence split into text and code spans. A run of backticks no run of the same length closes stays text.
 *
 * @param sentence - the sentence.
 */
export const sentencePieces = (sentence: string): SentencePiece[] => {
  const pieces: SentencePiece[] = [];
  let text = "";
  let at = 0;
  while (at < sentence.length) {
    const open = sentence.indexOf("`", at);
    if (open === -1) break;
    let length = 1;
    while (sentence[open + length] === "`") length += 1;
    const close = closingRun(sentence, open + length, length);
    if (close === -1) {
      text += sentence.slice(at, open + length);
      at = open + length;
      continue;
    }
    text += sentence.slice(at, open);
    if (text !== "") pieces.push({ text, isCode: false });
    text = "";
    pieces.push({ text: trimmedSpan(sentence.slice(open + length, close)), isCode: true });
    at = close + length;
  }
  text += sentence.slice(at);
  if (text !== "") pieces.push({ text, isCode: false });
  return pieces;
};

/**
 * Where the run of exactly `length` backticks that closes a span starts, or -1.
 *
 * @param sentence - the sentence.
 * @param from - where the span's text starts.
 * @param length - the opening run's length.
 */
const closingRun = (sentence: string, from: number, length: number): number => {
  let at = sentence.indexOf("`", from);
  while (at !== -1) {
    let run = 1;
    while (sentence[at + run] === "`") run += 1;
    if (run === length) return at;
    at = sentence.indexOf("`", at + run);
  }
  return -1;
};

/**
 * A text written as one code span, whatever backticks it holds: a run longer than any inside, with a space each side
 * when the text starts or ends with a backtick.
 *
 * @param text - the code.
 */
export const codeSpan = (text: string): string => {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const padding = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${padding}${text}${padding}${fence}`;
};
