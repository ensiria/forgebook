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

import type {
  ComponentDocs,
  EventSignature,
  NoComponentDocs,
  PropDocs,
  PropKind,
  SubcomponentDocs
} from "forgebook/component-docs";
import type { StoryComponentResult } from "forgebook/vite/adapter";
import { moduleSummaryOf, programFor, summaryOf, tagOf } from "forgebook/vite/docs-program";
import { metaComponent, metaField } from "forgebook/vite/story-meta";
import ts from "typescript-6";

import { signatureDocs } from "./extractSignature.ts";

/** The module a React story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/react";

/** The props whose keys are the component's parts. */
const PART_MAPS = ["classNames", "styles", "refs"];

/** An event: a function prop named `on` and a capital. */
const EVENT_NAME = /^on[A-Z]/;

/** A subcomponent the meta names: the name it gives it, and where the code names its value. */
type MetaSubcomponent = {
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
const metaSubcomponents = (source: ts.SourceFile, checker: ts.TypeChecker): MetaSubcomponent[] => {
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

/** Whether a type is a union of string or number literals (a choice). */
const literalValues = (type: ts.Type): (string | number)[] | undefined => {
  if (!type.isUnion()) return undefined;
  const values = type.types.map((member) =>
    member.isStringLiteral() || member.isNumberLiteral() ? member.value : undefined
  );
  return values.every((value) => value !== undefined)
    ? values.filter((value) => value !== undefined)
    : undefined;
};

/** A literal value an expression writes (`"md"`, `3`, `-1`), or none for anything else. */
const literalOfExpression = (expression: ts.Expression): string | number | undefined => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }
  return undefined;
};

/** An expression without the wrappers around a literal list (`as const`, `satisfies`, parentheses). */
const unwrapped = (expression: ts.Expression): ts.Expression => {
  let inner = expression;
  while (ts.isAsExpression(inner) || ts.isSatisfiesExpression(inner) || ts.isParenthesizedExpression(inner)) {
    inner = inner.expression;
  }
  return inner;
};

/** A symbol, through an import to what it names. */
const declaredSymbol = (symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Symbol | undefined =>
  symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

/** The value a literal type node writes (`"md"`, `3`, `-1`), or none for another literal (`true`, `null`). */
const literalTypeValue = (node: ts.LiteralTypeNode): (string | number)[] => {
  const literal = node.literal;
  const value =
    ts.isLiteralExpression(literal) || ts.isPrefixUnaryExpression(literal)
      ? literalOfExpression(literal)
      : undefined;
  return value === undefined ? [] : [value];
};

/** The values a tuple query writes (`(typeof SIZES)[number]` with `SIZES = ["md", "sm"] as const`), in its order. */
const tupleValues = (node: ts.IndexedAccessTypeNode, checker: ts.TypeChecker): (string | number)[] => {
  let object = node.objectType;
  while (ts.isParenthesizedTypeNode(object)) object = object.type;
  if (!ts.isTypeQueryNode(object)) return [];
  const variable = declaredSymbol(checker.getSymbolAtLocation(object.exprName), checker)?.valueDeclaration;
  if (variable === undefined || !ts.isVariableDeclaration(variable) || variable.initializer === undefined)
    return [];
  const list = unwrapped(variable.initializer);
  if (!ts.isArrayLiteralExpression(list)) return [];
  return list.elements.flatMap((element) => {
    const value = literalOfExpression(element);
    return value === undefined ? [] : [value];
  });
};

/** The keys an object query writes (`keyof typeof TEXT_STYLES`), in the order the object writes them. */
const keyValues = (node: ts.TypeOperatorNode, checker: ts.TypeChecker): string[] => {
  if (node.operator !== ts.SyntaxKind.KeyOfKeyword || !ts.isTypeQueryNode(node.type)) return [];
  const variable = declaredSymbol(checker.getSymbolAtLocation(node.type.exprName), checker)?.valueDeclaration;
  if (variable === undefined || !ts.isVariableDeclaration(variable) || variable.initializer === undefined)
    return [];
  const object = unwrapped(variable.initializer);
  if (!ts.isObjectLiteralExpression(object)) return [];
  return object.properties.flatMap((property) => {
    const name = property.name;
    return name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? [name.text] : [];
  });
};

/**
 * The values an indexed type writes: a tuple's members (`(typeof SIZES)[number]`), or another type's prop as that
 * type declares it (`PopoverProps["side"]`).
 *
 * @param node - the indexed type.
 * @param checker - the type checker.
 * @param seen - the nodes already walked.
 */
const accessedValues = (
  node: ts.IndexedAccessTypeNode,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): (string | number)[] => {
  const index = node.indexType;
  if (!ts.isLiteralTypeNode(index) || !ts.isStringLiteral(index.literal)) return tupleValues(node, checker);
  const prop = checker.getPropertyOfType(checker.getTypeFromTypeNode(node.objectType), index.literal.text);
  return (prop?.declarations ?? []).flatMap((declaration) =>
    ts.isPropertySignature(declaration) && declaration.type !== undefined
      ? writtenLiterals(declaration.type, checker, seen)
      : []
  );
};

/**
 * The literal values a type node writes, in the order it writes them: through unions, aliases and a tuple's members.
 *
 * @param node - the type node.
 * @param checker - the type checker, to follow a name to its declaration.
 * @param seen - the nodes already walked, so a recursive alias ends.
 */
const writtenLiterals = (
  node: ts.TypeNode,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): (string | number)[] => {
  if (seen.has(node)) return [];
  seen.add(node);
  if (ts.isParenthesizedTypeNode(node)) return writtenLiterals(node.type, checker, seen);
  if (ts.isUnionTypeNode(node)) return node.types.flatMap((member) => writtenLiterals(member, checker, seen));
  if (ts.isLiteralTypeNode(node)) return literalTypeValue(node);
  if (ts.isIndexedAccessTypeNode(node)) return accessedValues(node, checker, seen);
  if (ts.isTypeOperatorNode(node)) return keyValues(node, checker);
  if (!ts.isTypeReferenceNode(node)) return [];
  // a generic's arguments first (`Exclude<TableVariant, "changes">`): the values it keeps come from them
  const fromArguments = (node.typeArguments ?? []).flatMap((argument) =>
    writtenLiterals(argument, checker, seen)
  );
  const alias = declaredSymbol(checker.getSymbolAtLocation(node.typeName), checker)?.declarations?.find(
    ts.isTypeAliasDeclaration
  );
  return [...fromArguments, ...(alias === undefined ? [] : writtenLiterals(alias.type, checker, seen))];
};

/**
 * A choice's values in the order the source writes them: the checker's order follows the order it happened to meet
 * the types in, which a program kept between reads changes from one read to the next.
 *
 * @param values - the values, in the checker's order.
 * @param symbol - the prop.
 * @param checker - the type checker.
 * @returns the values, those the source writes in its order first, any other after them in the checker's order.
 */
const writtenOrder = (
  values: readonly (string | number)[],
  symbol: ts.Symbol,
  checker: ts.TypeChecker
): (string | number)[] => {
  const seen = new Set<ts.Node>();
  const written = declaredTypesOf(symbol).flatMap((node) =>
    ts.isMethodSignature(node) ? [] : writtenLiterals(node, checker, seen)
  );
  const rank = (value: string | number): number => {
    const index = written.indexOf(value);
    return index === -1 ? written.length : index;
  };
  return [...values].sort((left, right) => rank(left) - rank(right));
};

/** A choice's type as TypeScript writes it, its members in the given order (`"md" | "sm"`). */
const choiceTypeText = (values: readonly (string | number)[]): string =>
  values.map((value) => (typeof value === "string" ? JSON.stringify(value) : String(value))).join(" | ");

/**
 * The props in the order the source declares them: those declared in the component's own folder first, then the
 * ones it takes from elsewhere, each by file and position. The checker's order follows the types it met first (an
 * `Omit`'s keys are a union), so a program kept between reads changed it from one read to the next.
 *
 * @param props - the props.
 * @param componentFolder - the folder of the file that declares the component.
 */
const declarationOrder = (props: readonly ts.Symbol[], componentFolder: string): ts.Symbol[] => {
  const keyOf = (prop: ts.Symbol): [number, string, number] => {
    const [declaration] = prop.declarations ?? [];
    if (declaration === undefined) return [2, "", 0];
    const file = declaration.getSourceFile().fileName;
    return [dirname(file) === componentFolder ? 0 : 1, file, declaration.getStart()];
  };
  return [...props].sort((left, right) => {
    const [leftOwn, leftFile, leftAt] = keyOf(left);
    const [rightOwn, rightFile, rightAt] = keyOf(right);
    return leftOwn - rightOwn || leftFile.localeCompare(rightFile) || leftAt - rightAt;
  });
};

/** A type node's text as the source writes it, on one line. */
const nodeText = (node: ts.Node): string => node.getText().replace(/\s+/g, " ").trim();

/**
 * Whether a type node adds nothing a prop can take: `undefined` and `null` (left out as the checker's `NonNullable`
 * did) and `never` (a branch of the props where the prop is not allowed).
 */
const isNothing = (node: ts.TypeNode): boolean =>
  node.kind === ts.SyntaxKind.UndefinedKeyword ||
  node.kind === ts.SyntaxKind.NeverKeyword ||
  (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword);

/** A type node without its parentheses. */
const bareType = (node: ts.TypeNode): ts.TypeNode =>
  ts.isParenthesizedTypeNode(node) ? bareType(node.type) : node;

/**
 * A prop's declared type without what adds nothing (`undefined`, `null`, `never`): the members of a written union, or
 * the node itself.
 *
 * @param node - the prop's declared type.
 */
const declaredMembers = (node: ts.TypeNode): ts.TypeNode[] => {
  const bare = bareType(node);
  return (ts.isUnionTypeNode(bare) ? bare.types : [bare]).filter((member) => !isNothing(member));
};

/**
 * A prop's declared type nodes: a property's type or a method's whole signature, once per declaration. A prop of
 * props written as alternatives (`{ indicator?: never } | { indicator?: "dot" | "spinner" }`) has one per branch.
 *
 * @param symbol - the prop.
 */
const declaredTypesOf = (symbol: ts.Symbol): (ts.TypeNode | ts.MethodSignature)[] =>
  (symbol.declarations ?? []).flatMap((declaration): (ts.TypeNode | ts.MethodSignature)[] => {
    if (ts.isMethodSignature(declaration)) return [declaration];
    return ts.isPropertySignature(declaration) && declaration.type !== undefined ? [declaration.type] : [];
  });

/**
 * A prop's type as the source writes it (`ReactNode`, `Ref<HTMLElement>`), without `undefined` and `null`: the
 * checker's own text expands it and orders a union's members by the order it met the types in, which a program kept
 * between reads changes from one read to the next.
 *
 * @param symbol - the prop.
 * @returns the text, or none when the prop writes no type (the caller falls back to the checker's).
 */
const writtenTypeText = (symbol: ts.Symbol): string | undefined => {
  const texts = declaredTypesOf(symbol).flatMap((declared): string[] => {
    if (!ts.isMethodSignature(declared)) return declaredMembers(declared).map(nodeText);
    const parameters = declared.parameters.map(nodeText).join(", ");
    return [`(${parameters}) => ${declared.type === undefined ? "void" : nodeText(declared.type)}`];
  });
  // each branch's members once, in the order the branches write them
  const unique = [...new Set(texts)];
  return unique.length === 0 ? undefined : unique.join(" | ");
};

/**
 * An event's signature as the source writes it: a function type among the prop's declared members, or a method.
 *
 * @param symbol - the event prop.
 * @returns the signature, or none when the source writes none in place (a named handler type).
 */
const writtenSignature = (symbol: ts.Symbol): EventSignature | undefined => {
  const nodes = declaredTypesOf(symbol).flatMap((declared): (ts.TypeNode | ts.MethodSignature)[] =>
    ts.isMethodSignature(declared) ? [declared] : declaredMembers(declared)
  );
  const fn = nodes.find(
    (node): node is ts.MethodSignature | ts.FunctionTypeNode =>
      ts.isMethodSignature(node) || ts.isFunctionTypeNode(node)
  );
  if (fn === undefined) return undefined;
  return {
    parameters: fn.parameters.map((parameter) => ({
      name: nodeText(parameter.name),
      type: parameter.type === undefined ? "unknown" : nodeText(parameter.type)
    })),
    returns: fn.type === undefined ? "void" : nodeText(fn.type)
  };
};

/** An event's signature. */
const signatureOf = (type: ts.Type, checker: ts.TypeChecker, node: ts.Node): EventSignature | undefined => {
  const [signature] = type.getCallSignatures();
  if (signature === undefined) return undefined;
  return {
    parameters: signature.parameters.map((parameter) => ({
      name: parameter.getName(),
      type: checker.typeToString(checker.getTypeOfSymbolAtLocation(parameter, node))
    })),
    returns: checker.typeToString(signature.getReturnType())
  };
};

/** A prop's kind, from its name and its type without `undefined`. */
const kindOf = (name: string, type: ts.Type): PropKind => {
  if (EVENT_NAME.test(name) && type.getCallSignatures().length > 0) return "event";
  if (type.flags & ts.TypeFlags.Boolean || type.flags & ts.TypeFlags.BooleanLiteral) return "toggle";
  if (literalValues(type) !== undefined) return "choice";
  if (type.flags & ts.TypeFlags.String) return "text";
  if (type.flags & ts.TypeFlags.Number) return "number";
  return "other";
};

/** Whether a symbol is declared outside the package (a DOM attribute from React's types). */
const isForeign = (symbol: ts.Symbol): boolean =>
  (symbol.declarations ?? []).every((declaration) =>
    declaration.getSourceFile().fileName.includes("/node_modules/")
  );

/** One prop's docs. */
const propDocs = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): PropDocs => {
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, node));
  const name = symbol.getName();
  const kind = kindOf(name, type);
  const defaultValue = tagOf(symbol, checker, "defaultValue");
  const checkerChoices = kind === "choice" ? literalValues(type) : undefined;
  const choices = checkerChoices === undefined ? undefined : writtenOrder(checkerChoices, symbol, checker);
  const signature =
    kind === "event" ? (writtenSignature(symbol) ?? signatureOf(type, checker, node)) : undefined;
  // a node takes a text: the panel can set it as one, which covers labels, titles and children
  const canTakeText = kind === "other" && checker.isTypeAssignableTo(checker.getStringType(), type);
  return {
    name,
    kind,
    type:
      choices === undefined
        ? (writtenTypeText(symbol) ?? checker.typeToString(type))
        : choiceTypeText(choices),
    description: summaryOf(symbol, checker),
    isRequired: (symbol.flags & ts.SymbolFlags.Optional) === 0,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(choices === undefined ? {} : { choices }),
    ...(signature === undefined ? {} : { signature }),
    ...(canTakeText ? { canTakeText } : {})
  };
};

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
  const parts = [
    ...new Set(
      (propsType?.getProperties() ?? [])
        .filter((prop) => PART_MAPS.includes(prop.getName()))
        .flatMap((prop) =>
          checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, expression)).getProperties()
        )
        .map((part) => part.getName())
    )
  ];
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
 * The component asked for among a file's: the one named, or the only one.
 *
 * @returns the export, or a message naming the components when there is none or several.
 */
const chosenComponent = (
  components: readonly ts.Symbol[],
  exportName: string | undefined,
  file: string
): ts.Symbol | string => {
  const chosen =
    exportName === undefined ? components : components.filter((each) => each.getName() === exportName);
  const [only] = chosen;
  if (only !== undefined && chosen.length === 1) return only;
  const names = components.map((each) => each.getName()).join(", ") || "none";
  return exportName === undefined
    ? `${file} exports ${components.length === 0 ? "no component" : `several components (${names})`}: name one`
    : `${file} exports no component ${exportName} (its components: ${names})`;
};

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
  const export_ = chosenComponent(components, exportName, file);
  if (typeof export_ === "string") return export_;
  const symbol = declaredSymbol(export_, checker) ?? export_;
  const declaration = symbol.declarations?.[0];
  const name = declaration === undefined ? undefined : ts.getNameOfDeclaration(declaration);
  if (name === undefined || !ts.isIdentifier(name))
    return `${file}: ${export_.getName()} has no name to read it at`;
  return componentOf(symbol, name, checker, file, { docs: [], sources: [] });
};
