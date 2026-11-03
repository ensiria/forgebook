/**
 * The component of a React story file, read from its types and TSDoc: its props with their kind (the panel's group
 * and control), its events' signatures and its parts. The docs module of `@forgebook/react`: the plugin's worker and
 * `forgebook-docs` load it through the adapter (`forgebook/vite/adapter`).
 *
 * @remarks
 * The component is the meta's `component`. Its props are the first parameter's properties declared in the package:
 * what it passes on to the DOM (`ComponentProps<"button">`) comes from `node_modules` and is left out. Parts are the
 * keys of the `classNames`, `styles` and `refs` maps (the reach-every-part rule).
 *
 * @module
 */
import { dirname } from "node:path";

import type { ComponentDocs, NoComponentDocs, SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult } from "forgebook/vite/adapter";
import { chosenExport, moduleSummaryOf, programFor, summaryOf } from "forgebook/vite/docs-program";
import { declarationOrder, declaredSymbol, isForeign, partsOf, propDocs } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaComponent, metaSubcomponents } from "forgebook/vite/story-meta";
import { guidanceOf } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";

/** The module a React story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/react";

/**
 * The docs of a story file's component.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component's docs, `{ name: null }` when the meta names no component, or a message saying why the file
 * cannot be read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string => {
  const component = extractStoryComponent(storyFile);
  return typeof component === "string" ? component : component.docs;
};

/** A component's props, as its call signature takes them. */
type ComponentProps = {
  /** The type of its props, all of them; none when it takes none. */
  readonly propsType: ts.Type | undefined;
  /** The props its package declares, in declaration order: the ones the docs list. */
  readonly ownProps: readonly ts.Symbol[];
};

/**
 * A component's props, read at the expression that names it.
 *
 * @param symbol - the component's symbol, through its import.
 * @param expression - where the code names it.
 * @param checker - the program's checker.
 * @param storyFile - the story file, the folder when the component has no declaration.
 */
const componentProps = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker,
  storyFile: string
): ComponentProps => {
  const [signature] = checker.getTypeOfSymbolAtLocation(symbol, expression).getCallSignatures();
  const propsSymbol = signature?.parameters[0];
  const propsType =
    propsSymbol === undefined ? undefined : checker.getTypeOfSymbolAtLocation(propsSymbol, expression);
  const ownProps = declarationOrder(
    (propsType?.getProperties() ?? []).filter((prop) => !isForeign(prop)),
    dirname(symbol.declarations?.[0]?.getSourceFile().fileName ?? storyFile)
  );
  return { propsType, ownProps };
};

/**
 * The files a component's docs come from: the one declaring it and those declaring its own props.
 *
 * @param symbol - the component's symbol.
 * @param ownProps - its own props.
 * @param storyFile - the story file, when the component has no declaration.
 */
const docsSources = (symbol: ts.Symbol, ownProps: readonly ts.Symbol[], storyFile: string): string[] => [
  symbol.declarations?.[0]?.getSourceFile().fileName ?? storyFile,
  ...ownProps.flatMap((prop) =>
    (prop.declarations ?? []).map((declaration) => declaration.getSourceFile().fileName)
  )
];

/**
 * The docs of the subcomponents a story file's meta names, with the files they come from.
 *
 * @param source - the story file, parsed.
 * @param checker - the program's checker.
 * @returns the docs and their files, or a message naming the subcomponent that cannot be resolved.
 */
const subcomponentsOf = (
  source: ts.SourceFile,
  checker: ts.TypeChecker
): { readonly docs: SubcomponentDocs[]; readonly sources: string[] } | string => {
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const subcomponent of metaSubcomponents(source, checker)) {
    const symbol = declaredSymbol(subcomponent.symbol, checker);
    if (symbol === undefined) {
      return `${source.fileName}: the meta's subcomponent ${subcomponent.name} cannot be resolved`;
    }
    const { ownProps } = componentProps(symbol, subcomponent.expression, checker, source.fileName);
    docs.push({
      name: subcomponent.name,
      description: summaryOf(symbol, checker),
      props: ownProps.map((prop) => propDocs(prop, checker, subcomponent.expression))
    });
    sources.push(...docsSources(symbol, ownProps, source.fileName));
  }
  return { docs, sources };
};

/**
 * A component's docs and the files they come from, read at the expression that names it.
 *
 * @param symbol - the component's declared symbol.
 * @param expression - where the code names it (the meta's `component`, or the export's own name).
 * @param checker - the program's checker.
 * @param file - the file read, the folder when the component has no declaration.
 * @param subcomponents - the subcomponents' docs and files; none outside a story file.
 */
const componentOf = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker,
  file: string,
  subcomponents: { readonly docs: SubcomponentDocs[]; readonly sources: string[] }
): StoryComponentResult => {
  const { propsType, ownProps } = componentProps(symbol, expression, checker, file);
  const props = ownProps.map((prop) => propDocs(prop, checker, expression));
  const parts = partsOf(propsType, checker, expression);
  const declarationFile = symbol.declarations?.[0]?.getSourceFile();
  const sources = docsSources(symbol, ownProps, file);
  const signature = signatureDocs(symbol, expression, checker);
  return {
    docs: {
      name: symbol.getName(),
      description: summaryOf(symbol, checker),
      summary: declarationFile === undefined ? "" : moduleSummaryOf(declarationFile),
      props,
      parts,
      subcomponents: subcomponents.docs,
      ...guidanceOf(symbol, checker),
      ...(signature === undefined ? {} : { signature })
    },
    file: sources[0] ?? file,
    sources: [...new Set([...sources, ...subcomponents.sources])]
  };
};

/**
 * A story file's component with the file that declares it.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component, `{ docs: { name: null } }` when the meta names none, or a message saying why the file
 * cannot be read.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult => {
  const program = programFor(storyFile);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(storyFile);
  if (source === undefined) return `${storyFile} is not in its program`;
  const expression = metaComponent(source);
  if (expression === undefined) return { docs: { name: null } };
  const symbol = declaredSymbol(checker.getSymbolAtLocation(expression), checker);
  if (symbol === undefined) return `${storyFile}: the meta's component cannot be resolved`;
  const subcomponents = subcomponentsOf(source, checker);
  if (typeof subcomponents === "string") return subcomponents;
  return componentOf(symbol, expression, checker, storyFile, subcomponents);
};

/** Whether an export is a component: a name in PascalCase whose value can be called. */
const isComponentExport = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean =>
  /^[A-Z]/.test(symbol.getName()) &&
  checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures().length > 0;

/**
 * A component a file exports, read from its types, for writing its first stories (`forgebook new`).
 *
 * @param file - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @returns the component, or a message saying why it cannot be read (no component, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult => {
  const program = programFor(file);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(file);
  if (source === undefined) return `${file} is not in its program`;
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return `${file} exports nothing`;
  const components = checker
    .getExportsOfModule(moduleSymbol)
    .filter((each) => isComponentExport(declaredSymbol(each, checker) ?? each, checker, source));
  const chosen = chosenExport(
    components.map((each) => each.getName()),
    exportName,
    file
  );
  if (typeof chosen !== "string") return chosen.problem;
  const export_ = components.find((each) => each.getName() === chosen);
  if (export_ === undefined) return `${file} exports no component ${chosen}`;
  const symbol = declaredSymbol(export_, checker) ?? export_;
  const declaration = symbol.declarations?.[0];
  const name = declaration === undefined ? undefined : ts.getNameOfDeclaration(declaration);
  if (name === undefined || !ts.isIdentifier(name))
    return `${file}: ${export_.getName()} has no name to read it at`;
  return componentOf(symbol, name, checker, file, { docs: [], sources: [] });
};
