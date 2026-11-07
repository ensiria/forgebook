/**
 * The imports a file writes, read from its syntax, so a comment or a string holding the word is not one.
 *
 * @module
 */
import { parseSync } from "vite";

import { isTooDeep, lineAt, lineStarts } from "./sourceText.ts";

/** An import a file writes. */
export type WrittenImport = {
  /** The names it brings in, as the module exports them; `default` for a default import. */
  readonly names: readonly string[];
  /** The module. */
  readonly module: string;
  /** Its first and last lines. */
  readonly lines: readonly [number, number];
};

/** The value imports of a script's text, whose lines start from an offset. */
const importsOfScript = (file: string, text: string, firstLine: number): WrittenImport[] => {
  if (isTooDeep(text)) return [];
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return [];
  const starts = lineStarts(text);
  return program.body.flatMap((statement): WrittenImport[] => {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") return [];
    const names = statement.specifiers.flatMap((each): string[] => {
      if (each.type === "ImportDefaultSpecifier") return ["default"];
      if (each.type !== "ImportSpecifier" || each.importKind === "type") return [];
      return ["name" in each.imported ? String(each.imported.name) : String(each.imported.value)];
    });
    const lines = [statement.start, statement.end].map((offset) => lineAt(starts, offset) + firstLine - 1);
    return [{ names, module: statement.source.value, lines: [lines[0] ?? firstLine, lines[1] ?? firstLine] }];
  });
};

/** A framework's own single-file component. */
const SINGLE_FILE = /\.(?:vue|svelte|astro)$/;

/**
 * The value imports a file writes, read from its syntax, so a comment or a string holding the word is not one; a
 * single-file component's from its scripts.
 *
 * @param file - its path.
 * @param text - its text.
 */
export const importsOfFile = (file: string, text: string): WrittenImport[] => {
  try {
    if (!SINGLE_FILE.test(file)) return importsOfScript(file, text, 1);
    const found: WrittenImport[] = [];
    const starts = lineStarts(text);
    for (let open = text.indexOf("<script"); open !== -1; open = text.indexOf("<script", open + 1)) {
      const opened = text.indexOf(">", open);
      const close = text.indexOf("</script>", opened);
      if (opened === -1 || close === -1) break;
      found.push(...importsOfScript("script.ts", text.slice(opened + 1, close), lineAt(starts, opened)));
    }
    return found;
  } catch {
    return [];
  }
};
