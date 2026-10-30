/**
 * The matrix of a story: the story drawn once per value of one prop (the rows), or of two (rows by columns), in one
 * frame, so every variant, tone and size is seen side by side without a story written for it.
 *
 * @remarks
 * Only props with a known, short set of values make an axis: a choice (its literal values) or a toggle (`false`,
 * `true`). The shell builds the matrix from the component's docs and the axes in the address, and sends it to the
 * frames, which draw it over the story's args. Pure.
 *
 * @module
 */
import type { PropDocs } from "./componentDocs.ts";

/** A value an axis takes: what a choice or a toggle prop can be set to. */
export type MatrixValue = string | number | boolean;

/** One axis: a prop and the values it takes, in order. */
export type MatrixAxis = {
  /** The prop's name. */
  readonly name: string;
  /** Its values. */
  readonly values: readonly MatrixValue[];
};

/** The matrix: the rows' axis, and the columns' when there are two. */
export type Matrix = {
  /** One row per value. */
  readonly rows: MatrixAxis;
  /** One column per value; a single column without. */
  readonly columns?: MatrixAxis;
};

/** The most values an axis takes: past it, the grid is no longer read at a glance. */
export const MATRIX_MAX_VALUES = 12;

/**
 * The axis a prop makes, when it can make one.
 *
 * @param prop - the prop's docs.
 */
export const axisOf = (prop: PropDocs): MatrixAxis | undefined => {
  if (prop.kind === "toggle") return { name: prop.name, values: [false, true] };
  if (prop.kind !== "choice") return undefined;
  const values = prop.choices ?? [];
  return values.length >= 2 && values.length <= MATRIX_MAX_VALUES ? { name: prop.name, values } : undefined;
};

/**
 * The props a story's matrix can use as an axis, in the docs' order.
 *
 * @param props - the component's props.
 */
export const matrixProps = (props: readonly PropDocs[]): PropDocs[] =>
  props.filter((prop) => axisOf(prop) !== undefined);

/**
 * The matrix of the named axes: the first is the rows, the second the columns; none when the first names no axis.
 *
 * @param props - the component's props.
 * @param names - the axes' prop names, from the address.
 */
export const matrixOf = (props: readonly PropDocs[], names: readonly string[]): Matrix | undefined => {
  const axisNamed = (name: string | undefined): MatrixAxis | undefined => {
    const prop = props.find((candidate) => candidate.name === name);
    return prop === undefined ? undefined : axisOf(prop);
  };
  const [rowName, columnName] = names;
  const rows = axisNamed(rowName);
  if (rows === undefined) return undefined;
  const columns = columnName === rowName ? undefined : axisNamed(columnName);
  return columns === undefined ? { rows } : { rows, columns };
};

/** Whether a value is an axis, as it arrives in a message. */
const isAxis = (value: unknown): value is MatrixAxis => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  const values = record["values"];
  return (
    typeof record["name"] === "string" &&
    Array.isArray(values) &&
    values.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
  );
};

/**
 * Whether a value is a matrix, as it arrives in a message.
 *
 * @param value - the message's matrix.
 */
export const isMatrix = (value: unknown): value is Matrix => {
  if (typeof value !== "object" || value === null) return false;
  const record: Readonly<Record<string, unknown>> = { ...value };
  return isAxis(record["rows"]) && (record["columns"] === undefined || isAxis(record["columns"]));
};
