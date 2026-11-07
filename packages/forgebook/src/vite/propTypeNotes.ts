/**
 * What a prop's type cannot say plainly: a generic's type parameter and what it is shown as (`typeParameters.ts`), a
 * name the checker cannot find, an `any`. `propDocs` lists a note for each, so a reader sees why a type is not the one
 * the source wrote, or why it says nothing.
 *
 * @module
 */
import ts from "typescript-6";

import type { PropTypeNote } from "../componentDocs.ts";
import { type DeclaredType, type Generics, genericNotes, referencesIn } from "./typeParameters.ts";

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

/**
 * Why a prop's type is not the one its source writes, or says nothing: each generic type parameter and what it is
 * shown as, each name the checker cannot find, and an `any` with neither.
 *
 * @param declared - the prop's declared types.
 * @param type - the prop's type as the checker has it, without `undefined`.
 * @param checker - the program's checker.
 * @param generics - the checker and the bindings when the component leaves a type parameter of the prop's type open;
 * none otherwise.
 * @returns the notes, in source order, each once; empty when the type is read as written.
 */
export const propTypeNotes = (
  declared: readonly DeclaredType[],
  type: ts.Type,
  checker: ts.TypeChecker,
  generics: Generics | undefined
): PropTypeNote[] => {
  const notes = new Map<string, PropTypeNote>();
  for (const note of generics === undefined ? [] : genericNotes(declared, generics)) {
    if (note.reason === "generic") notes.set(`generic:${note.parameter}`, note);
  }
  for (const node of declared) {
    for (const reference of referencesIn(node)) {
      if (!isUnresolved(reference, checker)) continue;
      const name = reference.typeName.getText();
      notes.set(`unresolved:${name}`, { reason: "unresolved", name });
    }
  }
  if (notes.size === 0 && type.flags & ts.TypeFlags.Any) notes.set("any", { reason: "any" });
  return [...notes.values()];
};
