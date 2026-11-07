/**
 * The providers an app's entry wraps it in, written again as a decorator of a preview: what `forgebook init --draw` tries when
 * components fail for want of them.
 *
 * @remarks
 * What the entry mounts is read with the compiler, down from the `render` call: each element holding another is a wrapper, until
 * the one that holds none, which is the app. Its statements are copied as they are, with the imports and top-level constants
 * its props name, the relative imports rewritten for the preview's folder. A wrapper naming anything else (a parameter, a value
 * made in a function) stops the reading there, since a copy could not run; what is outside it is still given. A router
 * provider that renders the app itself holds no children, so it is never mistaken for one. Pure: the entry's text in, a
 * preview's text out. It is the project's code again, in the project's own file, and drawing runs it anyway.
 *
 * @module
 */
import { dirname, relative, resolve } from "node:path";

import ts from "typescript-6";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";

/** The wrappers that change nothing a story needs. */
const NEUTRAL = new Set([
  "StrictMode",
  "React.StrictMode",
  "Suspense",
  "React.Suspense",
  "Fragment",
  "React.Fragment"
]);

/** What providers came to. */
export type LiftedProviders = {
  /** The tags of the wrappers given, outermost first. */
  readonly names: readonly string[];
  /** The preview's text with them. */
  readonly preview: string;
};

/** The JSX an entry's `render` call mounts; none when it mounts none. */
const mounted = (file: ts.SourceFile): ts.JsxElement | ts.JsxSelfClosingElement | undefined => {
  let found: ts.JsxElement | ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node): void => {
    if (found !== undefined) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isRender =
        (ts.isPropertyAccessExpression(callee) && callee.name.text === "render") ||
        (ts.isIdentifier(callee) && callee.text === "render");
      const [first] = node.arguments;
      if (isRender && first !== undefined && (ts.isJsxElement(first) || ts.isJsxSelfClosingElement(first))) {
        found = first;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

/** The element a wrapper holds that may hold the app: the first with children, else none. */
const heldWrapper = (element: ts.JsxElement): ts.JsxElement | undefined =>
  element.children.find((child): child is ts.JsxElement => ts.isJsxElement(child));

/** Whether an element holds the app: one element directly, closed on itself or with children of its own. */
const holdsElement = (element: ts.JsxElement): boolean =>
  element.children.some((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child));

/** The wrappers from the outermost in. */
const wrappersOf = (root: ts.JsxElement | ts.JsxSelfClosingElement): readonly ts.JsxElement[] => {
  const wrappers: ts.JsxElement[] = [];
  let current = ts.isJsxElement(root) ? root : undefined;
  while (current !== undefined && holdsElement(current)) {
    wrappers.push(current);
    current = heldWrapper(current);
  }
  return wrappers;
};

/** The names an expression or element reads. */
const namesIn = (node: ts.Node): ReadonlySet<string> => {
  const names = new Set<string>();
  const visit = (each: ts.Node): void => {
    if (ts.isIdentifier(each)) {
      const parent = each.parent;
      const isMember = ts.isPropertyAccessExpression(parent) && parent.name === each;
      const isKey = (ts.isPropertyAssignment(parent) || ts.isJsxAttribute(parent)) && parent.name === each;
      if (!isMember && !isKey) names.add(each.text);
    }
    ts.forEachChild(each, visit);
  };
  visit(node);
  return names;
};

/** An import's text with its relative path as a file in another folder writes it. */
const importFrom = (
  statement: ts.ImportDeclaration,
  file: ts.SourceFile,
  entryFile: string,
  previewDir: string
): string => {
  const text = statement.getText(file);
  const specifier = statement.moduleSpecifier;
  if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith(".")) return text;
  const moved = VITE_PATHS.normalize(relative(previewDir, resolve(dirname(entryFile), specifier.text)));
  const path = moved.startsWith(".") ? moved : `./${moved}`;
  return text.replace(specifier.getText(file), JSON.stringify(path));
};

/** What a file declares at its top level that a copy can use. */
type TopLevel = {
  /** The import statements, by the names they bind. */
  readonly imports: ReadonlyMap<string, ts.ImportDeclaration>;
  /** The `const` statements, by the names they bind. */
  readonly constants: ReadonlyMap<string, ts.VariableStatement>;
};

/** The names an import binds. */
const importedNames = (statement: ts.ImportDeclaration): readonly string[] => {
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  return [
    ...(clause?.name === undefined ? [] : [clause.name.text]),
    ...(bindings !== undefined && ts.isNamespaceImport(bindings) ? [bindings.name.text] : []),
    ...(bindings !== undefined && ts.isNamedImports(bindings)
      ? bindings.elements.map((element) => element.name.text)
      : [])
  ];
};

/** The names a `const` statement binds. */
const constantNames = (statement: ts.VariableStatement): readonly string[] =>
  statement.declarationList.declarations.flatMap(({ name }) => (ts.isIdentifier(name) ? [name.text] : []));

/** Reads a file's imports and constants. */
const topLevelOf = (file: ts.SourceFile): TopLevel => ({
  imports: new Map(
    file.statements
      .filter(ts.isImportDeclaration)
      .flatMap((statement) => importedNames(statement).map((name) => [name, statement] as const))
  ),
  constants: new Map(
    file.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => constantNames(statement).map((name) => [name, statement] as const))
  )
});

/** The statements a set of names needs, or none when one of them is nothing a copy can reach. */
const statementsFor = (names: ReadonlySet<string>, top: TopLevel, chosen: Set<ts.Statement>): boolean => {
  for (const name of names) {
    const imported = top.imports.get(name);
    if (imported !== undefined) {
      chosen.add(imported);
      continue;
    }
    const constant = top.constants.get(name);
    if (constant === undefined) {
      if (name in globalThis || name === "children") continue;
      return false;
    }
    if (chosen.has(constant)) continue;
    chosen.add(constant);
    if (!statementsFor(namesIn(constant), top, chosen)) return false;
  }
  return true;
};

/**
 * The providers of an app's entry, as a preview.
 *
 * @param entry - the entry's text.
 * @param entryFile - its file, absolute.
 * @param previewFile - the preview's file, absolute.
 * @param previewText - what the preview holds now.
 * @returns them; none when the entry wraps the app in nothing a copy can give.
 */
export const liftedProviders = (
  entry: string,
  entryFile: string,
  previewFile: string,
  previewText: string
): LiftedProviders | undefined => {
  const file = ts.createSourceFile(entryFile, entry, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const root = mounted(file);
  if (root === undefined) return undefined;
  const top = topLevelOf(file);
  const chosen = new Set<ts.Statement>();
  const kept: { readonly name: string; readonly opening: string; readonly closing: string }[] = [];
  for (const wrapper of wrappersOf(root)) {
    const name = wrapper.openingElement.tagName.getText(file);
    if (NEUTRAL.has(name)) continue;
    if (!statementsFor(namesIn(wrapper.openingElement), top, chosen)) break;
    kept.push({
      name,
      opening: wrapper.openingElement.getText(file),
      closing: wrapper.closingElement.getText(file)
    });
  }
  if (kept.length === 0) return undefined;
  const previewDir = dirname(previewFile);
  const statements = file.statements.filter((statement) => chosen.has(statement));
  const copied = statements.map((statement) =>
    ts.isImportDeclaration(statement)
      ? importFrom(statement, file, entryFile, previewDir)
      : statement.getText(file)
  );
  const opening = kept.map((each) => each.opening).join("");
  const closing = [...kept]
    .reverse()
    .map((each) => each.closing)
    .join("");
  return {
    names: kept.map((each) => each.name),
    preview: [
      previewText.trimEnd(),
      'import type { ComponentType } from "react";',
      ...copied,
      "",
      "// what the app's entry wraps it in, for the components that read it: written by `forgebook init --draw`",
      `export default { decorators: [(Story: ComponentType) => ${opening}<Story />${closing}] };`,
      ""
    ].join("\n")
  };
};
