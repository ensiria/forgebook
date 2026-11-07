/**
 * What a prop's type cannot say plainly, read from the type its source writes: a generic's type parameter, shown as its
 * constraint or its default; a name the checker cannot find; an `any`. `propDocs` writes the type with each type
 * parameter replaced and lists a note for each, so a reader sees why a type is not the one the source wrote, or why it
 * says nothing.
 *
 * @remarks
 * A type parameter is replaced in the text the source writes rather than through the checker, whose instantiation is
 * not part of its public API. The constraint and default are the ones the props type declares, which is what a value
 * passed for the prop must meet.
 *
 * @module
 */
import ts from "typescript-6";

import type { PropTypeNote } from "../componentDocs.ts";

/** A prop's type as declared: a type node, or a method's whole signature. */
export type DeclaredType = ts.TypeNode | ts.MethodSignature;

/** A use of a type parameter the prop's type does not declare itself: one the props type or the component takes. */
type ParameterUse = {
  /** Where the type writes it. */
  readonly reference: ts.TypeReferenceNode;
  /** Its declaration, with its constraint and default. */
  readonly declaration: ts.TypeParameterDeclaration;
};

/** Whether a node lies inside another. */
const isWithin = (node: ts.Node, outer: ts.Node): boolean =>
  node.getSourceFile() === outer.getSourceFile() && node.pos >= outer.pos && node.end <= outer.end;

/**
 * Every type reference a declared type writes, in source order.
 *
 * @param declared - the prop's declared type.
 */
const referencesIn = (declared: DeclaredType): ts.TypeReferenceNode[] => {
  const found: ts.TypeReferenceNode[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(declared);
  return found;
};

/**
 * The type parameters a declared type uses and does not declare itself (a function type's own `<T>` stays as written).
 *
 * @param declared - the prop's declared type.
 * @param checker - the program's checker.
 */
const parameterUses = (declared: DeclaredType, checker: ts.TypeChecker): ParameterUse[] =>
  referencesIn(declared).flatMap((reference): ParameterUse[] => {
    const symbol = checker.getSymbolAtLocation(reference.typeName);
    const declaration = symbol?.declarations?.find(ts.isTypeParameterDeclaration);
    return declaration === undefined || isWithin(declaration, declared) ? [] : [{ reference, declaration }];
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

/**
 * What a type parameter is shown as: its constraint, else its default, else `unknown`, which is what a value must meet.
 *
 * @param declaration - the type parameter's declaration.
 */
const shownAs = (declaration: ts.TypeParameterDeclaration): ts.TypeNode | undefined =>
  declaration.constraint ?? declaration.default;

/** The kinds of type node that need parentheses when they replace a name inside a larger type (`readonly (A | B)[]`). */
const needsParentheses = (node: ts.TypeNode): boolean =>
  ts.isUnionTypeNode(node) ||
  ts.isIntersectionTypeNode(node) ||
  ts.isFunctionTypeNode(node) ||
  ts.isConstructorTypeNode(node) ||
  ts.isConditionalTypeNode(node) ||
  ts.isTypeOperatorNode(node);

/** Whether a type in this place binds tighter than a union or a function written in its stead (`readonly T[]`). */
const isTightPlace = (reference: ts.TypeReferenceNode): boolean => {
  const { parent } = reference;
  return (
    ts.isArrayTypeNode(parent) ||
    ts.isIndexedAccessTypeNode(parent) ||
    ts.isTypeOperatorNode(parent) ||
    ts.isUnionTypeNode(parent) ||
    ts.isIntersectionTypeNode(parent)
  );
};

/**
 * The text that replaces a type parameter: its constraint or default as written, `unknown` when it has neither.
 *
 * @param use - the type parameter's use.
 * @param checker - the program's checker.
 * @param seen - the type parameters being replaced.
 */
const replacementText = (
  { reference, declaration }: ParameterUse,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.TypeParameterDeclaration>
): string => {
  const node = shownAs(declaration);
  if (node === undefined) return "unknown";
  // a constraint may name another type parameter (`TName extends FieldPath<TValues>`): it is replaced too, once
  const text = seen.has(declaration)
    ? declaration.name.text
    : genericFreeText(node, checker, new Set([...seen, declaration]));
  return needsParentheses(node) && isTightPlace(reference) ? `(${text})` : text;
};

/**
 * A declared type's source text with each type parameter it uses replaced by what it is shown as.
 *
 * @param declared - the prop's declared type (or one member of it).
 * @param checker - the program's checker.
 * @param seen - the type parameters being replaced, so a constraint that names its own parameter ends.
 * @returns the text, as `getText()` would give it with the replacements made.
 */
export const genericFreeText = (
  declared: ts.Node,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.TypeParameterDeclaration> = new Set()
): string => {
  const uses =
    ts.isTypeNode(declared) || ts.isMethodSignature(declared) ? parameterUses(declared, checker) : [];
  const text = declared.getSourceFile().text;
  let written = "";
  let at = declared.getStart();
  for (const use of uses) {
    written += text.slice(at, use.reference.getStart()) + replacementText(use, checker, seen);
    at = use.reference.getEnd();
  }
  return written + text.slice(at, declared.getEnd());
};

/**
 * The type a type parameter is shown as, for a prop whose whole type is one (`selected?: TKey`): what decides its kind
 * and its control.
 *
 * @param declared - the prop's declared types.
 * @param checker - the program's checker.
 * @returns the type, or none when the prop's type is not a bare type parameter.
 */
export const genericShownType = (
  declared: readonly DeclaredType[],
  checker: ts.TypeChecker
): ts.Type | undefined => {
  const [only] = declared;
  if (declared.length !== 1 || only === undefined || !ts.isTypeReferenceNode(only)) return undefined;
  const [use] = parameterUses(only, checker);
  if (use === undefined) return undefined;
  const node = shownAs(use.declaration);
  return node === undefined ? checker.getUnknownType() : checker.getTypeFromTypeNode(node);
};

/** Whether a type is a generic's instance (`Array<TItem>`), whose type arguments the checker lists. */
const isReference = (type: ts.Type): type is ts.TypeReference =>
  (type.flags & ts.TypeFlags.Object) !== 0 && "target" in type;

/** How deep `hasTypeParameter` looks into a type: deep enough for a list of callbacks, and a recursive type ends. */
const TYPE_DEPTH = 4;

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
 * Whether a type reference names something the checker cannot find: no symbol, or an import of nothing.
 *
 * @param reference - the reference.
 * @param checker - the program's checker.
 */
const isUnresolved = (reference: ts.TypeReferenceNode, checker: ts.TypeChecker): boolean => {
  const symbol = checker.getSymbolAtLocation(reference.typeName);
  if (symbol === undefined) return true;
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return (target.declarations ?? []).length === 0;
};

/** What a type parameter is shown as, as a prop's note says it. */
const genericNote = (declaration: ts.TypeParameterDeclaration, checker: ts.TypeChecker): PropTypeNote => {
  const parameter = declaration.name.text;
  const seen = new Set([declaration]);
  if (declaration.constraint !== undefined) {
    const type = genericFreeText(declaration.constraint, checker, seen);
    return { reason: "generic", parameter, shownAs: "constraint", type };
  }
  if (declaration.default !== undefined) {
    const type = genericFreeText(declaration.default, checker, seen);
    return { reason: "generic", parameter, shownAs: "default", type };
  }
  return { reason: "generic", parameter, shownAs: "unknown", type: "unknown" };
};

/**
 * Why a prop's type is not the one its source writes, or says nothing: each generic type parameter and what it is
 * shown as, each name the checker cannot find, and an `any` with neither.
 *
 * @param declared - the prop's declared types.
 * @param type - the prop's type as the checker has it, without `undefined`.
 * @param checker - the program's checker.
 * @param isGeneric - whether the component leaves a type parameter of the prop's type open (`hasTypeParameter`).
 * @returns the notes, in source order, each once; empty when the type is read as written.
 */
export const propTypeNotes = (
  declared: readonly DeclaredType[],
  type: ts.Type,
  checker: ts.TypeChecker,
  isGeneric: boolean
): PropTypeNote[] => {
  const notes = new Map<string, PropTypeNote>();
  for (const node of declared) {
    for (const { declaration } of isGeneric ? parameterUses(node, checker) : []) {
      notes.set(`generic:${declaration.name.text}`, genericNote(declaration, checker));
    }
    for (const reference of referencesIn(node)) {
      if (!isUnresolved(reference, checker)) continue;
      const name = reference.typeName.getText();
      notes.set(`unresolved:${name}`, { reason: "unresolved", name });
    }
  }
  if (notes.size === 0 && type.flags & ts.TypeFlags.Any) notes.set("any", { reason: "any" });
  return [...notes.values()];
};
