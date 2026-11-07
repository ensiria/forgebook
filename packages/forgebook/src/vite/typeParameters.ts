/**
 * A generic component's props, written without the type parameters it leaves open: each one shown as its constraint,
 * else its default, else `unknown`. Used by `propDocs.ts` and `propTypeNotes.ts`.
 *
 * @remarks
 * A prop's text is the one its props type writes (`items: readonly T[]` in `ListProps<T>`), whose `T` is the props
 * type's parameter, while what bounds it is the component's (`<TItem extends string>(props: ListProps<TItem>)`). The
 * props type's parameters are followed to the types the component passes (`bindingsOf`), so the constraint shown is
 * the component's. The replacement is made in the source's text, since the checker's instantiation is not public API.
 *
 * @module
 */
import ts from "typescript-6";

import type { PropTypeNote } from "../componentDocs.ts";

/** A prop's type as declared: a type node, or a method's whole signature. */
export type DeclaredType = ts.TypeNode | ts.MethodSignature;

/** What the props type's parameters stand for in one component: the types it passes them (`ListProps<TItem>`). */
export type Bindings = ReadonlyMap<ts.TypeParameterDeclaration, ts.Type>;

/** What replacing a component's type parameters needs: the checker, and what the props type's parameters stand for. */
export type Generics = {
  /** The program's checker. */
  readonly checker: ts.TypeChecker;
  /** The props type's parameters, bound to what the component passes. */
  readonly bindings: Bindings;
};

/** How deep a type is walked: deep enough for a list of callbacks or a props type built on others; a recursive type ends. */
const TYPE_DEPTH = 4;

/** Whether a type is a generic's instance (`Array<TItem>`), whose type arguments the checker lists. */
const isReference = (type: ts.Type): type is ts.TypeReference =>
  (type.flags & ts.TypeFlags.Object) !== 0 && "target" in type;

/** A type parameter's declaration, when the type is one. */
const parameterOf = (type: ts.Type): ts.TypeParameterDeclaration | undefined =>
  type.flags & ts.TypeFlags.TypeParameter
    ? type.getSymbol()?.declarations?.find(ts.isTypeParameterDeclaration)
    : undefined;

/**
 * What each type parameter of a props type stands for in this component: an alias's (`type P<T>`) and an interface's,
 * its bases' included, through unions and intersections.
 *
 * @param propsType - the component's props type, as its signature takes it.
 * @param checker - the program's checker.
 */
export const bindingsOf = (propsType: ts.Type, checker: ts.TypeChecker): Bindings => {
  const bindings = new Map<ts.TypeParameterDeclaration, ts.Type>();
  const visit = (type: ts.Type, depth: number): void => {
    if (depth === 0) return;
    for (const [parameter, bound] of typeArgumentsOf(type, checker)) {
      if (!bindings.has(parameter)) bindings.set(parameter, bound);
    }
    const inner = type.isUnionOrIntersection() ? type.types : [];
    const bases =
      isReference(type) && type.target.isClassOrInterface() ? checker.getBaseTypes(type.target) : [];
    for (const each of [...inner, ...bases]) visit(each, depth - 1);
  };
  visit(propsType, TYPE_DEPTH);
  return bindings;
};

/**
 * The type arguments one type was made with, by the parameter each fills: an alias's (`P<TItem>`) and a generic
 * interface's.
 *
 * @param type - the type.
 * @param checker - the program's checker.
 */
const typeArgumentsOf = (
  type: ts.Type,
  checker: ts.TypeChecker
): (readonly [ts.TypeParameterDeclaration, ts.Type])[] => {
  const pairs = (
    parameters: readonly (ts.TypeParameterDeclaration | undefined)[],
    types: readonly ts.Type[]
  ): (readonly [ts.TypeParameterDeclaration, ts.Type])[] =>
    parameters.flatMap((parameter, index) => {
      const bound = types[index];
      return parameter === undefined || bound === undefined ? [] : [[parameter, bound] as const];
    });
  const alias = type.aliasSymbol?.declarations?.find(ts.isTypeAliasDeclaration);
  const fromAlias = pairs(alias?.typeParameters ?? [], type.aliasTypeArguments ?? []);
  if (!isReference(type)) return fromAlias;
  return [
    ...fromAlias,
    ...pairs((type.target.typeParameters ?? []).map(parameterOf), checker.getTypeArguments(type))
  ];
};

/** What a props type's parameter comes to: another type parameter (the component's, open), or a type it was given. */
type Resolved =
  | { readonly parameter: ts.TypeParameterDeclaration; readonly type?: never }
  | { readonly type: ts.Type; readonly parameter?: never };

/**
 * What a type parameter comes to, following the bindings from the props type's parameter to the component's.
 *
 * @param declaration - the type parameter a type writes.
 * @param bindings - what the props type's parameters stand for.
 */
const resolved = (declaration: ts.TypeParameterDeclaration, bindings: Bindings): Resolved => {
  const seen = new Set<ts.TypeParameterDeclaration>();
  let current = declaration;
  for (;;) {
    const bound = bindings.get(current);
    if (bound === undefined) return { parameter: current };
    const next = parameterOf(bound);
    if (next === undefined) return { type: bound };
    if (next === current || seen.has(next)) return { parameter: next };
    seen.add(current);
    current = next;
  }
};

/** A use of a type parameter the prop's type does not declare itself: one the props type or the component takes. */
type ParameterUse = {
  /** Where the type writes it. */
  readonly reference: ts.TypeReferenceNode;
  /** Its declaration. */
  readonly declaration: ts.TypeParameterDeclaration;
};

/** Whether a node lies inside another. */
const isWithin = (node: ts.Node, outer: ts.Node): boolean =>
  node.getSourceFile() === outer.getSourceFile() && node.pos >= outer.pos && node.end <= outer.end;

/**
 * Every type reference a node writes, in source order.
 *
 * @param node - the node.
 */
export const referencesIn = (node: ts.Node): ts.TypeReferenceNode[] => {
  const found: ts.TypeReferenceNode[] = [];
  const visit = (each: ts.Node): void => {
    if (ts.isTypeReferenceNode(each)) found.push(each);
    ts.forEachChild(each, visit);
  };
  visit(node);
  return found;
};

/**
 * The type parameters a node uses and does not declare itself (a function type's own `<T>` stays as written).
 *
 * @param node - the prop's declared type, or a constraint.
 * @param checker - the program's checker.
 */
const parameterUses = (node: ts.Node, checker: ts.TypeChecker): ParameterUse[] =>
  referencesIn(node).flatMap((reference): ParameterUse[] => {
    const symbol = checker.getSymbolAtLocation(reference.typeName);
    const declaration = symbol?.declarations?.find(ts.isTypeParameterDeclaration);
    return declaration === undefined || isWithin(declaration, node) ? [] : [{ reference, declaration }];
  });

/**
 * Whether a prop's declared types name a type parameter of the props type: their text then says `TValue` where a props
 * type the component instantiates (`BaseProps<string>`) means `string`.
 *
 * @param declared - the prop's declared types.
 * @param checker - the program's checker.
 */
export const usesTypeParameter = (declared: readonly DeclaredType[], checker: ts.TypeChecker): boolean =>
  declared.some((node) => parameterUses(node, checker).length > 0);

/** What a type parameter is shown as: its constraint, else its default; none for `unknown`. */
const shownAs = (declaration: ts.TypeParameterDeclaration): ts.TypeNode | undefined =>
  declaration.constraint ?? declaration.default;

/** Whether a type written in a name's stead needs parentheses there (`readonly (A | B)[]`). */
const needsParentheses = (reference: ts.TypeReferenceNode, isLoose: boolean): boolean => {
  const { parent } = reference;
  return (
    isLoose &&
    (ts.isArrayTypeNode(parent) ||
      ts.isIndexedAccessTypeNode(parent) ||
      ts.isTypeOperatorNode(parent) ||
      ts.isUnionTypeNode(parent) ||
      ts.isIntersectionTypeNode(parent))
  );
};

/** Whether a type node binds looser than an array's element (a union, a function, a conditional, an operator). */
const isLooseNode = (node: ts.TypeNode): boolean =>
  ts.isUnionTypeNode(node) ||
  ts.isIntersectionTypeNode(node) ||
  ts.isFunctionTypeNode(node) ||
  ts.isConstructorTypeNode(node) ||
  ts.isConditionalTypeNode(node) ||
  ts.isTypeOperatorNode(node);

/**
 * The text that replaces a type parameter: the type the component gives it, or the component's own parameter's
 * constraint or default as written, `unknown` when it has neither.
 *
 * @param use - the type parameter's use.
 * @param generics - the checker and the bindings.
 * @param seen - the type parameters being replaced, so a constraint naming its own parameter ends.
 */
const replacementText = (
  { reference, declaration }: ParameterUse,
  generics: Generics,
  seen: ReadonlySet<ts.TypeParameterDeclaration>
): string => {
  const target = resolved(declaration, generics.bindings);
  if (target.type !== undefined) {
    const text = generics.checker.typeToString(target.type);
    return needsParentheses(reference, target.type.isUnionOrIntersection()) ? `(${text})` : text;
  }
  const node = shownAs(target.parameter);
  if (node === undefined) return "unknown";
  // a constraint may name another type parameter (`TName extends FieldPath<TValues>`): it is replaced too, once
  const text = seen.has(target.parameter)
    ? target.parameter.name.text
    : genericFreeText(node, generics, new Set([...seen, target.parameter]));
  return needsParentheses(reference, isLooseNode(node)) ? `(${text})` : text;
};

/**
 * A node's source text with each type parameter it uses replaced by what it is shown as.
 *
 * @param node - the prop's declared type (or one member of it), or a constraint.
 * @param generics - the checker and the bindings.
 * @param seen - the type parameters being replaced.
 * @returns the text, as `getText()` would give it with the replacements made.
 */
export const genericFreeText = (
  node: ts.Node,
  generics: Generics,
  seen: ReadonlySet<ts.TypeParameterDeclaration> = new Set()
): string => {
  const text = node.getSourceFile().text;
  let written = "";
  let at = node.getStart();
  for (const use of parameterUses(node, generics.checker)) {
    written += text.slice(at, use.reference.getStart()) + replacementText(use, generics, seen);
    at = use.reference.getEnd();
  }
  return written + text.slice(at, node.getEnd());
};

/**
 * The type a prop typed by a type parameter is shown as (`selected?: TKey`): what decides its kind and control. Read
 * from the checker's type, whose parameter is the component's own.
 *
 * @param type - the prop's type, as the component takes it.
 * @param checker - the program's checker.
 * @param depth - how many defaults naming another parameter are followed.
 * @returns the type, or none when the prop's type is not a type parameter.
 */
export const genericShownType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  depth = TYPE_DEPTH
): ts.Type | undefined => {
  // `T | undefined` for an optional prop, `T & {}` once `undefined` is taken away
  const members = (type.isUnionOrIntersection() ? type.types : [type]).filter(
    (member) => (member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) === 0
  );
  const declarations = members.flatMap((member) => parameterOf(member) ?? []);
  const [declaration] = declarations;
  if (declaration === undefined || declarations.length !== 1) return undefined;
  if (type.isUnion() && members.length !== 1) return undefined;
  const node = shownAs(declaration);
  if (node === undefined) return checker.getUnknownType();
  const shown = checker.getTypeFromTypeNode(node);
  return depth > 0 ? (genericShownType(shown, checker, depth - 1) ?? shown) : shown;
};

/**
 * Whether a type, as the component takes it, still holds a type parameter: `readonly TItem[]` in a generic component,
 * not the `readonly string[]` of a props type it instantiates (`BaseProps<string>`). Through unions, intersections, a
 * generic's arguments and a function's parameters and result.
 *
 * @param type - the prop's type.
 * @param checker - the program's checker.
 * @param depth - how many levels are left to look into.
 */
export const hasTypeParameter = (type: ts.Type, checker: ts.TypeChecker, depth = TYPE_DEPTH): boolean => {
  if (type.flags & ts.TypeFlags.TypeParameter) return true;
  if (depth === 0) return false;
  const inner = (each: ts.Type): boolean => hasTypeParameter(each, checker, depth - 1);
  if (type.isUnionOrIntersection()) return type.types.some(inner);
  if ((type.aliasTypeArguments ?? []).some(inner)) return true;
  if (isReference(type) && checker.getTypeArguments(type).some(inner)) return true;
  return type
    .getCallSignatures()
    .some(
      (signature) =>
        inner(signature.getReturnType()) ||
        signature.getParameters().some((parameter) => inner(checker.getTypeOfSymbol(parameter)))
    );
};

/**
 * What a component's type parameter is shown as, as a prop's note says it.
 *
 * @param declaration - the component's type parameter.
 * @param generics - the checker and the bindings.
 */
const genericNote = (declaration: ts.TypeParameterDeclaration, generics: Generics): PropTypeNote => {
  const parameter = declaration.name.text;
  const seen = new Set([declaration]);
  if (declaration.constraint !== undefined) {
    const type = genericFreeText(declaration.constraint, generics, seen);
    return { reason: "generic", parameter, shownAs: "constraint", type };
  }
  if (declaration.default !== undefined) {
    const type = genericFreeText(declaration.default, generics, seen);
    return { reason: "generic", parameter, shownAs: "default", type };
  }
  return { reason: "generic", parameter, shownAs: "unknown", type: "unknown" };
};

/**
 * The notes of the type parameters a prop's declared types leave open, each once, by the component's name for it.
 *
 * @param declared - the prop's declared types.
 * @param generics - the checker and the bindings.
 */
export const genericNotes = (declared: readonly DeclaredType[], generics: Generics): PropTypeNote[] => {
  const notes = new Map<ts.TypeParameterDeclaration, PropTypeNote>();
  for (const node of declared) {
    for (const { declaration } of parameterUses(node, generics.checker)) {
      const { parameter } = resolved(declaration, generics.bindings);
      if (parameter !== undefined && !notes.has(parameter))
        notes.set(parameter, genericNote(parameter, generics));
    }
  }
  return [...notes.values()];
};
