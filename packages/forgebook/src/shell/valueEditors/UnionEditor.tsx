/**
 * A mixed union (`"sm" | number`): choose the type, then the value. Choosing a type starts from that type's first value,
 * so the story at once receives what was chosen, and a value already set says which type it is.
 *
 * @module
 */
import { type ReactNode, useState } from "react";

import type { ArgValue } from "../../messages.ts";
import { isValueOfShape, startValueOf } from "../../shapeValues.ts";
import { canSetShape, type ValueShape } from "../../valueShape.ts";
import { Segmented } from "../Segmented.tsx";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { DrawField, FieldProps } from "./fieldTypes.ts";
import { JsonEditor } from "./JsonEditor.tsx";

/** No member chosen: the value is none, or fits none. */
const NO_MEMBER = -1;

/** A member's name among the others: its kind, numbered when two share one. */
const memberLabel = (member: ValueShape, members: readonly ValueShape[]): string => {
  const label = EDITOR_STRINGS.memberKinds[member.kind];
  const same = members.filter((each) => EDITOR_STRINGS.memberKinds[each.kind] === label);
  return same.length === 1 ? label : `${label} ${same.indexOf(member) + 1}`;
};

/**
 * A union's editor.
 *
 * @param props - the field's props, and how to draw a member.
 */
export const UnionEditor = ({
  shape,
  value,
  label,
  describedBy,
  namedValues,
  depth,
  onChange,
  drawField
}: FieldProps & {
  readonly shape: { readonly of: readonly ValueShape[] };
  readonly drawField: DrawField;
}): ReactNode => {
  const members = shape.of.filter((member) => canSetShape(member, namedValues));
  const [chosen, setChosen] = useState(NO_MEMBER);
  const fits = (index: number): boolean => {
    const member = members[index];
    return member !== undefined && value !== undefined && isValueOfShape(member, value, namedValues);
  };
  // the member the reader chose while the value still fits it: `"sm"` typed as a text stays a text
  const shown = fits(chosen) ? chosen : members.findIndex((_, index) => fits(index));
  const member = members[shown];
  // what fits no member cannot be drawn by one: its JSON keeps it in sight, and in reach
  if (value !== undefined && member === undefined) {
    return (
      <>
        <p className="forgebook-value-note">{EDITOR_STRINGS.misfitNote}</p>
        <JsonEditor {...{ shape, value, label, describedBy, namedValues, depth, onChange }} />
      </>
    );
  }
  return (
    <div className="forgebook-value-union">
      <Segmented
        label={EDITOR_STRINGS.memberKind(label)}
        options={members.map((each, index) => ({ value: index, label: memberLabel(each, members) }))}
        value={shown}
        onValueChange={(index: number): void => {
          const next = members[index];
          if (next === undefined) return;
          setChosen(index);
          const start = startValueOf(next, namedValues);
          if (start !== undefined) onChange(start);
        }}
      />
      {member === undefined
        ? null
        : drawField({
            shape: member,
            value,
            label,
            describedBy,
            namedValues,
            depth: depth + 1,
            // the member typed in stays the member, whatever other one the value comes to fit on the way
            onChange: (next: ArgValue | undefined): void => {
              setChosen(shown);
              onChange(next);
            }
          })}
    </div>
  );
};
