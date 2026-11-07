/**
 * A prop's kind (the panel's group and control) and the type it is read from: a choice, a text, a number, a toggle, an
 * event or anything else, across the variants of a union of props that declare it and through a generic's type
 * parameters. Used by `propDocs.ts`.
 *
 * @module
 */
import ts from "typescript-6";

import type { PropKind } from "../componentDocs.ts";
import type { PropReading } from "./propDocs.ts";
import { type DeclaredType, genericShownType, hasTypeParameter } from "./propTypeNotes.ts";

/** An event: a function prop named `on` and a capital (React's `onPress`). */
const EVENT_NAME = /^on[A-Z]/;

/** Whether a type is a union of string or number literals (a choice). */
export const literalValues = (type: ts.Type): (string | number)[] | undefined => {
  if (!type.isUnion()) return undefined;
  const values = type.types.map((member) =>
    member.isStringLiteral() || member.isNumberLiteral() ? member.value : undefined
  );
  return values.every((value) => value !== undefined)
    ? values.filter((value) => value !== undefined)
    : undefined;
};

/** A prop's kind, from its name and its type without `undefined`. */
export const kindOf = (name: string, type: ts.Type, eventName: RegExp): PropKind => {
  if (eventName.test(name) && type.getCallSignatures().length > 0) return "event";
  if (type.flags & ts.TypeFlags.Boolean || type.flags & ts.TypeFlags.BooleanLiteral) return "toggle";
  if (literalValues(type) !== undefined) return "choice";
  if (type.flags & ts.TypeFlags.String) return "text";
  if (type.flags & ts.TypeFlags.Number) return "number";
  return "other";
};

/**
 * A prop's kind across the variants that declare it: theirs when all share one, `other` otherwise.
 *
 * @param name - the prop's name.
 * @param types - its type in each variant, without `undefined`.
 * @param eventName - what an event's name is.
 */
const sharedKind = (name: string, types: readonly ts.Type[], eventName: RegExp): PropKind => {
  const kinds = new Set(types.map((type) => kindOf(name, type, eventName)));
  const [only] = kinds;
  return kinds.size === 1 && only !== undefined ? only : "other";
};

/** A prop's type and kind, read across the variants of a union of props that declare it. */
export type TypeAndKind = {
  /** Its type, without `undefined`: what a type parameter is shown as, for a prop typed by one. */
  readonly type: ts.Type;
  /** Its type in each other variant that declares it. */
  readonly variantTypes: readonly ts.Type[];
  /** Whether those variants type it otherwise. */
  readonly isMixed: boolean;
  /** Its kind, shared by every variant's type. */
  readonly kind: PropKind;
  /** Whether its type, as the component takes it, still holds a type parameter (`readonly TItem[]`). */
  readonly isGeneric: boolean;
};

/**
 * A prop's type and kind.
 *
 * @param symbol - the prop.
 * @param declared - its declared types, in every variant.
 * @param reading - how the framework's props differ, and the other variants'.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 */
export const typeAndKind = (
  symbol: ts.Symbol,
  declared: readonly DeclaredType[],
  { taken, eventName = EVENT_NAME, variants = [] }: PropReading,
  checker: ts.TypeChecker,
  node: ts.Node
): TypeAndKind => {
  const ownType = taken?.type ?? checker.getTypeOfSymbolAtLocation(symbol, node);
  const isGeneric = hasTypeParameter(ownType, checker);
  // a prop typed by a type parameter takes what that parameter is shown as: its kind and control follow from it
  const type = checker.getNonNullableType(
    (isGeneric ? genericShownType(declared, checker) : undefined) ?? ownType
  );
  const variantTypes = variants.map((variant) =>
    checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(variant, node))
  );
  const isMixed = variantTypes.some((variantType) => variantType !== type);
  const name = symbol.getName();
  const kind = isMixed ? sharedKind(name, [type, ...variantTypes], eventName) : kindOf(name, type, eventName);
  return { type, variantTypes, isMixed, kind, isGeneric };
};
