/**
 * One prop of a component read from its types and TSDoc: its kind (the panel's group and control), its type as the source
 * writes it, a choice's values in the source's order, an event's signature. Shared by the frameworks' docs modules: what a
 * prop is does not depend on how a component takes it.
 *
 * @remarks
 * The checker's own order and text follow the types it happened to meet first, which a program kept between reads
 * changes from one read to the next, so what the source writes is preferred wherever it says the same.
 *
 * @module
 */
import { dirname } from "node:path";

import ts from "typescript-6";

import type { EventSignature, MemberDocs, PropDocs, PropKind } from "../componentDocs.ts";
import { summaryOf, tagOf } from "./docsProgram.ts";
import { literalValues, typeAndKind } from "./propKind.ts";
import { propTypeNotes } from "./propTypeNotes.ts";
import { shapeOfProp } from "./shapeDocs.ts";
import { unwrapped } from "./storyMeta.ts";
import {
  type Bindings,
  type DeclaredType,
  type Generics,
  genericFreeText,
  usesTypeParameter
} from "./typeParameters.ts";

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

/**
 * A symbol, through an import to what it names.
 *
 * @param symbol - the symbol at the name.
 * @param checker - the program's checker.
 */
export const declaredSymbol = (
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker
): ts.Symbol | undefined =>
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
 * What puts a choice's values in the order the source writes them: the checker's order follows the order it happened to
 * meet the types in, which a program kept between reads changes from one read to the next.
 *
 * @remarks
 * A prop's shape asks for the order of every union inside it, and a library's unions can hold hundreds of values (an
 * icon's name): the declared values are read once per prop, on the first ask, and each value's place is looked up, not
 * searched for.
 *
 * @param declared - the prop's declared type nodes.
 * @param checker - the type checker.
 * @returns the sorter: given values in the checker's order, those the source writes in its order first, any other
 * after them in the checker's order.
 */
const writtenOrderOf = (
  declared: readonly DeclaredType[],
  checker: ts.TypeChecker
): ((values: readonly (string | number)[]) => (string | number)[]) => {
  let places: Map<string | number, number> | undefined;
  let unwritten = 0;
  return (values: readonly (string | number)[]): (string | number)[] => {
    if (places === undefined) {
      const seen = new Set<ts.Node>();
      const written = declared.flatMap((node) =>
        ts.isMethodSignature(node) ? [] : writtenLiterals(node, checker, seen)
      );
      places = new Map();
      unwritten = written.length;
      // a value written twice keeps its first place, as a search from the start would find it
      for (const [index, value] of written.entries()) if (!places.has(value)) places.set(value, index);
    }
    const known = places;
    const rank = (value: string | number): number => known.get(value) ?? unwritten;
    return [...values].sort((left, right) => rank(left) - rank(right));
  };
};

/** A choice's type as TypeScript writes it, its members in the given order (`"md" | "sm"`). */
const choiceTypeText = (values: readonly (string | number)[]): string =>
  values.map((value) => (typeof value === "string" ? JSON.stringify(value) : String(value))).join(" | ");

/**
 * Declarations by file and position: a prop several variants declare comes with them in the order the checker met
 * the variants, which a program kept between reads changes.
 *
 * @param declarations - the declarations.
 */
const byPosition = (declarations: readonly ts.Declaration[]): ts.Declaration[] =>
  [...declarations].sort(
    (left, right) =>
      left.getSourceFile().fileName.localeCompare(right.getSourceFile().fileName) ||
      left.getStart() - right.getStart()
  );

/**
 * The props in the order the source declares them: those declared in the component's own folder first, then the
 * ones it takes from elsewhere, each by file and position. The checker's order follows the types it met first (an
 * `Omit`'s keys are a union), so a program kept between reads changed it from one read to the next.
 *
 * @param props - the props.
 * @param componentFolder - the folder of the file that declares the component.
 */
export const declarationOrder = (props: readonly ts.Symbol[], componentFolder: string): ts.Symbol[] => {
  const keyOf = (prop: ts.Symbol): [number, string, number] => {
    const [declaration] = byPosition(prop.declarations ?? []);
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

/**
 * A type node's text as the source writes it, on one line; given a checker, each generic type parameter it uses
 * replaced by what it is shown as (`typeParameters.ts`).
 */
const nodeText = (node: ts.Node, generic: Generics | undefined): string =>
  (generic === undefined ? node.getText() : genericFreeText(node, generic))
    // an inline object's TSDoc is the docs' to read, not part of its type
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();

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
 * The names a type node goes by: a plain reference's name as written, the name it was declared with (an import may
 * rename it), and the names of the aliases it is declared through (`type ButtonIcon = IconComponent`); for a union, the
 * names every member goes by, without `undefined`, `null` and `never`. A generic's reference (`ComponentType<Props>`) and a
 * type parameter name no type of their own, so they end the walk.
 *
 * @param node - the type node.
 * @param checker - the type checker, to follow a name to its declaration.
 * @param seen - the nodes already walked, so a recursive alias ends.
 */
const typeNamesOf = (node: ts.TypeNode, checker: ts.TypeChecker, seen: ReadonlySet<ts.Node>): string[] => {
  const bare = bareType(node);
  if (seen.has(bare)) return [];
  const walked = new Set([...seen, bare]);
  if (ts.isUnionTypeNode(bare)) return sharedNames(declaredMembers(bare), checker, walked);
  if (!ts.isTypeReferenceNode(bare) || bare.typeArguments !== undefined) return [];
  const symbol = declaredSymbol(checker.getSymbolAtLocation(bare.typeName), checker);
  if (symbol === undefined || symbol.flags & ts.SymbolFlags.TypeParameter) return [];
  // a default export's symbol is named `default`: its declaration keeps the name it was written with
  const declared = ts.getNameOfDeclaration(symbol.declarations?.[0])?.getText() ?? bare.typeName.getText();
  const alias = symbol.declarations?.find(ts.isTypeAliasDeclaration);
  const through =
    alias !== undefined && !alias.typeParameters ? typeNamesOf(alias.type, checker, walked) : [];
  return [...new Set([bare.typeName.getText(), declared, ...through])];
};

/**
 * The names every one of several type nodes goes by, in the first one's order.
 *
 * @param nodes - the type nodes: a union's members, or a prop's declarations.
 * @param checker - the type checker.
 * @param seen - the nodes already walked.
 */
const sharedNames = (
  nodes: readonly ts.TypeNode[],
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Node>
): string[] => {
  const [first, ...others] = nodes.map((node) => typeNamesOf(node, checker, seen));
  return (first ?? []).filter((name) => others.every((names) => names.includes(name)));
};

/**
 * The names a prop's declared types all go by: what a custom control's `matches` reads. A branch of the props where the
 * prop is `never` takes no value, so it names no type; a method names none.
 *
 * @param declared - the prop's declared types.
 * @param checker - the program's checker.
 */
const writtenTypeNames = (declared: readonly DeclaredType[], checker: ts.TypeChecker): string[] => {
  const taking = declared.filter((node) => ts.isMethodSignature(node) || declaredMembers(node).length > 0);
  const nodes = taking.flatMap((node): ts.TypeNode[] => (ts.isMethodSignature(node) ? [] : [node]));
  return nodes.length === taking.length ? sharedNames(nodes, checker, new Set()) : [];
};

/**
 * A prop's declared type nodes: a property's type (in a type or a class) or a method's whole signature, once per
 * declaration. A prop of props written as alternatives (`{ indicator?: never } | { indicator?: "dot" | "spinner" }`)
 * has one per branch.
 *
 * @param symbol - the prop.
 */
const declaredTypesOf = (symbol: ts.Symbol): DeclaredType[] =>
  byPosition(symbol.declarations ?? []).flatMap((declaration): DeclaredType[] => {
    if (ts.isMethodSignature(declaration)) return [declaration];
    return (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) &&
      declaration.type !== undefined
      ? [declaration.type]
      : [];
  });

/**
 * A prop's type as the source writes it (`ReactNode`, `Ref<HTMLElement>`), without `undefined` and `null`: the
 * checker's own text expands it and orders a union's members by the order it met the types in, which a program kept
 * between reads changes from one read to the next.
 *
 * @param declaredTypes - the prop's declared type nodes.
 * @param generic - the checker and the bindings when the prop's type is still generic, to replace the type parameters
 * its text uses; none to write it as it is.
 * @returns the text, or none when the prop writes no type (the caller falls back to the checker's).
 */
const writtenTypeText = (declaredTypes: readonly DeclaredType[], generic?: Generics): string | undefined => {
  const text = (node: ts.Node): string => nodeText(node, generic);
  const texts = declaredTypes.flatMap((declared): string[] => {
    if (!ts.isMethodSignature(declared)) return declaredMembers(declared).map(text);
    const parameters = declared.parameters.map(text).join(", ");
    return [`(${parameters}) => ${declared.type === undefined ? "void" : text(declared.type)}`];
  });
  // each branch's members once, in the order the branches write them
  const unique = [...new Set(texts)];
  return unique.length === 0 ? undefined : unique.join(" | ");
};

/**
 * A prop's type as the source writes it, or none for the checker's: a text naming a type parameter the component
 * instantiates (`value: TValue` in `BaseProps<string>`) says less than the checker's `string`.
 *
 * @param declared - the prop's declared types.
 * @param generic - the checker and the bindings when the prop's type is still generic.
 * @param checker - the program's checker.
 */
const writtenText = (
  declared: readonly DeclaredType[],
  generic: Generics | undefined,
  checker: ts.TypeChecker
): string | undefined =>
  generic === undefined && usesTypeParameter(declared, checker)
    ? undefined
    : writtenTypeText(declared, generic);

/**
 * An event's signature as the source writes it: a function type among the prop's declared members, or a method.
 *
 * @param declaredTypes - the event prop's declared type nodes.
 * @param generic - the checker and the bindings when the event's type is still generic, as `writtenTypeText` takes them.
 * @returns the signature, or none when the source writes none in place (a named handler type).
 */
const writtenSignature = (
  declaredTypes: readonly DeclaredType[],
  generic: Generics | undefined
): EventSignature | undefined => {
  const nodes = declaredTypes.flatMap((declared): DeclaredType[] =>
    ts.isMethodSignature(declared) ? [declared] : declaredMembers(declared)
  );
  const fn = nodes.find(
    (node): node is ts.MethodSignature | ts.FunctionTypeNode =>
      ts.isMethodSignature(node) || ts.isFunctionTypeNode(node)
  );
  if (fn === undefined) return undefined;
  return {
    parameters: fn.parameters.map((parameter) => ({
      name: nodeText(parameter.name, undefined),
      type: parameter.type === undefined ? "unknown" : nodeText(parameter.type, generic)
    })),
    returns: fn.type === undefined ? "void" : nodeText(fn.type, generic)
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

/** Whether a symbol is declared outside the package (a DOM attribute from React's types). */
export const isForeign = (symbol: ts.Symbol): boolean =>
  (symbol.declarations ?? []).every((declaration) =>
    declaration.getSourceFile().fileName.includes("/node_modules/")
  );

/**
 * Whether a prop's type is a plain object, whose members can be listed one by one as values of their own: not a union,
 * a function, a class's instance, an array or a tuple.
 */
const isMemberedObject = (type: ts.Type, checker: ts.TypeChecker): boolean =>
  (type.flags & ts.TypeFlags.Object) !== 0 &&
  !type.isUnion() &&
  !type.isClass() &&
  type.getCallSignatures().length === 0 &&
  type.getConstructSignatures().length === 0 &&
  !checker.isArrayType(type) &&
  !checker.isTupleType(type);

/**
 * The members of a prop's object type, when the package declares and documents them (`texts?: FileFinderTexts`), in
 * the order the source declares them. The members the type takes from outside the package (an element's attributes)
 * are left out, as the props are, and a type none of whose members has TSDoc lists nothing a reader cannot read from
 * its name. One level only: a member's own members are not read, so a recursive type ends and the docs stay small.
 *
 * @param type - the prop's type, without `undefined`.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 * @returns the members, or none when the type is not such an object.
 */
const membersOf = (type: ts.Type, checker: ts.TypeChecker, node: ts.Node): MemberDocs[] | undefined => {
  if (!isMemberedObject(type, checker)) return undefined;
  const own = type.getProperties().filter((member) => !isForeign(member));
  const [firstDeclaration] = type.getSymbol()?.declarations ?? own[0]?.declarations ?? [];
  const folder = firstDeclaration === undefined ? "" : dirname(firstDeclaration.getSourceFile().fileName);
  const members = declarationOrder(own, folder).map((member): MemberDocs => {
    const defaultValue = tagOf(member, checker, "defaultValue");
    const memberType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(member, node));
    return {
      name: member.getName(),
      type: writtenTypeText(declaredTypesOf(member)) ?? checker.typeToString(memberType),
      description: summaryOf(member, checker),
      ...(defaultValue === undefined ? {} : { defaultValue }),
      isRequired: (member.flags & ts.SymbolFlags.Optional) === 0
    };
  });
  return members.some((member) => member.description !== "") ? members : undefined;
};

/**
 * A prop's place in the reference: the group its TSDoc names (`@group`, as TypeDoc reads it, so a library documented
 * for both writes it once), and the members of its type when it is a documented object. Each only when it has one.
 *
 * @param symbol - the prop.
 * @param kind - its kind: only a prop of kind `other` can be an object.
 * @param type - its type, without `undefined`.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 */
const groupingOf = (
  symbol: ts.Symbol,
  kind: PropKind,
  type: ts.Type,
  checker: ts.TypeChecker,
  node: ts.Node
): Pick<PropDocs, "group" | "members"> => {
  const group = tagOf(symbol, checker, "group");
  const members = kind === "other" ? membersOf(type, checker, node) : undefined;
  return {
    ...(group === undefined || group === "" ? {} : { group }),
    ...(members === undefined ? {} : { members })
  };
};

/**
 * What a prop takes, when it is not its symbol's own type: a framework whose props are wrapped (an Angular signal input,
 * `input<string>()`, takes the `string` its `InputSignal<string>` holds) says what a binding sets.
 */
export type BoundType = {
  /** The type a binding sets. */
  readonly type: ts.Type;
  /**
   * The type node that writes it (`input<"md" | "sm">()`'s argument), for its text and a choice's order; none when the
   * source writes none.
   */
  readonly typeNode: ts.TypeNode | undefined;
};

/** How a framework's props differ from a plain function's, for `propDocs`. */
export type PropReading = {
  /** What the prop takes, when it is not the symbol's own type; none reads the symbol's. */
  readonly taken?: BoundType | undefined;
  /**
   * What an event's name is, for a framework that names its callback props otherwise (Svelte's `onclick`); `on` and a
   * capital by default.
   */
  readonly eventName?: RegExp | undefined;
  /**
   * The same prop as the other variants of a union of props declare it (`selected?: Date` beside `selected?: Date[]`):
   * their written types join its own. When their types differ, what only one of them would say (an event's signature,
   * a value's shape, an object's members) is left out, and its kind is `other` unless all share one.
   */
  readonly variants?: readonly ts.Symbol[] | undefined;
  /**
   * What the props type's type parameters stand for in the component (`typeParameters.ts`), so a type parameter left
   * open is shown by the component's constraint; none reads each by its own.
   */
  readonly bindings?: Bindings | undefined;
};

/**
 * A choice's values across the variants' types that declare it, each once, in the order the source writes them.
 *
 * @param kind - the prop's kind: only a choice has values.
 * @param types - its type in each variant, its own first.
 * @param declared - its declared types, for their order.
 * @param checker - the program's checker.
 */
const choicesOf = (
  kind: PropKind,
  types: readonly ts.Type[],
  declared: readonly DeclaredType[],
  checker: ts.TypeChecker
): (string | number)[] | undefined => {
  if (kind !== "choice") return undefined;
  const lists = types.map(literalValues);
  return lists.every((list) => list !== undefined)
    ? writtenOrderOf(declared, checker)([...new Set(lists.flat())])
    : undefined;
};

/**
 * One prop's docs.
 *
 * @param symbol - the prop: its name, its TSDoc, whether it is optional.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 * @param reading - how the framework's props differ from a plain function's; none for a plain prop.
 */
export const propDocs = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  node: ts.Node,
  reading: PropReading = {}
): PropDocs => {
  const { taken, variants = [] } = reading;
  const takenNodes = taken?.typeNode === undefined ? [] : [taken.typeNode];
  const declared = taken === undefined ? [symbol, ...variants].flatMap(declaredTypesOf) : takenNodes;
  const { type, variantTypes, isMixed, kind, generic } = typeAndKind(symbol, reading, checker, node);
  const name = symbol.getName();
  const defaultValue = tagOf(symbol, checker, "defaultValue");
  const choices = choicesOf(kind, [type, ...variantTypes], declared, checker);
  // what one variant's type says of its values is not true of the others'
  const signature =
    kind === "event" && !isMixed
      ? (writtenSignature(declared, generic) ?? signatureOf(type, checker, node))
      : undefined;
  // a node takes a text: the panel can set it as one, which covers labels, titles and children
  const canTakeText =
    kind === "other" &&
    [type, ...variantTypes].every((each) => checker.isTypeAssignableTo(checker.getStringType(), each));
  const notes = propTypeNotes(declared, type, checker, generic);
  const typeText =
    choices === undefined
      ? (writtenText(declared, generic, checker) ?? checker.typeToString(type))
      : choiceTypeText(choices);
  const typeNames = writtenTypeNames(declared, checker);
  return {
    name,
    kind,
    type: typeText,
    // only when they say more than the type's text
    ...(typeNames.some((each) => each !== typeText) ? { typeNames } : {}),
    description: summaryOf(symbol, checker),
    isRequired: (symbol.flags & ts.SymbolFlags.Optional) === 0,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(choices === undefined ? {} : { choices }),
    ...(signature === undefined ? {} : { signature }),
    ...(canTakeText ? { canTakeText } : {}),
    ...(isMixed
      ? {}
      : {
          ...editingOf(symbol, { kind, type, canTakeText, declared, checker, node }),
          ...groupingOf(symbol, kind, type, checker, node)
        }),
    ...(notes.length === 0 ? {} : { notes })
  };
};

/**
 * How a prop's value is edited, beyond its kind: what it looks like, and the tokens its TSDoc asks for.
 *
 * @param symbol - the prop.
 * @param prop - what is known of it.
 */
const editingOf = (
  symbol: ts.Symbol,
  prop: {
    readonly kind: PropKind;
    readonly type: ts.Type;
    readonly canTakeText: boolean;
    readonly declared: readonly DeclaredType[];
    readonly checker: ts.TypeChecker;
    readonly node: ts.Node;
  }
): Pick<PropDocs, "shape" | "token"> => {
  const { kind, type, canTakeText, declared, checker, node } = prop;
  const shape =
    kind === "other"
      ? shapeOfProp(type, canTakeText, {
          checker,
          node,
          order: writtenOrderOf(declared, checker),
          typeText: (member: ts.Symbol): string | undefined => writtenTypeText(declaredTypesOf(member)),
          description: (member: ts.Symbol): string => summaryOf(member, checker)
        })
      : undefined;
  const token = tagOf(symbol, checker, "token");
  return {
    ...(shape === undefined ? {} : { shape }),
    ...(token === undefined || token === "" ? {} : { token })
  };
};

/** The props whose keys are the component's parts. */
const PART_MAPS = ["classNames", "styles", "refs"];

/**
 * A component's parts: the keys of its `classNames`, `styles` and `refs` maps (the reach-every-part rule).
 *
 * @param propsType - the type of its props, all of them; none when it takes none.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 */
export const partsOf = (
  propsType: ts.Type | undefined,
  checker: ts.TypeChecker,
  node: ts.Node
): readonly string[] => [
  ...new Set(
    (propsType?.getProperties() ?? [])
      .filter((prop) => PART_MAPS.includes(prop.getName()))
      .flatMap((prop) =>
        checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, node)).getProperties()
      )
      .map((part) => part.getName())
  )
];
