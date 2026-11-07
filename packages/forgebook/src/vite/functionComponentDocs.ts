/**
 * The component of a story file whose components are functions of their props (React, Preact, Solid), read from its
 * types and TSDoc: its props with their kind (the panel's group and control), its events' signatures and its parts. The
 * docs modules of those frameworks (`@forgebook/react/docs`, `@forgebook/preact/docs`, `@forgebook/solid/docs`) hand
 * these readers to the plugin's worker and `forgebook-docs` (`adapter.ts`).
 *
 * @remarks
 * The component is the meta's `component`. Its props are the first parameter's properties declared in the package:
 * what it passes on to the DOM (`ComponentProps<"button">`, `JSX.HTMLAttributes`) comes from `node_modules` and is left
 * out. Events are `on*` props. Parts are the keys of the `classNames`, `styles` and `refs` maps (the
 * reach-every-part rule).
 *
 * @module
 */
import { dirname } from "node:path";

import ts from "typescript-6";

import type {
  ComponentDocs,
  NoComponentDocs,
  PropDocs,
  PropsNote,
  SubcomponentDocs
} from "../componentDocs.ts";
import type { ExtractFileComponent, ExtractStoryComponent, StoryComponentResult } from "./adapter.ts";
import { chosenExport, programFor, summaryOf } from "./docsProgram.ts";
import { moduleSummaryOf } from "./moduleSummary.ts";
import { declarationOrder, declaredSymbol, isForeign, partsOf, propDocs } from "./propDocs.ts";
import { signatureDocs } from "./signatureDocs.ts";
import { metaComponent, metaSubcomponents } from "./storyMeta.ts";
import { type Bindings, bindingsOf } from "./typeParameters.ts";
import { propsOfType, type VariantProp } from "./unionProps.ts";
import { guidanceOf } from "./usageGuidance.ts";

/**
 * How a component is called: as a function of its props, or constructed with them into something that renders (a
 * class component, which Preact and React still draw; another class is no component).
 *
 * @param type - the component's type.
 */
const componentSignatures = (type: ts.Type): readonly ts.Signature[] => [
  ...type.getCallSignatures(),
  ...type
    .getConstructSignatures()
    .filter((signature) => signature.getReturnType().getProperty("render") !== undefined)
];

/**
 * The name an export's component is written by: a default export's symbol is named `default`, its declaration by what
 * the file calls it (`export default function Card`).
 *
 * @param symbol - the declared symbol.
 */
const writtenName = (symbol: ts.Symbol): string => {
  const [declaration] = symbol.declarations ?? [];
  const name = declaration === undefined ? undefined : ts.getNameOfDeclaration(declaration);
  return symbol.getName() === "default" && name !== undefined && ts.isIdentifier(name)
    ? name.text
    : symbol.getName();
};

/** A component's props, as its call signature takes them. */
type ComponentProps = {
  /** The type of its props, all of them; none when it takes none. */
  readonly propsType: ts.Type | undefined;
  /** The props its package declares, in declaration order: the ones the docs list. */
  readonly ownProps: readonly ts.Symbol[];
  /** The props only some variants of a union of props declare, with when they can be passed. */
  readonly variantOnly: ReadonlyMap<ts.Symbol, VariantProp>;
  /** What its props type's type parameters stand for, so a generic component's are shown by its own constraints. */
  readonly bindings: Bindings;
  /** Why it lists no props although it takes some; none when its props are read, or it takes none. */
  readonly propsNote: PropsNote | undefined;
};

/**
 * Why a component lists no props although it takes some: it cannot be called with props, its props are `any`, or
 * every one of them is declared outside its package.
 *
 * @param signature - its first call or construct signature, if any.
 * @param propsType - the type of its props, if it takes any.
 * @param listed - how many props it lists.
 * @param all - how many props its props type has, left out ones included.
 */
const propsNoteOf = (
  signature: ts.Signature | undefined,
  propsType: ts.Type | undefined,
  listed: number,
  all: number
): PropsNote | undefined => {
  if (signature === undefined) return { reason: "no-signature" };
  if (propsType === undefined || listed > 0) return undefined;
  if (propsType.flags & ts.TypeFlags.Any) return { reason: "untyped" };
  return all > 0 ? { reason: "outside-package", count: all } : undefined;
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
  const [signature] = componentSignatures(checker.getTypeOfSymbolAtLocation(symbol, expression));
  const propsSymbol = signature?.parameters[0];
  // a class's constructor takes its props as optional (`props?: P`): the props are `P`, not `P | undefined`
  const propsType =
    propsSymbol === undefined
      ? undefined
      : checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(propsSymbol, expression));
  const { props, variantOnly } =
    propsType === undefined ? { props: [], variantOnly: new Map() } : propsOfType(propsType, checker);
  const ownProps = declarationOrder(
    props.filter((prop) => !isForeign(prop)),
    dirname(symbol.declarations?.[0]?.getSourceFile().fileName ?? storyFile)
  );
  return {
    propsType,
    ownProps,
    variantOnly,
    bindings: propsType === undefined ? new Map() : bindingsOf(propsType, checker),
    propsNote: propsNoteOf(signature, propsType, ownProps.length, props.length)
  };
};

/**
 * The docs of a component's listed props: a prop only some variants declare is never required, and says when it can
 * be passed.
 *
 * @param props - the component's props, as `componentProps` read them.
 * @param checker - the program's checker.
 * @param expression - where the code names the component.
 */
const listedProps = (props: ComponentProps, checker: ts.TypeChecker, expression: ts.Expression): PropDocs[] =>
  props.ownProps.map((prop) => {
    const variant = props.variantOnly.get(prop);
    const { bindings } = props;
    if (variant === undefined) return propDocs(prop, checker, expression, { bindings });
    const variants = variant.declarations.filter((declaration) => declaration !== prop);
    const { onlyWhen } = variant;
    return {
      ...propDocs(prop, checker, expression, { variants, bindings }),
      isRequired: false,
      ...(onlyWhen === undefined ? {} : { onlyWhen })
    };
  });

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
    const props = componentProps(symbol, subcomponent.expression, checker, source.fileName);
    docs.push({
      name: subcomponent.name,
      description: summaryOf(symbol, checker),
      props: listedProps(props, checker, subcomponent.expression)
    });
    sources.push(...docsSources(symbol, props.ownProps, source.fileName));
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
  const read = componentProps(symbol, expression, checker, file);
  const { propsType, ownProps, propsNote } = read;
  const props = listedProps(read, checker, expression);
  const parts = partsOf(propsType, checker, expression);
  const declarationFile = symbol.declarations?.[0]?.getSourceFile();
  const sources = docsSources(symbol, ownProps, file);
  const signature = signatureDocs(symbol, expression, checker);
  return {
    docs: {
      name: writtenName(symbol),
      description: summaryOf(symbol, checker),
      summary: declarationFile === undefined ? "" : moduleSummaryOf(declarationFile.text),
      props,
      parts,
      subcomponents: subcomponents.docs,
      ...guidanceOf(symbol, checker),
      ...(signature === undefined ? {} : { signature }),
      ...(propsNote === undefined ? {} : { propsNote })
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
export const functionStoryComponent: ExtractStoryComponent = (storyFile: string): StoryComponentResult => {
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

/**
 * The docs of a story file's component, without the files they come from.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component's docs, `{ name: null }` when the meta names no component, or a message saying why the file
 * cannot be read.
 */
export const functionComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string => {
  const component = functionStoryComponent(storyFile);
  return typeof component === "string" ? component : component.docs;
};

/** Whether an export is a component: a name in PascalCase whose value can be called or constructed. */
const isComponentExport = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean =>
  /^[A-Z]/.test(writtenName(symbol)) &&
  componentSignatures(checker.getTypeOfSymbolAtLocation(symbol, node)).length > 0;

/**
 * A component a file exports, read from its types, for writing its first stories (`forgebook new`).
 *
 * @param file - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @returns the component, or a message saying why it cannot be read (no component, several, a name not exported).
 */
export const functionFileComponent: ExtractFileComponent = (
  file: string,
  exportName?: string
): StoryComponentResult => {
  const program = programFor(file);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(file);
  if (source === undefined) return `${file} is not in its program`;
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return `${file} exports nothing`;
  const exported = checker
    .getExportsOfModule(moduleSymbol)
    .filter((each) => isComponentExport(declaredSymbol(each, checker) ?? each, checker, source));
  // a component exported both by name and as the default is one component, imported by its name unless asked otherwise
  const named = new Set(
    exported.filter((each) => each.getName() !== "default").map((each) => declaredSymbol(each, checker))
  );
  const components = exported.filter(
    (each) =>
      each.getName() !== "default" || exportName === "default" || !named.has(declaredSymbol(each, checker))
  );
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
  const component = componentOf(symbol, name, checker, file, { docs: [], sources: [] });
  return typeof component === "string" || export_.getName() !== "default"
    ? component
    : { ...component, isDefaultExport: true };
};
