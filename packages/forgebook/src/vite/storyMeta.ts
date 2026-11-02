/**
 * A story file's meta, read from its source with the TypeScript compiler's parser: the value of one of its fields and
 * the component it names.
 *
 * @remarks
 * CSF is the same whatever framework a story is written for, so the plugin, `forgebook-docs` and every framework's
 * docs extractor read the meta through this module. Pure: a parsed file in, nodes out.
 *
 * @module
 */
import ts from "typescript-6";

/**
 * The value a top-level constant of the file is declared with.
 *
 * @param source - the story file, parsed.
 * @param name - the constant.
 */
const constantValue = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const found = statement.declarationList.declarations.find(
      (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
    );
    if (found !== undefined) return found.initializer;
  }
  return undefined;
};

/**
 * The meta's object literal in a story file: its default export, written inline or held in a constant of the file
 * (`export default meta`), without `satisfies`, `as` and parentheses.
 *
 * @param source - the story file, parsed.
 */
const metaObject = (source: ts.SourceFile): ts.ObjectLiteralExpression | undefined => {
  for (const statement of source.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
    const exported = unwrapped(statement.expression);
    const value = ts.isIdentifier(exported) ? constantValue(source, exported.text) : exported;
    const object = value === undefined ? undefined : unwrapped(value);
    return object !== undefined && ts.isObjectLiteralExpression(object) ? object : undefined;
  }
  return undefined;
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
