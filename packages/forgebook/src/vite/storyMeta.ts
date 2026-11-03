/**
 * A story file's meta, read from its source with the TypeScript compiler's parser, for the docs: the value of one of its
 * fields, the component it names and its subcomponents.
 *
 * @remarks
 * CSF is the same whatever framework a story is written for, so `forgebook-docs` and every framework's docs extractor
 * read the meta through this module, inside their TypeScript program. The plugin's own reading, outside any program,
 * is `componentImport.ts`. Pure: a parsed file in, nodes out.
 *
 * @module
 */
import ts from "typescript-6";

/**
 * The value a constant at the top of the file is declared with, without its wrappers.
 *
 * @param source - the file, parsed.
 * @param name - the constant's name.
 */
const constantValue = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(
      (each) => ts.isIdentifier(each.name) && each.name.text === name
    );
    if (declaration?.initializer !== undefined) return unwrapped(declaration.initializer);
  }
  return undefined;
};

/**
 * The expression a story file exports as its default: `export default …`, or the local name of
 * `export { meta as default }`.
 *
 * @param source - the story file, parsed.
 */
const defaultExport = (source: ts.SourceFile): ts.Expression | undefined => {
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) return unwrapped(statement.expression);
    if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier !== undefined) continue;
    const clause = statement.exportClause;
    const specifier =
      clause !== undefined && ts.isNamedExports(clause)
        ? clause.elements.find((element) => element.name.text === "default")
        : undefined;
    if (specifier !== undefined) return specifier.propertyName ?? specifier.name;
  }
  return undefined;
};

/**
 * The meta's object literal in a story file: its default export, written in place or held in a constant of the file
 * (`export default meta`, `export { meta as default }`), as Storybook reads it; without `satisfies`, `as` and
 * parentheses.
 *
 * @param source - the story file, parsed.
 */
const metaObject = (source: ts.SourceFile): ts.ObjectLiteralExpression | undefined => {
  const exported = defaultExport(source);
  const value =
    exported !== undefined && ts.isIdentifier(exported) ? constantValue(source, exported.text) : exported;
  return value !== undefined && ts.isObjectLiteralExpression(value) ? value : undefined;
};

/**
 * The value the meta writes for one of its fields.
 *
 * @param source - the story file, parsed.
 * @param name - the field's name.
 */
export const metaField = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  const property = metaObject(source)?.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText(source) === name
  );
  return property !== undefined && ts.isPropertyAssignment(property) ? property.initializer : undefined;
};

/**
 * The meta's `component` identifier in a story file, when it names one.
 *
 * @param source - the story file, parsed.
 */
export const metaComponent = (source: ts.SourceFile): ts.Expression | undefined =>
  metaField(source, "component");

/** An expression without the wrappers around a literal list (`as const`, `satisfies`, parentheses). */
export const unwrapped = (expression: ts.Expression): ts.Expression => {
  let inner = expression;
  while (ts.isAsExpression(inner) || ts.isSatisfiesExpression(inner) || ts.isParenthesizedExpression(inner)) {
    inner = inner.expression;
  }
  return inner;
};

/** A subcomponent the meta names: the name it gives it, and where the code names its value. */
export type MetaSubcomponent = {
  /** Its key in `subcomponents`. */
  readonly name: string;
  /** The expression that names the component, the location the checker reads its type at. */
  readonly expression: ts.Expression;
  /** The component's symbol as written there; a shorthand (`{ ChipList }`) names the value, not the key. */
  readonly symbol: ts.Symbol | undefined;
};

/**
 * The subcomponents the meta names, in the order it writes them: `subcomponents: { ChipList, Items: MenuItem }`.
 *
 * @param source - the story file, parsed.
 * @param checker - the program's checker.
 */
export const metaSubcomponents = (source: ts.SourceFile, checker: ts.TypeChecker): MetaSubcomponent[] => {
  const field = metaField(source, "subcomponents");
  const object = field === undefined ? undefined : unwrapped(field);
  if (object === undefined || !ts.isObjectLiteralExpression(object)) return [];
  return object.properties.flatMap((property): MetaSubcomponent[] => {
    if (ts.isShorthandPropertyAssignment(property)) {
      const symbol = checker.getShorthandAssignmentValueSymbol(property);
      return [{ name: property.name.text, expression: property.name, symbol }];
    }
    if (!ts.isPropertyAssignment(property)) return [];
    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : property.name.getText(source);
    const symbol = checker.getSymbolAtLocation(property.initializer);
    return [{ name, expression: property.initializer, symbol }];
  });
};
