/**
 * The docs of a function that draws HTML from its args, or of a type written for the args, read from their types and
 * TSDoc: the args with their kind (the panel's group and control), the function's signature and its parts. Shared by
 * the story file's reading and `forgebook new` (`extractDocs.ts`).
 *
 * @remarks
 * The args are the first parameter's properties declared in the package, in declaration order: what comes from
 * `node_modules` (the DOM's own types) is left out. Parts are the keys of the `classNames`, `styles` and `refs` maps,
 * as for every framework.
 *
 * @module
 */
import { basename, dirname } from "node:path";

import type { SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult } from "forgebook/vite/adapter";
import { moduleSummaryOf, summaryOf } from "forgebook/vite/docs-program";
import { declarationOrder, declaredSymbol, isForeign, partsOf, propDocs } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaSubcomponents } from "forgebook/vite/story-meta";
import { guidanceOf } from "forgebook/vite/usage-guidance";
import type ts from "typescript-6";

/** A story file's name before `.stories`: the name a type of args is documented under. */
const STORY_SUFFIX = /\.stories\.[cm]?[jt]sx?$/;

/** The args a function or a type gives. */
type Args = {
  /** Their type, all of them; none when the function takes none. */
  readonly argsType: ts.Type | undefined;
  /** The args the package declares, in declaration order: the ones the docs list. */
  readonly ownArgs: readonly ts.Symbol[];
};

/** The subcomponents' docs and the files they come from. */
export type Subcomponents = {
  /** Their docs, in the order the meta writes them. */
  readonly docs: SubcomponentDocs[];
  /** The files their docs come from. */
  readonly sources: string[];
};

/** No subcomponent, outside a story file. */
export const NO_SUBCOMPONENTS: Subcomponents = { docs: [], sources: [] };

/**
 * A type's own args, ordered from the folder that declares the docs' subject.
 *
 * @param argsType - the type of the args.
 * @param folder - the subject's folder.
 */
const argsOfType = (argsType: ts.Type | undefined, folder: string): Args => ({
  argsType,
  ownArgs: declarationOrder(
    (argsType?.getProperties() ?? []).filter((each) => !isForeign(each)),
    folder
  )
});

/**
 * A function's args: its first parameter's properties, read at the expression that names it.
 *
 * @param symbol - the function's symbol, through its import.
 * @param expression - where the code names it.
 * @param checker - the program's checker.
 * @param file - the file read, the folder when the function has no declaration.
 */
const functionArgs = (
  symbol: ts.Symbol,
  expression: ts.Node,
  checker: ts.TypeChecker,
  file: string
): Args => {
  const [signature] = checker.getTypeOfSymbolAtLocation(symbol, expression).getCallSignatures();
  const parameter = signature?.parameters[0];
  const argsType =
    parameter === undefined
      ? undefined
      : checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(parameter, expression));
  return argsOfType(argsType, dirname(symbol.declarations?.[0]?.getSourceFile().fileName ?? file));
};

/**
 * The files a subject's docs come from: the one declaring it and those declaring its own args.
 *
 * @param symbol - the function's or the type's symbol; none for an anonymous type.
 * @param ownArgs - its own args.
 * @param file - the file read, when the subject has no declaration.
 */
const docsSources = (
  symbol: ts.Symbol | undefined,
  ownArgs: readonly ts.Symbol[],
  file: string
): string[] => [
  symbol?.declarations?.[0]?.getSourceFile().fileName ?? file,
  ...ownArgs.flatMap((each) =>
    (each.declarations ?? []).map((declaration) => declaration.getSourceFile().fileName)
  )
];

/**
 * The docs of the subcomponents a story file's meta names, with the files they come from.
 *
 * @param source - the story file, parsed.
 * @param checker - the program's checker.
 * @returns the docs and their files, or a message naming the subcomponent that cannot be resolved.
 */
export const subcomponentsOf = (source: ts.SourceFile, checker: ts.TypeChecker): Subcomponents | string => {
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const subcomponent of metaSubcomponents(source, checker)) {
    const symbol = declaredSymbol(subcomponent.symbol, checker);
    if (symbol === undefined)
      return `${source.fileName}: the meta's subcomponent ${subcomponent.name} cannot be resolved`;
    const { ownArgs } = functionArgs(symbol, subcomponent.expression, checker, source.fileName);
    docs.push({
      name: subcomponent.name,
      description: summaryOf(symbol, checker),
      props: ownArgs.map((each) => propDocs(each, checker, subcomponent.expression))
    });
    sources.push(...docsSources(symbol, ownArgs, source.fileName));
  }
  return { docs, sources };
};

/**
 * A function's docs and the files they come from, read at the expression that names it.
 *
 * @param symbol - the function's declared symbol.
 * @param expression - where the code names it (the meta's `component`, `typeof` in the meta's type, or the export's
 *   own name).
 * @param checker - the program's checker.
 * @param file - the file read.
 * @param subcomponents - the subcomponents' docs and files.
 */
export const functionDocs = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker,
  file: string,
  subcomponents: Subcomponents
): StoryComponentResult => {
  const { argsType, ownArgs } = functionArgs(symbol, expression, checker, file);
  const declarationFile = symbol.declarations?.[0]?.getSourceFile();
  const sources = docsSources(symbol, ownArgs, file);
  const signature = signatureDocs(symbol, expression, checker);
  return {
    docs: {
      name: symbol.getName(),
      description: summaryOf(symbol, checker),
      summary: declarationFile === undefined ? "" : moduleSummaryOf(declarationFile),
      props: ownArgs.map((each) => propDocs(each, checker, expression)),
      parts: partsOf(argsType, checker, expression),
      subcomponents: subcomponents.docs,
      ...guidanceOf(symbol, checker),
      ...(signature === undefined ? {} : { signature })
    },
    file: sources[0] ?? file,
    sources: [...new Set([...sources, ...subcomponents.sources])]
  };
};

/**
 * The docs of a type written for a story file's args (`Meta<ButtonArgs>`), named after the story file, since no
 * function is there to name them.
 *
 * @param node - the type as the story file writes it.
 * @param checker - the program's checker.
 * @param storyFile - the story file.
 * @param subcomponents - the subcomponents' docs and files.
 */
export const argsTypeDocs = (
  node: ts.TypeNode,
  checker: ts.TypeChecker,
  storyFile: string,
  subcomponents: Subcomponents
): StoryComponentResult => {
  const argsType = checker.getTypeFromTypeNode(node);
  const symbol = argsType.aliasSymbol ?? argsType.getSymbol();
  const declarationFile = symbol?.declarations?.[0]?.getSourceFile();
  const { ownArgs } = argsOfType(argsType, dirname(declarationFile?.fileName ?? storyFile));
  const sources = docsSources(symbol, ownArgs, storyFile);
  return {
    docs: {
      name: basename(storyFile).replace(STORY_SUFFIX, ""),
      description: symbol === undefined ? "" : summaryOf(symbol, checker),
      summary: declarationFile === undefined ? "" : moduleSummaryOf(declarationFile),
      props: ownArgs.map((each) => propDocs(each, checker, node)),
      parts: partsOf(argsType, checker, node),
      subcomponents: subcomponents.docs,
      ...(symbol === undefined ? {} : guidanceOf(symbol, checker))
    },
    file: sources[0] ?? storyFile,
    sources: [...new Set([...sources, ...subcomponents.sources])]
  };
};
