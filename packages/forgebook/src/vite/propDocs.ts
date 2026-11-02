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

import type { EventSignature, PropDocs, PropKind } from "../componentDocs.ts";
import { summaryOf, tagOf } from "./docsProgram.ts";
import { unwrapped } from "./storyMeta.ts";

/** An event: a function prop named `on` and a capital. */
const EVENT_NAME = /^on[A-Z]/;

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
 * A choice's values in the order the source writes them: the checker's order follows the order it happened to meet
 * the types in, which a program kept between reads changes from one read to the next.
 *
 * @param values - the values, in the checker's order.
 * @param declared - the prop's declared type nodes.
 * @param checker - the type checker.
 * @returns the values, those the source writes in its order first, any other after them in the checker's order.
 */
const writtenOrder = (
  values: readonly (string | number)[],
  declared: readonly DeclaredType[],
  checker: ts.TypeChecker
): (string | number)[] => {
  const seen = new Set<ts.Node>();
  const written = declared.flatMap((node) =>
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
export const declarationOrder = (props: readonly ts.Symbol[], componentFolder: string): ts.Symbol[] => {
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

/** A prop's type as declared: a type node, or a method's whole signature. */
type DeclaredType = ts.TypeNode | ts.MethodSignature;

/**
 * A prop's declared type nodes: a property's type (in a type or a class) or a method's whole signature, once per
 * declaration. A prop of props written as alternatives (`{ indicator?: never } | { indicator?: "dot" | "spinner" }`)
 * has one per branch.
 *
 * @param symbol - the prop.
 */
const declaredTypesOf = (symbol: ts.Symbol): DeclaredType[] =>
  (symbol.declarations ?? []).flatMap((declaration): DeclaredType[] => {
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
 * @returns the text, or none when the prop writes no type (the caller falls back to the checker's).
 */
const writtenTypeText = (declaredTypes: readonly DeclaredType[]): string | undefined => {
  const texts = declaredTypes.flatMap((declared): string[] => {
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
 * @param declaredTypes - the event prop's declared type nodes.
 * @returns the signature, or none when the source writes none in place (a named handler type).
 */
const writtenSignature = (declaredTypes: readonly DeclaredType[]): EventSignature | undefined => {
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
export const isForeign = (symbol: ts.Symbol): boolean =>
  (symbol.declarations ?? []).every((declaration) =>
    declaration.getSourceFile().fileName.includes("/node_modules/")
  );

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

/**
 * One prop's docs.
 *
 * @param symbol - the prop: its name, its TSDoc, whether it is optional.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 * @param taken - what the prop takes, when it is not the symbol's own type; none reads the symbol's.
 */
export const propDocs = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  node: ts.Node,
  taken?: BoundType
): PropDocs => {
  const type = checker.getNonNullableType(taken?.type ?? checker.getTypeOfSymbolAtLocation(symbol, node));
  const takenNodes = taken?.typeNode === undefined ? [] : [taken.typeNode];
  const declared = taken === undefined ? declaredTypesOf(symbol) : takenNodes;
  const name = symbol.getName();
  const kind = kindOf(name, type);
  const defaultValue = tagOf(symbol, checker, "defaultValue");
  const checkerChoices = kind === "choice" ? literalValues(type) : undefined;
  const choices = checkerChoices === undefined ? undefined : writtenOrder(checkerChoices, declared, checker);
  const signature =
    kind === "event" ? (writtenSignature(declared) ?? signatureOf(type, checker, node)) : undefined;
  // a node takes a text: the panel can set it as one, which covers labels, titles and children
  const canTakeText = kind === "other" && checker.isTypeAssignableTo(checker.getStringType(), type);
  return {
    name,
    kind,
    type:
      choices === undefined
        ? (writtenTypeText(declared) ?? checker.typeToString(type))
        : choiceTypeText(choices),
    description: summaryOf(symbol, checker),
    isRequired: (symbol.flags & ts.SymbolFlags.Optional) === 0,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(choices === undefined ? {} : { choices }),
    ...(signature === undefined ? {} : { signature }),
    ...(canTakeText ? { canTakeText } : {})
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
