/**
 * Where an application draws a JSX component, read from its program with the TypeScript checker (no code runs): each
 * element whose tag is the component, with the props it gives a literal value. `forgebook new` takes its values from
 * them, so a first story shows the component as the application uses it rather than with a prop's name for its text.
 *
 * @remarks
 * Shared by the frameworks whose components are functions of their props (React, Preact, Solid). The program is the
 * component's configuration's, read whole. Story files, tests and declaration files are left out: they are not the
 * application. A value is kept only when it is a literal (a string, a number, `true`, `false`, `null`, a list or an
 * object of them); one that depends on the caller's state would not mean anything in a story. A child that is plain text
 * is `children`.
 *
 * @module
 */
import ts from "typescript-6";

import type { CallSite, ExtractCallSites } from "./adapter.ts";
import { programFor } from "./docsProgram.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A file that is not the application: a story, a test, a declaration. */
const NOT_APPLICATION = /\.(?:stories|story|test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|[\\/]node_modules[\\/]/;

/** How deep a list or an object is followed: past it, a value is not kept. */
const MAX_DEPTH = 4;

/**
 * An expression as code a story can hold, when it is a literal: shared with the frameworks that read their templates'
 * bindings as expressions (Vue's `:size="3"`).
 *
 * @param node - the expression.
 * @param depth - how deep in a list or an object it is.
 * @returns the code; none when it is not a literal.
 */
export const literalExpressionCode = (node: ts.Expression, depth = 0): string | undefined => {
  if (depth > MAX_DEPTH) return undefined;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
    return literalExpressionCode(node.expression, depth);
  if (ts.isArrayLiteralExpression(node)) return listCode(node, depth);
  if (ts.isObjectLiteralExpression(node)) return objectCode(node, depth);
  return scalarCode(node);
};

/** A string, a number (a negative one too), `true`, `false` or `null` as code; none for anything else. */
const scalarCode = (node: ts.Expression): string | undefined => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return JSON.stringify(node.text);
  if (ts.isNumericLiteral(node)) return node.text;
  const isNegative =
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand);
  if (isNegative) return `-${node.operand.text}`;
  return KEYWORD_CODE.get(node.kind);
};

/** The keywords that are literals, as code. */
const KEYWORD_CODE = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.TrueKeyword, "true"],
  [ts.SyntaxKind.FalseKeyword, "false"],
  [ts.SyntaxKind.NullKeyword, "null"]
]);

/** A list of literals as code. */
const listCode = (node: ts.ArrayLiteralExpression, depth: number): string | undefined => {
  const items = node.elements.map((item) =>
    ts.isSpreadElement(item) ? undefined : literalExpressionCode(item, depth + 1)
  );
  return items.some((item) => item === undefined) ? undefined : `[${items.join(", ")}]`;
};

/** A property's name as code: a name as it is, a string quoted; none for a computed one. */
const keyCode = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return JSON.stringify(name.text);
  return undefined;
};

/** An object of literals as code. */
const objectCode = (node: ts.ObjectLiteralExpression, depth: number): string | undefined => {
  const pairs: string[] = [];
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined;
    const key = keyCode(property.name);
    const value = literalExpressionCode(property.initializer, depth + 1);
    if (key === undefined || value === undefined) return undefined;
    pairs.push(`${key}: ${value}`);
  }
  return `{ ${pairs.join(", ")} }`;
};

/** The character references JSX text and attributes most often hold, as the characters they stand for. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0"
};

/** JSX text with its common character references read (`a &amp; b` is `a & b`), as React reads them. */
const decoded = (text: string): string =>
  text.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "");

/** An attribute's value as code: a bare attribute is `true`, a string as written, an expression when a literal. */
const initializerCode = (initializer: ts.JsxAttributeValue | undefined): string | undefined => {
  if (initializer === undefined) return "true";
  if (ts.isStringLiteral(initializer)) return JSON.stringify(decoded(initializer.text));
  if (ts.isJsxExpression(initializer) && initializer.expression !== undefined)
    return literalExpressionCode(initializer.expression);
  return undefined;
};

/** The props an element gives a literal value, and its text child as `children`. */
const argsOf = (element: ts.JsxElement | ts.JsxSelfClosingElement): Record<string, string> => {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  const args: Record<string, string> = {};
  for (const attribute of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
    const name = attribute.name.text;
    if (name === "key" || name === "ref") continue;
    const { initializer } = attribute;
    const code = initializerCode(initializer);
    if (code !== undefined) args[name] = code;
  }
  const texts = ts.isJsxElement(element) ? element.children.filter(ts.isJsxText) : [];
  if (ts.isJsxElement(element) && texts.length > 0 && texts.length === element.children.length) {
    const text = texts
      .map((child) => decoded(child.text))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text !== "") args["children"] = JSON.stringify(text);
  }
  return args;
};

/**
 * The symbol a name stands for, through its imports and re-exports.
 *
 * @param symbol - the symbol at the name.
 * @param checker - the checker.
 */
const declared = (symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Symbol | undefined =>
  symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;

/** The component's export, by its name or by its declaration's (`const TagImpl = …; export { TagImpl as Tag }`). */
const exportedSymbol = (
  source: ts.SourceFile,
  name: string,
  checker: ts.TypeChecker
): { readonly exported: ts.Symbol; readonly target: ts.Symbol } | undefined => {
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exports = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
  const exported =
    exports.find((each) => each.getName() === name) ??
    exports.find((each) => declared(each, checker)?.getName() === name);
  const target = declared(exported, checker);
  return exported === undefined || target === undefined ? undefined : { exported, target };
};

/** The names a file that draws the component must hold: its export's, its declaration's, its file's. */
const searchedNames = (file: string, exported: ts.Symbol, target: ts.Symbol): string[] => {
  const stem = (VITE_PATHS.normalize(file).split("/").pop() ?? "").replace(/\.[^.]+$/, "");
  return [exported.getName(), target.getName(), stem].filter(
    (each) => each !== "default" && each !== "index"
  );
};

/** The elements of a file whose tag is the component, with their literal props. */
const sitesIn = (file: ts.SourceFile, target: ts.Symbol, checker: ts.TypeChecker): CallSite[] => {
  const sites: CallSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (declared(checker.getSymbolAtLocation(tag), checker) === target)
        sites.push({ file: file.fileName, args: argsOf(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return sites;
};

/**
 * Where the application draws a component a file exports.
 *
 * @param file - the component's file, absolute.
 * @param name - the export's name (`default` for a default export).
 * @returns the call sites; a message when the file or the export cannot be read.
 */
export const jsxCallSites: ExtractCallSites = (file: string, name: string): readonly CallSite[] | string => {
  const program = programFor(file, { reach: "whole" });
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(file);
  if (source === undefined) return `${file} is not in its program`;
  const found = exportedSymbol(source, name, checker);
  if (found === undefined) return `${file} exports no ${name}`;
  // a file that names neither the component nor its file cannot draw it: the checker is not asked about its tags
  const names = searchedNames(file, found.exported, found.target);
  const component = VITE_PATHS.normalize(file);
  return program.program
    .getSourceFiles()
    .filter(
      (each) =>
        !NOT_APPLICATION.test(each.fileName) &&
        !program.program.isSourceFileFromExternalLibrary(each) &&
        VITE_PATHS.normalize(each.fileName) !== component &&
        (names.length === 0 || names.some((searched) => each.text.includes(searched)))
    )
    .flatMap((each) => sitesIn(each, found.target, checker));
};
