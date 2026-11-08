/**
 * An object's fields, one under the other, and a tuple's items: what a type declares, each with its name, whether it is
 * required, and a way to take an optional one away.
 *
 * @module
 */
import type { ReactNode } from "react";

import { type ArgObject, type ArgValue, isArgList, isArgObject } from "../../messages.ts";
import { startValueOf } from "../../shapeValues.ts";
import { canSetShape, type ShapeField, type ValueShape } from "../../valueShape.ts";
import { Icon } from "../icons.tsx";
import { STRINGS } from "../strings.ts";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { DrawField, FieldProps } from "./fieldTypes.ts";

/** Whether a field's shape opens further: an optional one that holds nothing stays closed behind a button. */
const opensFurther = (shape: ValueShape): boolean =>
  shape.kind === "object" || shape.kind === "list" || shape.kind === "record" || shape.kind === "tuple";

/** One field of an object: its name and its value, or the button that gives it one. */
const ObjectField = ({
  field,
  value,
  label,
  namedValues,
  depth,
  onChange,
  drawField
}: Pick<FieldProps, "namedValues" | "depth" | "onChange"> & {
  readonly field: ShapeField;
  readonly value: ArgValue | undefined;
  readonly label: string;
  readonly drawField: DrawField;
}): ReactNode => {
  const fieldLabel = EDITOR_STRINGS.fieldValue(label, field.name);
  const start = startValueOf(field.shape, namedValues);
  const isClosed = value === undefined && !field.isRequired && opensFurther(field.shape);
  return (
    <div className="forgebook-value-field">
      <div className="forgebook-value-field__head">
        <code className="forgebook-value-field__name" title={field.description}>
          {field.name}
          {field.isRequired ? (
            <span className="forgebook-prop__required" title={STRINGS.required}>
              *
            </span>
          ) : null}
        </code>
        {value === undefined || field.isRequired ? null : (
          <button
            type="button"
            className="forgebook-prop__action"
            aria-label={EDITOR_STRINGS.clearField(fieldLabel)}
            title={EDITOR_STRINGS.clearField(fieldLabel)}
            onClick={(): void => onChange(undefined)}
          >
            <Icon name="noValue" size={12} />
          </button>
        )}
      </div>
      {isClosed ? (
        <button
          type="button"
          className="forgebook-text-button forgebook-value-add"
          disabled={start === undefined}
          onClick={(): void => onChange(start)}
        >
          <Icon name="plus" size={12} />
          {EDITOR_STRINGS.addField(fieldLabel)}
        </button>
      ) : (
        drawField({
          shape: field.shape,
          value,
          label: fieldLabel,
          namedValues,
          depth: depth + 1,
          isRequired: field.isRequired,
          onChange: (next: ArgValue | undefined): void => {
            // a required field cannot go: what reaches the story always fits its type
            if (next !== undefined || !field.isRequired) onChange(next);
          }
        })
      )}
    </div>
  );
};

/**
 * An object's editor. The first change starts from what the required fields must hold, so what reaches the story always
 * fits its type.
 *
 * @param props - the field's props, and how to draw a field.
 */
export const ObjectEditor = ({
  shape,
  value,
  label,
  namedValues,
  depth,
  onChange,
  drawField
}: FieldProps & {
  readonly shape: { readonly fields: readonly ShapeField[] };
  readonly drawField: DrawField;
}): ReactNode => {
  const current: ArgObject = value !== undefined && isArgObject(value) ? value : {};
  const change = (name: string, next: ArgValue | undefined): void => {
    const started = startValueOf({ kind: "object", fields: shape.fields }, namedValues);
    const base: ArgObject =
      value === undefined && started !== undefined && isArgObject(started) ? started : current;
    const { [name]: _removed, ...rest } = base;
    onChange(next === undefined ? rest : { ...base, [name]: next });
  };
  return (
    <div className="forgebook-value-object" data-depth={depth}>
      {shape.fields
        // a part only the source's named values can fill, and it names none, has nothing to draw
        .filter((field) => canSetShape(field.shape, namedValues))
        .map((field) => (
          <ObjectField
            key={field.name}
            field={field}
            value={Object.hasOwn(current, field.name) ? current[field.name] : undefined}
            label={label}
            namedValues={namedValues}
            depth={depth}
            onChange={(next: ArgValue | undefined): void => change(field.name, next)}
            drawField={drawField}
          />
        ))}
    </div>
  );
};

/**
 * A tuple's editor: its items, fixed in number, each of its own shape.
 *
 * @param props - the field's props, and how to draw an item.
 */
export const TupleEditor = ({
  shape,
  value,
  label,
  namedValues,
  depth,
  onChange,
  drawField
}: FieldProps & {
  readonly shape: { readonly items: readonly ValueShape[] };
  readonly drawField: DrawField;
}): ReactNode => {
  const current = value !== undefined && isArgList(value) ? value : undefined;
  const started = startValueOf({ kind: "tuple", items: shape.items }, namedValues);
  const base = current ?? (started !== undefined && isArgList(started) ? started : []);
  return (
    <div className="forgebook-value-tuple">
      {shape.items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a tuple's place is what it is
        <div key={index} className="forgebook-value-field">
          {drawField({
            shape: item,
            value: current?.[index],
            label: EDITOR_STRINGS.itemName(label, index + 1),
            namedValues,
            depth: depth + 1,
            isRequired: true,
            onChange: (next: ArgValue | undefined): void => {
              if (next === undefined) return;
              onChange(base.map((each, position) => (position === index ? next : each)));
            }
          })}
        </div>
      ))}
    </div>
  );
};
