/**
 * A story file's meta, read from its source with the TypeScript compiler's parser: the value of one of its fields, the
 * component it names and the module it imports that component from.
 *
 * @remarks
 * CSF is the same whatever framework a story is written for, so the plugin, `forgebook-docs` and every framework's
 * docs extractor read the meta through this module. Pure: a parsed file in, nodes or a specifier out.
 *
 * @module
 */
import ts from "typescript-6";

/** An expression without `satisfies`, `as` and parentheses. */
const unwrapped = (expression: ts.Expression): ts.Expression => {
  let inner = expression;
  while (ts.isSatisfiesExpression(inner) || ts.isAsExpression(inner) || ts.isParenthesizedExpression(inner)) {
    inner = inner.expression;
  }
  return inner;
};

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

/**
 * The module a story file imports its meta's component from (`./Button`), read from the file alone: no program, so
 * it answers at once, where the docs need the package's program.
 *
 * @param storyFile - the story file's path, for the parser.
 * @param text - the story file's text.
 * @returns the import's module specifier, or none when the meta names no imported component.
 */
export const componentImport = (storyFile: string, text: string): string | undefined => {
  const source = ts.createSourceFile(storyFile, text, ts.ScriptTarget.Latest, true);
  const expression = metaComponent(source);
  if (expression === undefined || !ts.isIdentifier(expression)) return undefined;
  const name = expression.text;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    const isNamed =
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some((element) => element.name.text === name);
    if (clause?.name?.text === name || isNamed) return statement.moduleSpecifier.text;
  }
  return undefined;
};
