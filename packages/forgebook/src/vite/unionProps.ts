/**
 * The props of a component whose props are a union of variants (`{ kind: "link"; href } | { kind: "button"; onClick }`):
 * every variant's props, not only the ones all variants share, each prop only some variants declare with the
 * discriminant's values that select them. Used by `functionComponentDocs.ts`.
 *
 * @remarks
 * The checker lists a union's properties as those every member has, so a variant's own props vanished from the docs
 * with no sign. A prop only some variants declare is never required: whether it must be passed depends on the variant.
 * The discriminant is a prop every variant declares with one literal value (`kind: "link"`) or leaves out; a union
 * without one lists its variants' props with no condition. A prop declared by several variants takes all their types.
 *
 * @module
 */
import ts from "typescript-6";

import type { PropCondition } from "../componentDocs.ts";

/** A prop only some variants of a union of props declare. */
export type VariantProp = {
  /** When it can be passed; none when the union has no discriminant, or a variant without one declares it. */
  readonly onlyWhen: PropCondition | undefined;
  /** The same prop as each variant that declares it has it, the first included: their types together are its type. */
  readonly declarations: readonly ts.Symbol[];
};

/** The props of a component's props type. */
export type TypeProps = {
  /** Every prop, of every variant, each once: the shared ones first, then each variant's own in the order they come. */
  readonly props: readonly ts.Symbol[];
  /** The props only some variants declare, by the symbol `props` lists for each. */
  readonly variantOnly: ReadonlyMap<ts.Symbol, VariantProp>;
};

/** A discriminant's value in one variant. */
type Value = string | number | boolean;

/**
 * A discriminant's value in one variant: the literal its type is, `null` when the variant leaves it out
 * (`mode?: undefined`), none when its type is anything else.
 */
const literalOf = (type: ts.Type, checker: ts.TypeChecker): Value | null | undefined => {
  if (type.isStringLiteral() || type.isNumberLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return checker.typeToString(type) === "true";
  return type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never) ? null : undefined;
};

/** A union's discriminant: its name, and its value in each variant, `null` where the variant leaves it out. */
type Discriminant = { readonly name: string; readonly values: readonly (Value | null)[] };

/**
 * The discriminant of a union of props: among the shared props each variant declares with one literal value or leaves
 * out, the one with the most different values (`mode` over `required` in a date picker's props), the first on a tie.
 *
 * @param shared - the props every variant declares.
 * @param variants - the union's members.
 * @param checker - the program's checker.
 * @returns the discriminant, or none when the union has none.
 */
const discriminantOf = (
  shared: readonly ts.Symbol[],
  variants: readonly ts.Type[],
  checker: ts.TypeChecker
): Discriminant | undefined => {
  let best: { readonly discriminant: Discriminant; readonly count: number } | undefined;
  for (const prop of shared) {
    const name = prop.getName();
    const values = variants.map((variant) => {
      const member = checker.getPropertyOfType(variant, name);
      return member === undefined
        ? undefined
        : literalOf(checker.getNonNullableType(checker.getTypeOfSymbol(member)), checker);
    });
    if (!values.every((value) => value !== undefined)) continue;
    const count = new Set(values.filter((value) => value !== null)).size;
    if (count > 1 && (best === undefined || count > best.count))
      best = { discriminant: { name, values }, count };
  }
  return best?.discriminant;
};

/** A variant-only prop while the variants are read. */
type VariantEntry = {
  readonly declarations: ts.Symbol[];
  readonly values: Value[];
  /** Whether a variant that leaves the discriminant out declares it: no condition can then say when it applies. */
  isUnconditioned: boolean;
};

/**
 * A component's props, read from its props type: a plain type's own, or every variant's of a union.
 *
 * @param propsType - the type of its props, without `undefined`.
 * @param checker - the program's checker.
 */
export const propsOfType = (propsType: ts.Type, checker: ts.TypeChecker): TypeProps => {
  const shared = propsType.getProperties();
  if (!propsType.isUnion()) return { props: shared, variantOnly: new Map() };
  const variants = propsType.types;
  const sharedNames = new Set(shared.map((prop) => prop.getName()));
  const discriminant = discriminantOf(shared, variants, checker);
  const own = new Map<string, VariantEntry>();
  variants.forEach((variant, index) => {
    const value = discriminant?.values[index] ?? null;
    for (const prop of variant.getProperties()) {
      const name = prop.getName();
      if (sharedNames.has(name)) continue;
      const entry = own.get(name) ?? { declarations: [], values: [], isUnconditioned: false };
      own.set(name, entry);
      entry.declarations.push(prop);
      if (value === null) entry.isUnconditioned = true;
      else if (!entry.values.includes(value)) entry.values.push(value);
    }
  });
  const variantOnly = new Map<ts.Symbol, VariantProp>();
  for (const { declarations, values, isUnconditioned } of own.values()) {
    const [first] = declarations;
    if (first === undefined) continue;
    const onlyWhen =
      discriminant === undefined || isUnconditioned ? undefined : { prop: discriminant.name, values };
    variantOnly.set(first, { onlyWhen, declarations });
  }
  return { props: [...shared, ...variantOnly.keys()], variantOnly };
};
