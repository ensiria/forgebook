/**
 * A story file's named exports, read from its parsed source: the names the index takes as stories.
 *
 * @remarks
 * Kept apart from `indexStoryFile.ts`, which reads each export's fields. Pure.
 *
 * @module
 */
import type { ESTree } from "vite";

/**
 * One named export of the file: its exported name, the local name it points at (none for a re-export from another
 * file), whether its statement declares it (`export const A = …`, not `export { A }`), and where the statement starts.
 */
export type NamedExport = {
  /** The name it is exported as. */
  readonly exportName: string;
  /** The local name it points at; none for a re-export from another file. */
  readonly local: string | undefined;
  /** Whether its statement declares it (`export const A = …`), not only names it (`export { A }`). */
  readonly isDeclared: boolean;
  /** Where its statement starts. */
  readonly start: number;
};

/** An export's or an import's name: an identifier's, or a string's (`export { A as "a story" }`). */
export const moduleName = (name: ESTree.ModuleExportName): string =>
  name.type === "Literal" ? String(name.value) : name.name;

/**
 * The file's named exports that exist when it runs, in their order: declared ones and re-exports (`export { A as B }`,
 * from this file or another); never the default export, a type, or the names of an `export *`.
 *
 * @param program - the parsed file.
 */
export const namedExports = (program: ESTree.Program): NamedExport[] =>
  program.body.flatMap((statement): NamedExport[] => {
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") return [];
    const { declaration, start } = statement;
    if (declaration?.type === "VariableDeclaration") {
      return declaration.declarations.flatMap((declarator) =>
        declarator.id.type === "Identifier"
          ? [{ exportName: declarator.id.name, local: declarator.id.name, isDeclared: true, start }]
          : []
      );
    }
    if (declaration?.type === "FunctionDeclaration" && declaration.id !== null)
      return [{ exportName: declaration.id.name, local: declaration.id.name, isDeclared: true, start }];
    return statement.specifiers.flatMap((specifier): NamedExport[] => {
      const exportName = moduleName(specifier.exported);
      if (specifier.exportKind === "type" || exportName === "default") return [];
      const local = statement.source === null ? moduleName(specifier.local) : undefined;
      return [{ exportName, local, isDeclared: false, start }];
    });
  });
