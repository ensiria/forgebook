/**
 * A story file's top level as the index and the story's code read it: its constants, the properties assigned to names
 * after them, its meta object and the exports that are stories.
 *
 * @remarks
 * Internal to the plugin: the index (`indexStoryFile.ts`) and the Code tab's texts (`storyCode.ts`) read a file the same
 * way through it. Pure.
 *
 * @module
 */
import type { ESTree } from "vite";

import { type Fields, unwrapped } from "./indexFields.ts";
import { moduleName, type NamedExport, namedExports } from "./storyExports.ts";

/** The file's top level, read once: its constants and the properties assigned to names. */
export type TopLevel = {
  /** Each constant's value, by name. */
  readonly values: ReadonlyMap<string, ESTree.Expression>;
  /** The properties assigned to a name after it (`A.storyName = "…"`), by name then property. */
  readonly assigned: ReadonlyMap<string, ReadonlyMap<string, ESTree.Expression>>;
};

/** A property assigned to a name at the top of the file (`A.storyName = "…"`). */
type AssignedProperty = {
  readonly name: string;
  readonly property: string;
  readonly value: ESTree.Expression;
};

/**
 * The property a top-level statement assigns to a name, when it assigns one.
 *
 * @param statement - the statement.
 */
const assignedProperty = (statement: ESTree.Program["body"][number]): AssignedProperty | undefined => {
  if (statement.type !== "ExpressionStatement") return undefined;
  const { expression } = statement;
  if (expression.type !== "AssignmentExpression" || expression.left.type !== "MemberExpression")
    return undefined;
  const { object, property } = expression.left;
  if (object.type !== "Identifier" || property.type !== "Identifier") return undefined;
  return { name: object.name, property: property.name, value: unwrapped(expression.right) };
};

/** A constant declared at the top of the file, with its value. */
type Declared = { readonly name: string; readonly value: ESTree.Expression };

/**
 * The constants a top-level statement declares with a value, exported or not.
 *
 * @param statement - the statement.
 */
const declaredBy = (statement: ESTree.Program["body"][number]): Declared[] => {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  if (declaration?.type !== "VariableDeclaration") return [];
  return declaration.declarations.flatMap(({ id, init }): Declared[] =>
    id.type === "Identifier" && init !== null ? [{ name: id.name, value: unwrapped(init) }] : []
  );
};

/**
 * The file's top level: its constants, exported or not, and the properties assigned to names.
 *
 * @param program - the parsed file.
 */
export const topLevelOf = (program: ESTree.Program): TopLevel => {
  const values = new Map<string, ESTree.Expression>();
  const assigned = new Map<string, Map<string, ESTree.Expression>>();
  for (const statement of program.body) {
    for (const declared of declaredBy(statement)) values.set(declared.name, declared.value);
    const property = assignedProperty(statement);
    if (property === undefined) continue;
    const properties = assigned.get(property.name) ?? new Map<string, ESTree.Expression>();
    properties.set(property.property, property.value);
    assigned.set(property.name, properties);
  }
  return { values, assigned };
};

/**
 * The object a value is, or the one the constants it names lead to (`export const B = A`); `undefined` for any other
 * value, or for names that lead back to themselves.
 *
 * @param top - the file's top level.
 * @param value - the value.
 * @param seen - the names followed so far.
 */
export const objectOf = (
  top: TopLevel,
  value: ESTree.Expression | undefined,
  seen: ReadonlySet<string> = new Set()
): ESTree.ObjectExpression | undefined => {
  if (value?.type === "ObjectExpression") return value;
  if (value?.type !== "Identifier" || seen.has(value.name)) return undefined;
  return objectOf(top, top.values.get(value.name), new Set([...seen, value.name]));
};

/**
 * Whether an export is a story, as the meta's `includeStories` and `excludeStories` say (a list of names or a regular
 * expression, written plainly).
 *
 * @param meta - the meta's fields.
 * @param exportName - the export.
 */
const isIncluded = (meta: Fields, exportName: string): boolean => {
  const matches = (name: string): boolean | undefined => {
    const filter = meta(name);
    if (filter?.type === "ArrayExpression")
      return filter.elements.some((element) => element?.type === "Literal" && element.value === exportName);
    if (filter?.type === "Literal" && "regex" in filter && filter.regex !== undefined)
      return new RegExp(filter.regex.pattern, filter.regex.flags).test(exportName);
    return undefined;
  };
  return matches("includeStories") !== false && matches("excludeStories") !== true;
};

/**
 * The order `__namedExportsOrder` writes, when the file writes one plainly.
 *
 * @param top - the file's top level.
 */
const exportsOrder = (top: TopLevel): readonly string[] | undefined => {
  const order = top.values.get("__namedExportsOrder");
  if (order?.type !== "ArrayExpression") return undefined;
  return order.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
  );
};

/**
 * The meta exported by name (`export { meta as default }`), when it is a constant of the file written as an object.
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 */
const namedMeta = (program: ESTree.Program, top: TopLevel): ESTree.ObjectExpression | undefined => {
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source !== null) continue;
    const specifier = statement.specifiers.find((each) => moduleName(each.exported) === "default");
    if (specifier === undefined) continue;
    const value = top.values.get(moduleName(specifier.local));
    return value?.type === "ObjectExpression" ? value : undefined;
  }
  return undefined;
};

/**
 * The meta's object: the default export, inline or a constant of the file (`export default meta`,
 * `export { meta as default }`).
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 */
export const metaObject = (program: ESTree.Program, top: TopLevel): ESTree.ObjectExpression | undefined => {
  const meta = program.body.find((statement) => statement.type === "ExportDefaultDeclaration");
  if (meta === undefined) return namedMeta(program, top);
  const { declaration } = meta;
  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "ClassDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
  )
    return undefined;
  const expression = unwrapped(declaration);
  const value = expression.type === "Identifier" ? top.values.get(expression.name) : expression;
  return value?.type === "ObjectExpression" ? value : undefined;
};

/**
 * The exports that are stories, in the order of `__namedExportsOrder` when the file writes one, else of the file.
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 * @param meta - the meta's fields, for `includeStories` and `excludeStories`.
 */
export const storyExports = (program: ESTree.Program, top: TopLevel, meta: Fields): NamedExport[] => {
  const exported = namedExports(program).filter(
    ({ exportName }) => exportName !== "__namedExportsOrder" && isIncluded(meta, exportName)
  );
  const order = exportsOrder(top);
  if (order === undefined) return exported;
  const rank = (name: string): number => (order.includes(name) ? order.indexOf(name) : order.length);
  return [...exported].sort((first, second) => rank(first.exportName) - rank(second.exportName));
};
