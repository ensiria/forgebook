/**
 * What a prop's value looks like when it is more than one text or number: an object's fields, a list's items, the
 * members of a mixed union. Read from the component's types (`vite/shapeDocs.ts`) or from a story's own arg, it drives
 * the panel's nested fields, the check on a link's values, the worst case and what agents read of a prop.
 *
 * @remarks
 * A shape is plain JSON, so it crosses from the plugin to the page and reaches an agent as it is. A value that fits a
 * shape is plain JSON too, so a link can hold it. What JSON cannot hold (a component, a function, a date) is a `named`
 * leaf: only one of the source's `namedValues` can stand for it. `json` is the way out for what cannot be drawn as
 * fields: any JSON value, typed by hand. This module holds what the first screen needs of a shape; what reads a value
 * against one is `shapeValues.ts`, which loads with the first prop that has a shape. Pure.
 *
 * @module
 */
import type { ArgValue } from "./messages.ts";
import type { NamedValues } from "./namedValues.ts";

/** One field of an object's shape. */
export type ShapeField = {
  /** The field's name. */
  readonly name: string;
  /** What it holds. */
  readonly shape: ValueShape;
  /** Whether a value must give it. */
  readonly isRequired: boolean;
  /** Whether it may hold `null`. Left out when not. */
  readonly isNullable?: true;
  /** The first paragraph of its TSDoc; left out when it has none. */
  readonly description?: string;
};

/** What a value looks like. */
export type ValueShape =
  | { readonly kind: "text" }
  | { readonly kind: "number" }
  | {
      readonly kind: "boolean";
      /** The one value it may hold, for one branch of a discriminated union. Left out when it takes both. */
      readonly only?: boolean;
    }
  | {
      /** One of these values. */
      readonly kind: "choice";
      /** The values, in the order of the type. */
      readonly values: readonly (string | number)[];
    }
  | {
      /** Any number of items of one shape. */
      readonly kind: "list";
      /** The items' shape. */
      readonly of: ValueShape;
    }
  | {
      /** A fixed number of items, each of its own shape (`[number, number]`). */
      readonly kind: "tuple";
      /** Each item's shape, in order. */
      readonly items: readonly ValueShape[];
    }
  | {
      /** Named fields. */
      readonly kind: "object";
      /** The fields, in the order of the source. */
      readonly fields: readonly ShapeField[];
    }
  | {
      /** Any names, each holding one shape (`Record<string, number>`). */
      readonly kind: "record";
      /** The values' shape. */
      readonly of: ValueShape;
    }
  | {
      /** One of several shapes, chosen first (`"sm" | number`). */
      readonly kind: "union";
      /** The shapes, in the order of the type. */
      readonly of: readonly ValueShape[];
    }
  | {
      /** What JSON cannot hold: one of the source's named values, under the type as the source writes it. */
      readonly kind: "named";
      /** The type, as `namedValues` lists it (`IconComponent`). */
      readonly type: string;
      /** Whether a plain text can be given too (a node). Left out when not. */
      readonly canTakeText?: true;
    }
  | {
      /** A moment: a `Date`, which the story receives as one (`DateArg`). */
      readonly kind: "date";
    }
  | {
      /** Any JSON: what fields cannot show. */
      readonly kind: "json";
    }
  | {
      /** What a story's own arg looks like, for an arg no type describes: read from it when it is needed. */
      readonly kind: "like";
      /** The story's own value. */
      readonly value: ArgValue;
    };

/**
 * Whether the panel can give a shape a value at all: a required part the source names no value for leaves it no way.
 *
 * @param shape - the shape.
 * @param namedValues - the source's named values.
 */
export const canSetShape = (shape: ValueShape, namedValues: NamedValues): boolean => {
  switch (shape.kind) {
    case "named":
      return (
        shape.canTakeText === true ||
        (Object.hasOwn(namedValues, shape.type) && Object.keys(namedValues[shape.type] ?? {}).length > 0)
      );
    case "list":
      return canSetShape(shape.of, namedValues);
    case "record":
      return canSetShape(shape.of, namedValues);
    case "tuple":
      return shape.items.every((item) => canSetShape(item, namedValues));
    case "object":
      return shape.fields.every((field) => !field.isRequired || canSetShape(field.shape, namedValues));
    case "union":
      return shape.of.some((member) => canSetShape(member, namedValues));
    default:
      return true;
  }
};
