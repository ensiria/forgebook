/**
 * Where an offset of a parser's error falls in a file, as an editor counts, for the messages that name a place.
 *
 * @module
 */

/** What ends a line, for an editor as for JavaScript. */
const LINE_END = /\r\n|[\n\r\u2028\u2029]/g;

/**
 * Where an offset falls in a text, as an editor counts: both from 1.
 *
 * @param text - the text.
 * @param offset - the offset, in UTF-16 code units, as the parser gives it.
 * @returns `line:column`.
 */
export const lineAndColumn = (text: string, offset: number): string => {
  const lines = text.slice(0, offset).split(LINE_END);
  return `${lines.length}:${(lines.at(-1)?.length ?? 0) + 1}`;
};
