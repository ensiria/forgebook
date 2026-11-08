/**
 * What a prop's value looks like, read from its type: the fields of an object, a list's items, the members of a mixed
 * union, so the panel can draw them and a link's value can be checked against them.
 *
 * @remarks
 * What JSON cannot hold (a function, a class's instance, a node) is a `named` part, which only the source's named values
 * can fill: whether it offers some is known in the page. Types can be recursive and very wide (`CSSProperties`,
 * `HTMLElement`), and every docs answer carries the shape, so a recursive part, a part too deep and a type too wide are
 * `json`, typed by hand: the answer stays small, and the prop can still be set.
 *
 * @module
 */
import ts from "typescript-6";

import type { ShapeField, ValueShape } from "../valueShape.ts";

/** What reading a shape needs from the docs that ask. */
export type ShapeReading = {
  /** The program's checker. */
  readonly checker: ts.TypeChecker;
  /** Where the code names the component. */
  readonly node: ts.Node;
  /** A choice's values in the source's order; applied to the prop's own literals. */
  readonly order: (values: readonly (string | number)[]) => readonly (string | number)[];
  /** A member's type as the source writes it. */
  readonly typeText: (member: ts.Symbol) => string | undefined;
  /** A member's TSDoc. */
  readonly description: (member: ts.Symbol) => string;
};

/** The deepest a shape goes before the rest is typed as JSON. */
const MOST_DEPTH = 4;

/** The most fields of one object drawn as fields: a wider one is read as JSON (`CSSProperties`). */
const MOST_FIELDS = 40;

/** The most parts of one prop's shape: past it the prop is read as JSON, so one prop cannot swell every answer. */
const MOST_PARTS = 200;

/** What one prop's reading carries down. */
type Walk = ShapeReading & {
  /** The object types being read, so a recursive one ends. */
  readonly open: readonly ts.Type[];
  /** The parts read so far, for the whole prop. */
  readonly count: { parts: number };
};

/** Whether a type is a reference to a tuple, for its element types. */
const isTupleReference = (type: ts.Type, checker: ts.TypeChecker): type is ts.TupleTypeReference =>
  checker.isTupleType(type);

/** A part JSON cannot hold, under its type's name. */
const namedPart = (type: ts.Type, text: string | undefined, walk: Walk): ValueShape => ({
  kind: "named",
  type: text ?? walk.checker.typeToString(type),
  ...(walk.checker.isTypeAssignableTo(walk.checker.getStringType(), type) ? { canTakeText: true } : {})
});

/** Whether a member's type takes `null`, which a story's own value may hold. */
const holdsNull = (type: ts.Type): boolean =>
  type.isUnion() && type.types.some((member) => (member.flags & ts.TypeFlags.Null) !== 0);

/** The fields of an object type, in the order its members are declared. */
const fieldsOf = (type: ts.Type, walk: Walk, depth: number): readonly ShapeField[] =>
  type.getProperties().map((member): ShapeField => {
    const written = walk.checker.getTypeOfSymbolAtLocation(member, walk.node);
    const memberType = walk.checker.getNonNullableType(written);
    const description = walk.description(member);
    return {
      name: member.getName(),
      shape: shapeOfType(memberType, walk, depth + 1, walk.typeText(member)),
      isRequired: (member.flags & ts.SymbolFlags.Optional) === 0,
      ...(holdsNull(written) ? { isNullable: true } : {}),
      ...(description === "" ? {} : { description })
    };
  });

/** A union's shape: its literals as one choice, `true | false` as one toggle, the rest each its own. */
const unionShape = (type: ts.UnionType, walk: Walk, depth: number, text: string | undefined): ValueShape => {
  const members = type.types.filter(
    (member) => (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) === 0
  );
  const literals = members.flatMap((member) =>
    member.isStringLiteral() || member.isNumberLiteral() ? [member.value] : []
  );
  const hasBoolean = members.some((member) => (member.flags & ts.TypeFlags.BooleanLiteral) !== 0);
  // a node, or anything else with a part JSON cannot hold, is one thing to fill, not a choice among its parts: the first
  // such part ends the reading, and the parts after it are not read for nothing
  const others: ValueShape[] = [];
  for (const member of members) {
    if (
      member.isStringLiteral() ||
      member.isNumberLiteral() ||
      (member.flags & ts.TypeFlags.BooleanLiteral) !== 0
    )
      continue;
    const shape = shapeOfType(member, walk, depth + 1, undefined);
    if (shape.kind === "named") return namedPart(type, text, walk);
    others.push(shape);
  }
  const shapes: ValueShape[] = [
    ...(literals.length === 0 ? [] : [{ kind: "choice", values: walk.order(literals) } satisfies ValueShape]),
    ...(hasBoolean ? [{ kind: "boolean" } satisfies ValueShape] : []),
    ...others
  ];
  const [only] = shapes;
  return only !== undefined && shapes.length === 1 ? only : { kind: "union", of: shapes };
};

/** Whether a type holds any JSON, as far as the source says: a generic's parameter says nothing either. */
const isAnyJson = (type: ts.Type): boolean =>
  (type.flags &
    (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.NonPrimitive | ts.TypeFlags.TypeParameter)) !==
  0;

/** Whether a type is a text of some form: `string`, a template (`${number}px`), a brand (`string & {}`). */
const isTextType = (type: ts.Type): boolean =>
  (type.flags & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping)) !== 0 ||
  (type.isIntersection() && type.types.some(isTextType));

/** Whether a type is the global `Date`, declared by TypeScript's own library, not one of the source's by that name. */
const isGlobalDate = (type: ts.Type): boolean => {
  const symbol = type.getSymbol();
  const file = symbol?.declarations?.[0]?.getSourceFile().fileName ?? "";
  return symbol?.getName() === "Date" && /[\\/]lib\.[^\\/]*\.d\.ts$/.test(file);
};

/** An object type's shape: its fields, or any names, or JSON when it is too wide or already being read. */
const objectShape = (type: ts.Type, walk: Walk, depth: number, text: string | undefined): ValueShape => {
  const { checker } = walk;
  // the global `Date`: declared by TypeScript's own library, whatever the source names otherwise
  if (isGlobalDate(type)) return { kind: "date" };
  // a thing with behaviour is not data (`Date`, `Map`, a class's instance): no value of JSON stands for it
  const hasBehaviour = type
    .getProperties()
    .some(
      (member) =>
        (member.flags & ts.SymbolFlags.Method) !== 0 && (member.flags & ts.SymbolFlags.Optional) === 0
    );
  if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0 || type.isClass())
    return namedPart(type, text, walk);
  if (walk.open.includes(type) || depth >= MOST_DEPTH) return { kind: "json" };
  const inner = { ...walk, open: [...walk.open, type] };
  const element = checker.isArrayType(type) ? type.getNumberIndexType() : undefined;
  if (element !== undefined) {
    return {
      kind: "list",
      of: shapeOfType(checker.getNonNullableType(element), inner, depth + 1, undefined)
    };
  }
  if (isTupleReference(type, checker)) {
    const isFixed = type.target.elementFlags.every((flag) => flag === ts.ElementFlags.Required);
    if (!isFixed) return { kind: "json" };
    return {
      kind: "tuple",
      items: checker
        .getTypeArguments(type)
        .map((item) => shapeOfType(checker.getNonNullableType(item), inner, depth + 1, undefined))
    };
  }
  if (hasBehaviour) return namedPart(type, text, walk);
  const index = type.getStringIndexType();
  const properties = type.getProperties();
  if (index !== undefined && properties.length === 0) {
    return {
      kind: "record",
      of: shapeOfType(checker.getNonNullableType(index), inner, depth + 1, undefined)
    };
  }
  if (properties.length === 0 || properties.length > MOST_FIELDS) return { kind: "json" };
  return { kind: "object", fields: fieldsOf(type, inner, depth) };
};

/**
 * A type's shape.
 *
 * @param type - the type, without `undefined` and `null`.
 * @param walk - what the reading carries.
 * @param depth - how deep this part is.
 * @param text - the part's type as the source writes it, when it is known.
 */
const shapeOfType = (type: ts.Type, walk: Walk, depth: number, text: string | undefined): ValueShape => {
  walk.count.parts += 1;
  if (walk.count.parts > MOST_PARTS) return { kind: "json" };
  if (isAnyJson(type)) return { kind: "json" };
  if (isTextType(type)) return { kind: "text" };
  if ((type.flags & ts.TypeFlags.Number) !== 0) return { kind: "number" };
  if ((type.flags & ts.TypeFlags.Boolean) !== 0) return { kind: "boolean" };
  // one value of a discriminated union (`{ isOk: true; … }`): a toggle would let a reader write the other branch's
  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0)
    return { kind: "boolean", only: walk.checker.typeToString(type) === "true" };
  if (type.isStringLiteral() || type.isNumberLiteral()) return { kind: "choice", values: [type.value] };
  if (type.isUnion()) return unionShape(type, walk, depth, text);
  // an intersection reads as the object it makes (`Base & { extra: string }`)
  if ((type.flags & ts.TypeFlags.Object) !== 0 || type.isIntersection())
    return objectShape(type, walk, depth, text);
  return namedPart(type, text, walk);
};

/**
 * A prop's shape, when it says more than the prop's kind does.
 *
 * @param type - the prop's type, without `undefined` and `null`.
 * @param canTakeText - whether it takes a plain text: its text field stays, rather than JSON for a type that says nothing.
 * @param reading - what reading a shape needs.
 * @returns the shape; none for a prop no JSON value can fill, whose named values the page looks up by its type.
 */
export const shapeOfProp = (
  type: ts.Type,
  canTakeText: boolean,
  reading: ShapeReading
): ValueShape | undefined => {
  const count = { parts: 0 };
  const shape = shapeOfType(type, { ...reading, open: [], count }, 0, undefined);
  if (shape.kind === "named") return undefined;
  if (count.parts > MOST_PARTS) return { kind: "json" };
  return shape.kind === "json" && canTakeText ? undefined : shape;
};
