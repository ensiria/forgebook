/**
 * What the panel's nested fields are given: the same for every kind of value, so a field of a list can be an object, a
 * union, or anything else a type says.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { ArgValue } from "../../messages.ts";
import type { NamedValues } from "../../namedValues.ts";
import type { ValueShape } from "../../valueShape.ts";

/** One value's field. */
export type FieldProps = {
  /** What the value looks like. */
  readonly shape: ValueShape;
  /** The value; none when it has none. */
  readonly value: ArgValue | undefined;
  /** The name a screen reader reads: the prop's, and the path down to this part. */
  readonly label: string;
  /** The element that describes it, at the top of a prop. */
  readonly describedBy?: string | undefined;
  /** The source's named values. */
  readonly namedValues: NamedValues;
  /** How deep it is: the prop itself is 0. */
  readonly depth: number;
  /** Whether it must hold a value, so nothing offers to take it away; `false` by default. */
  readonly isRequired?: boolean;
  /** Called with a changed value; none takes it away. */
  readonly onChange: (value: ArgValue | undefined) => void;
};

/** Draws a field, handed down so that the nested editors need not import what imports them. */
export type DrawField = (props: FieldProps) => ReactNode;
