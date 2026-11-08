/**
 * What `forgebook migrate` prints for a person: each file's changes, what to check, the codemods not run and the notes.
 *
 * @module
 */
import type { MigrateDocument } from "./migrate.types.ts";

/**
 * The answer as a person reads it.
 *
 * @param document - what `runMigrate` answered.
 */
export const migrateText = (document: MigrateDocument): string => {
  const lines: string[] = [];
  for (const file of new Set(document.changes.map((change) => change.file))) {
    lines.push(file);
    for (const change of document.changes.filter((each) => each.file === file)) {
      const removed =
        change.removed === "" ? [] : change.removed.split("\n").map((line) => `  - ${line.trim()}`);
      const added = change.added === "" ? [] : change.added.split("\n").map((line) => `  + ${line.trim()}`);
      lines.push(...removed, ...added, `    (${change.codemod})`);
    }
  }
  if (document.advice.length > 0) {
    lines.push("", "To check:");
    lines.push(...document.advice.map((each) => `  ${each.file}: ${each.text} (${each.codemod})`));
  }
  if (document.skipped.length > 0) {
    lines.push("", "Not run:");
    lines.push(...document.skipped.map((each) => `  ${each.codemod}: ${each.reason}`));
  }
  if (document.notes.length > 0) {
    lines.push("", "Breaking changes with no codemod, to check by hand:");
    lines.push(
      ...document.notes.map((note) => `  ${note.id} (${note.package} ${note.breaksIn}): ${note.text}`)
    );
  }
  lines.push("", document.summary);
  return lines.join("\n").replace(/^\n+/, "");
};
