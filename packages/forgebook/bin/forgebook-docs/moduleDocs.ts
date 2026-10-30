/**
 * A module's exports with their kind, parameters and summary, read with TypeScript 6's compiler API.
 *
 * @module
 */
import ts from "typescript-6";

import { programFor, summaryOf } from "../../src/vite/docsProgram.ts";
import type { ExportDocs } from "./catalogueDocs.types.ts";

/**
 * A parameter's own name: a destructured one (`({ name, ...props })`, which TypeScript calls `__0`) takes the name
 * its `@param` tag gives it, or `{…}` without one.
 */
const ownName = (parameter: ts.Symbol, declaration: ts.ParameterDeclaration): string => {
  if (ts.isIdentifier(declaration.name)) return parameter.getName();
  const tag = ts.getJSDocParameterTags(declaration)[0];
  return tag === undefined ? "{…}" : tag.name.getText();
};

/** A parameter's name as the catalogue writes it: `...rest`, `name?`, `name`. */
const parameterName = (parameter: ts.Symbol): string => {
  const declaration = parameter.valueDeclaration;
  if (declaration === undefined || !ts.isParameter(declaration)) return parameter.getName();
  const name = ownName(parameter, declaration);
  if (declaration.dotDotDotToken !== undefined) return `...${name}`;
  if (declaration.questionToken !== undefined || declaration.initializer !== undefined) return `${name}?`;
  return name;
};

/** One export's docs. */
const exportDocs = (exported: ts.Symbol, checker: ts.TypeChecker, location: ts.Node): ExportDocs => {
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  const name = exported.getName();
  const summary = summaryOf(symbol, checker);
  if (symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface))
    return { name, kind: "type", summary };
  const [signature] = checker.getTypeOfSymbolAtLocation(symbol, location).getCallSignatures();
  if (signature === undefined) return { name, kind: "value", summary };
  return { name, kind: "function", parameters: signature.parameters.map(parameterName), summary };
};

/**
 * The exports of a module.
 *
 * @param file - the module's absolute path.
 * @returns its exports in the module's order, or a message saying why it cannot be read.
 */
export const moduleDocs = (file: string): ExportDocs[] | string => {
  const program = programFor(file);
  if (typeof program === "string") return program;
  const source = program.program.getSourceFile(file);
  const moduleSymbol = source === undefined ? undefined : program.checker.getSymbolAtLocation(source);
  if (source === undefined || moduleSymbol === undefined) return `${file} has no exports`;
  const position = (symbol: ts.Symbol): number => symbol.declarations?.[0]?.getStart() ?? 0;
  return program.checker
    .getExportsOfModule(moduleSymbol)
    .sort((left, right) => position(left) - position(right))
    .map((symbol) => exportDocs(symbol, program.checker, source));
};
