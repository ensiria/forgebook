/**
 * Where a custom element is in a TypeScript program: the class a tag is defined with, and the tag a class is defined
 * under. Read for an element the package's Custom Elements Manifest does not list, or in a package with none.
 *
 * @remarks
 * A tag finds its class through `HTMLElementTagNameMap`, which a Lit element declares for its tag
 * (`declare global { interface HTMLElementTagNameMap { "my-button": MyButton } }`), then through the definitions the
 * project's own files write: Lit's `@customElement("my-button")` and `customElements.define("my-button", MyButton)`.
 * A class finds its tag the same ways, in its own file. Files under `node_modules` are not searched for a definition.
 *
 * @module
 */

import { declaredSymbol } from "forgebook/vite/prop-docs";
import ts from "typescript-6";

/** A class that defines a custom element, with its declaration. */
export type ElementClass = {
  /** The class's symbol. */
  readonly symbol: ts.Symbol;
  /** Its declaration. */
  readonly declaration: ts.ClassLikeDeclaration;
};

/**
 * A symbol's class declaration, when it is a class.
 *
 * @param symbol - the symbol, through its import.
 * @param checker - the program's checker.
 */
export const elementClassOf = (
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker
): ElementClass | undefined => {
  const declared = declaredSymbol(symbol, checker);
  const declaration = declared?.declarations?.find(ts.isClassLike);
  return declared === undefined || declaration === undefined ? undefined : { symbol: declared, declaration };
};

/** A string literal's text, or none for any other expression. */
const literalText = (expression: ts.Expression | undefined): string | undefined =>
  expression !== undefined &&
  (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;

/** A definition a file writes: the tag, and the expression naming the class. */
type Definition = {
  /** The tag defined. */
  readonly tag: string;
  /** Where the code names the class: the decorated class's name, or `define`'s second argument. */
  readonly target: ts.Node;
};

/**
 * The tags a class's `@customElement("tag")` decorators define it under.
 *
 * @param node - any node of the file.
 * @param source - the file.
 */
const decoratorDefinitions = (node: ts.Node, source: ts.SourceFile): Definition[] => {
  if (!ts.isClassDeclaration(node) || node.name === undefined) return [];
  const target = node.name;
  return (ts.getDecorators(node) ?? []).flatMap((decorator): Definition[] => {
    const call = decorator.expression;
    if (!ts.isCallExpression(call) || call.expression.getText(source) !== "customElement") return [];
    const tag = literalText(call.arguments[0]);
    return tag === undefined ? [] : [{ tag, target }];
  });
};

/**
 * The tag a `customElements.define("tag", Class)` call defines.
 *
 * @param node - any node of the file.
 * @param source - the file.
 */
const defineCallDefinitions = (node: ts.Node, source: ts.SourceFile): Definition[] => {
  if (!ts.isCallExpression(node) || !/(^|\.)customElements\.define$/.test(node.expression.getText(source)))
    return [];
  const tag = literalText(node.arguments[0]);
  const target = node.arguments[1];
  return tag === undefined || target === undefined ? [] : [{ tag, target }];
};

/**
 * The custom elements a file defines: `@customElement("tag")` on a class, `customElements.define("tag", Class)`.
 *
 * @param source - the file.
 */
const definitionsIn = (source: ts.SourceFile): Definition[] => {
  const found: Definition[] = [];
  const visit = (node: ts.Node): void => {
    found.push(...decoratorDefinitions(node, source), ...defineCallDefinitions(node, source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/** Whether a file is the project's own, not a dependency's or the standard library's. */
const isProjectFile = (source: ts.SourceFile): boolean =>
  !source.isDeclarationFile && !source.fileName.split(/[\\/]/).includes("node_modules");

/**
 * The class `HTMLElementTagNameMap` gives a tag, as seen from a file.
 *
 * @param tag - the tag.
 * @param from - the file the tag is named in.
 * @param checker - the program's checker.
 */
const mappedClass = (tag: string, from: ts.SourceFile, checker: ts.TypeChecker): ElementClass | undefined => {
  const map = checker
    .getSymbolsInScope(from, ts.SymbolFlags.Interface)
    .find((symbol) => symbol.getName() === "HTMLElementTagNameMap");
  const entry = map === undefined ? undefined : checker.getDeclaredTypeOfSymbol(map).getProperty(tag);
  if (entry === undefined) return undefined;
  const element = elementClassOf(checker.getTypeOfSymbol(entry).getSymbol(), checker);
  // the standard library maps its own tags too; only a class of the project is an element to document
  return element !== undefined && isProjectFile(element.declaration.getSourceFile()) ? element : undefined;
};

/**
 * The class a tag is defined with.
 *
 * @param tag - the tag.
 * @param from - the file the tag is named in (the story file), whose program holds the element.
 * @param program - the program.
 */
export const classOfTag = (
  tag: string,
  from: ts.SourceFile,
  program: ts.Program
): ElementClass | undefined => {
  const checker = program.getTypeChecker();
  const mapped = mappedClass(tag, from, checker);
  if (mapped !== undefined) return mapped;
  for (const source of program.getSourceFiles().filter(isProjectFile)) {
    const definition = definitionsIn(source).find((each) => each.tag === tag);
    if (definition !== undefined)
      return elementClassOf(checker.getSymbolAtLocation(definition.target), checker);
  }
  return undefined;
};

/**
 * The tag a class is defined under, by its own file.
 *
 * @param element - the class.
 * @param checker - the program's checker.
 */
export const tagOfClass = (element: ElementClass, checker: ts.TypeChecker): string | undefined => {
  const source = element.declaration.getSourceFile();
  const defined = definitionsIn(source).find(
    (each) => declaredSymbol(checker.getSymbolAtLocation(each.target), checker) === element.symbol
  );
  if (defined !== undefined) return defined.tag;
  const map = checker
    .getSymbolsInScope(source, ts.SymbolFlags.Interface)
    .find((symbol) => symbol.getName() === "HTMLElementTagNameMap");
  const entry = map === undefined ? [] : checker.getDeclaredTypeOfSymbol(map).getProperties();
  return entry
    .find(
      (each) => elementClassOf(checker.getTypeOfSymbol(each).getSymbol(), checker)?.symbol === element.symbol
    )
    ?.getName();
};

/**
 * Whether a class is a custom element: `HTMLElement` among its bases.
 *
 * @param element - the class.
 * @param checker - the program's checker.
 */
export const isCustomElement = (element: ElementClass, checker: ts.TypeChecker): boolean => {
  const isElement = (type: ts.Type, depth: number): boolean => {
    if (type.getSymbol()?.getName() === "HTMLElement") return true;
    if (depth > 20 || !type.isClassOrInterface()) return false;
    return (checker.getBaseTypes(type) ?? []).some((base) => isElement(base, depth + 1));
  };
  return isElement(checker.getDeclaredTypeOfSymbol(element.symbol), 0);
};
