/**
 * A text from a project's files made safe to print or to hand an agent. Pure.
 *
 * @module
 */

/** The longest text taken from a project into a report, so a planted file cannot flood an agent's context. */
const PRINTABLE_LENGTH = 500;

/**
 * A text from a project's files made safe to print: no control characters, which could rewrite a terminal's lines, and
 * of a bounded length.
 *
 * @param text - the text.
 */
export const printable = (text: string): string => {
  const kept = [...text]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && (code < 127 || code > 159);
    })
    .join("");
  return kept.length > PRINTABLE_LENGTH ? `${kept.slice(0, PRINTABLE_LENGTH)}…` : kept;
};
