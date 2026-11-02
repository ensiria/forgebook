/**
 * A file's summary: the first paragraph of its leading `@module` comment, read from its text alone.
 *
 * @remarks
 * A component's page shows it as its lead, before any TypeScript program exists, so reading it must not load the
 * compiler in the dev server's thread. Pure: text in, text out.
 *
 * @module
 */

/** A file's start up to its first comment: a shebang and blank space, which come before any leading comment. */
const BEFORE_COMMENT = /^(?:#!.*\n)?\s*/;

/**
 * The first paragraph of a file's leading comment, its `@module` TSDoc: what the file holds, in a sentence. A
 * component's own TSDoc is often a bare name ("A button."); its file's comment says what it is and does.
 *
 * @param text - the file's text.
 * @returns the paragraph on one line, or an empty text when the file does not open with a `@module` comment.
 */
export const moduleSummaryOfText = (text: string): string => {
  const start = BEFORE_COMMENT.exec(text)?.[0].length ?? 0;
  const end = text.indexOf("*/", start);
  if (!text.startsWith("/**", start) || end < 0) return "";
  const comment = text.slice(start, end + 2);
  if (!comment.includes("@module")) return "";
  const lines = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd());
  const first = lines.findIndex((line) => line !== "");
  const paragraph: string[] = [];
  for (const line of lines.slice(Math.max(first, 0))) {
    if (line === "" || line.startsWith("@")) break;
    paragraph.push(line);
  }
  return paragraph.join(" ").replace(/\s+/g, " ").trim();
};
