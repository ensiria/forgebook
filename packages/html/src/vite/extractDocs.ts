/**
 * The docs of an HTML story file's args, read from their types and TSDoc. The docs module of `@forgebook/html`: the
 * plugin's worker and `forgebook-docs` load it through the adapter (`forgebook/vite/adapter`).
 *
 * @remarks
 * The args are the parameters of the function that draws the story, so they are read from the first typed of: the
 * meta's `component` (`createButton`); the type the meta is checked against (`satisfies Meta<typeof createButton>`, or
 * `Meta<ButtonArgs>` as Storybook's HTML stories write it); the meta's `render`'s first parameter. A story file that
 * types none of them (plain JavaScript, most of all) answers that it names no component, and the panel shows the args
 * its `argTypes` describe.
 *
 * @module
 */
import { basename } from "node:path";

import type { ComponentDocs, NoComponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult, StoryFileShape } from "forgebook/vite/adapter";
import { chosenExport, programFor } from "forgebook/vite/docs-program";
import { declaredSymbol } from "forgebook/vite/prop-docs";
import { metaComponent, metaField, unwrapped } from "forgebook/vite/story-meta";
import ts from "typescript-6";

import {
  argsTypeDocs,
  functionDocs,
  NO_SUBCOMPONENTS,
  type Subcomponents,
  subcomponentsOf
} from "./functionDocs.ts";

/** The module an HTML story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/html";

/**
 * The type argument of the type a story file's default export is checked against: `X` of `satisfies Meta<X>` or
 * `as Meta<X>`.
 *
 * @param source - the story file, parsed.
 */
const metaSubject = (source: ts.SourceFile): ts.TypeNode | undefined => {
  const statement = source.statements.find(
    (each): each is ts.ExportAssignment => ts.isExportAssignment(each) && each.isExportEquals !== true
  );
  let expression = statement?.expression;
  while (expression !== undefined) {
    if (ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression)) {
      const [subject] = ts.isTypeReferenceNode(expression.type) ? (expression.type.typeArguments ?? []) : [];
      if (subject !== undefined) return subject;
    }
    expression =
      ts.isParenthesizedExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAsExpression(expression)
        ? expression.expression
        : undefined;
  }
  return undefined;
};

/**
 * The type the meta's `render` writes for its args: `(args: ButtonArgs) => …`.
 *
 * @param source - the story file, parsed.
 */
const renderArgsType = (source: ts.SourceFile): ts.TypeNode | undefined => {
  const field = metaField(source, "render");
  const render = field === undefined ? undefined : unwrapped(field);
  if (render === undefined || !(ts.isArrowFunction(render) || ts.isFunctionExpression(render)))
    return undefined;
  return render.parameters[0]?.type;
};

/**
 * The docs of a type the story file writes for its args: a function's, for `typeof createButton`; the type's own
 * otherwise.
 *
 * @param node - the type.
 * @param checker - the program's checker.
 * @param storyFile - the story file.
 * @param subcomponents - the subcomponents' docs and files.
 */
const typedDocs = (
  node: ts.TypeNode,
  checker: ts.TypeChecker,
  storyFile: string,
  subcomponents: Subcomponents
): StoryComponentResult => {
  if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) {
    const symbol = declaredSymbol(checker.getSymbolAtLocation(node.exprName), checker);
    if (symbol === undefined) return `${storyFile}: the meta's ${node.exprName.text} cannot be resolved`;
    return functionDocs(symbol, node.exprName, checker, storyFile, subcomponents);
  }
  return argsTypeDocs(node, checker, storyFile, subcomponents);
};

/**
 * A story file's args with the file that declares them.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the docs, `{ docs: { name: null } }` when nothing in the file types the args, or a message saying why the
 * file cannot be read.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult => {
  const program = programFor(storyFile);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(storyFile);
  if (source === undefined) return `${storyFile} is not in its program`;
  const subcomponents = subcomponentsOf(source, checker);
  if (typeof subcomponents === "string") return subcomponents;
  const expression = metaComponent(source);
  if (expression !== undefined) {
    const symbol = declaredSymbol(checker.getSymbolAtLocation(expression), checker);
    if (symbol === undefined) return `${storyFile}: the meta's component cannot be resolved`;
    return functionDocs(symbol, expression, checker, storyFile, subcomponents);
  }
  const typed = metaSubject(source) ?? renderArgsType(source);
  return typed === undefined ? { docs: { name: null } } : typedDocs(typed, checker, storyFile, subcomponents);
};

/**
 * The docs of a story file's args.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the docs, `{ name: null }` when nothing in the file types the args, or a message saying why the file cannot
 * be read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string => {
  const component = extractStoryComponent(storyFile);
  return typeof component === "string" ? component : component.docs;
};

/** Whether an export is a function that can draw: a value that can be called and is not a class. */
const isFunctionExport = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean => {
  const type = checker.getTypeOfSymbolAtLocation(symbol, node);
  return type.getCallSignatures().length > 0 && type.getConstructSignatures().length === 0;
};

/**
 * A function a file exports, read from its types, for writing its first stories (`forgebook new`).
 *
 * @param file - the function's file, absolute.
 * @param exportName - the export to read; the file's only function when none.
 * @returns the docs, or a message saying why it cannot be read (no function, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult => {
  const program = programFor(file);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(file);
  if (source === undefined) return `${file} is not in its program`;
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return `${file} exports nothing`;
  const functions = checker
    .getExportsOfModule(moduleSymbol)
    .filter((each) => isFunctionExport(declaredSymbol(each, checker) ?? each, checker, source));
  const chosen = chosenExport(
    functions.map((each) => each.getName()),
    exportName,
    file
  );
  if (typeof chosen !== "string") return chosen.problem;
  const export_ = functions.find((each) => each.getName() === chosen);
  if (export_ === undefined) return `${file} exports no function ${chosen}`;
  const symbol = declaredSymbol(export_, checker) ?? export_;
  const declaration = symbol.declarations?.[0];
  const name = declaration === undefined ? undefined : ts.getNameOfDeclaration(declaration);
  if (name === undefined || !ts.isIdentifier(name))
    return `${file}: ${export_.getName()} has no name to read it at`;
  return functionDocs(symbol, name, checker, file, NO_SUBCOMPONENTS);
};

/**
 * How a function's first stories file is written: a TypeScript file beside it (its meta is checked with `satisfies`,
 * whatever the function's language), importing it by name.
 *
 * @param name - the function's name.
 * @param file - the function's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => ({
  extension: ".stories.ts",
  importStatement: `import { ${name} } from ${JSON.stringify(`./${basename(file).replace(/\.[cm]?[jt]sx?$/, "")}`)};`
});
