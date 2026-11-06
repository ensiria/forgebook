/**
 * One value's field, by what it looks like: a text, a number, a toggle, a choice, a named value, or the editor of a list,
 * an object, a union or JSON. A value that does not fit its shape, or is too much to draw, falls back to JSON with a note,
 * so what the panel sends always fits and nothing a story holds is hidden.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useState } from "react";

import { type ArgValue, isArgList, isArgObject, isNamedArg } from "../../messages.ts";
import { isValueOfShape } from "../../shapeValues.ts";
import type { ValueShape } from "../../valueShape.ts";
import { MOST_PLAIN_OPTIONS } from "../PropFields.tsx";
import { STRINGS } from "../strings.ts";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { FieldProps } from "./fieldTypes.ts";
import { JsonEditor } from "./JsonEditor.tsx";
import { ListEditor } from "./ListEditor.tsx";
import { ObjectEditor, TupleEditor } from "./ObjectEditor.tsx";
import { RecordEditor } from "./RecordEditor.tsx";
import { SearchSelect } from "./SearchSelect.tsx";
import { UnionEditor } from "./UnionEditor.tsx";

/** The most parts of a value drawn as fields: past it, a page of inputs is slower to use than its JSON. */
const MOST_DRAWN_PARTS = 150;

/** How many parts a value has. */
const partsOf = (value: ArgValue): number => {
  if (isArgList(value)) return value.reduce<number>((sum, item) => sum + partsOf(item), 1);
  if (isArgObject(value)) return Object.values(value).reduce<number>((sum, item) => sum + partsOf(item), 1);
  return 1;
};

/** Whether a shape is drawn as more than one field, so a person may want its JSON instead. */
const isStructured = (shape: ValueShape): boolean =>
  shape.kind === "object" || shape.kind === "list" || shape.kind === "record" || shape.kind === "tuple";

/**
 * A number's field: what is typed stays as typed, and only a number reaches the value. A required number has no empty
 * value, so what was left empty comes back when the field is left.
 *
 * @param props - the field's props.
 */
const NumberLeaf = ({ value, label, describedBy, onChange }: FieldProps): ReactNode => {
  const shown = typeof value === "number" ? String(value) : "";
  const [draft, setDraft] = useState<string | undefined>(undefined);
  return (
    <input
      type="number"
      aria-label={label}
      aria-describedby={describedBy}
      value={draft ?? shown}
      onChange={(event: ChangeEvent<HTMLInputElement>): void => {
        const text = event.target.value;
        setDraft(text);
        if (text !== "" && Number.isFinite(Number(text))) onChange(Number(text));
      }}
      onBlur={(): void => setDraft(undefined)}
    />
  );
};

/** A choice's field: a native list for a few options, a search among many. */
const ChoiceLeaf = ({
  shape,
  value,
  label,
  describedBy,
  isRequired = false,
  onChange
}: FieldProps & { readonly shape: { readonly values: readonly (string | number)[] } }): ReactNode => {
  const shown = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  const chooseText = (text: string | undefined): void =>
    onChange(shape.values.find((each) => String(each) === text));
  if (shape.values.length > MOST_PLAIN_OPTIONS) {
    return (
      <SearchSelect
        label={label}
        describedBy={describedBy}
        options={shape.values.map((each) => ({ value: String(each), label: String(each) }))}
        value={shown}
        canClear={!isRequired}
        onChange={chooseText}
      />
    );
  }
  return (
    <select
      aria-label={label}
      aria-describedby={describedBy}
      value={shown ?? ""}
      onChange={(event: ChangeEvent<HTMLSelectElement>): void => chooseText(event.target.value)}
    >
      {isRequired ? null : <option value="">{STRINGS.unset}</option>}
      {shape.values.map((each) => (
        <option key={String(each)} value={String(each)}>
          {String(each)}
        </option>
      ))}
    </select>
  );
};

/** A named value's field: a search among the names the source offers for its type. */
const NamedLeaf = ({
  shape,
  value,
  label,
  describedBy,
  namedValues,
  depth,
  isRequired = false,
  onChange
}: FieldProps & { readonly shape: { readonly type: string; readonly canTakeText?: true } }): ReactNode => {
  const names = Object.hasOwn(namedValues, shape.type) ? Object.keys(namedValues[shape.type] ?? {}) : [];
  if (shape.canTakeText === true) {
    // a slot takes a named value or a text: the same choice as any union
    const members: readonly ValueShape[] =
      names.length === 0 ? [{ kind: "text" }] : [{ kind: "named", type: shape.type }, { kind: "text" }];
    return ValueField({
      shape: members.length === 1 ? { kind: "text" } : { kind: "union", of: members },
      value,
      label,
      describedBy,
      namedValues,
      depth,
      isRequired,
      onChange
    });
  }
  return (
    <SearchSelect
      label={label}
      describedBy={describedBy}
      options={names.map((name) => ({ value: name, label: name }))}
      value={value !== undefined && isNamedArg(value) ? value.named : undefined}
      canClear={!isRequired}
      onChange={(name: string | undefined): void =>
        onChange(name === undefined ? undefined : { of: shape.type, named: name })
      }
    />
  );
};

/** A text's field: one line, or several once the text holds a line break, which a one-line field would drop. */
const TextLeaf = ({ value, label, describedBy, onChange }: FieldProps): ReactNode => {
  const text = typeof value === "string" ? value : "";
  return text.includes("\n") ? (
    <textarea
      aria-label={label}
      aria-describedby={describedBy}
      rows={3}
      value={text}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => onChange(event.target.value)}
    />
  ) : (
    <input
      type="text"
      aria-label={label}
      aria-describedby={describedBy}
      value={text}
      onChange={(event: ChangeEvent<HTMLInputElement>): void => onChange(event.target.value)}
    />
  );
};

/** A value's fields, or its JSON when a reader asks for it. */
const StructuredField = (props: FieldProps): ReactNode => {
  const { shape, value, label, namedValues, depth } = props;
  const [isJson, setIsJson] = useState(false);
  const isMisfit = value !== undefined && !isValueOfShape(shape, value, namedValues);
  const isTooLarge = value !== undefined && partsOf(value) > MOST_DRAWN_PARTS;
  const drawn = (): ReactNode => {
    switch (shape.kind) {
      case "list":
        return <ListEditor {...props} shape={shape} drawField={ValueField} />;
      case "tuple":
        return <TupleEditor {...props} shape={shape} drawField={ValueField} />;
      case "object":
        return <ObjectEditor {...props} shape={shape} drawField={ValueField} />;
      case "record":
        return <RecordEditor {...props} shape={shape} drawField={ValueField} />;
      default:
        return <JsonEditor {...props} />;
    }
  };
  if (isMisfit || isTooLarge) {
    return (
      <>
        <p className="forgebook-value-note">
          {isMisfit ? EDITOR_STRINGS.misfitNote : EDITOR_STRINGS.tooLargeNote}
        </p>
        <JsonEditor {...props} />
      </>
    );
  }
  if (depth > 0) return drawn();
  return (
    <>
      <div className="forgebook-value-switch">
        <button
          type="button"
          className="forgebook-text-button"
          aria-pressed={isJson}
          aria-label={EDITOR_STRINGS.editAsJsonHint(label)}
          onClick={(): void => setIsJson(!isJson)}
        >
          {EDITOR_STRINGS.editAsJson}
        </button>
      </div>
      {isJson ? <JsonEditor {...props} /> : drawn()}
    </>
  );
};

/**
 * One value's field.
 *
 * @param props - the field's props.
 */
export const ValueField = (props: FieldProps): ReactNode => {
  const { shape } = props;
  if (isStructured(shape)) return <StructuredField {...props} />;
  switch (shape.kind) {
    case "text":
      return <TextLeaf {...props} />;
    case "number":
      return <NumberLeaf {...props} />;
    case "boolean":
      return (
        <input
          type="checkbox"
          aria-label={props.label}
          aria-describedby={props.describedBy}
          checked={shape.only ?? props.value === true}
          disabled={shape.only !== undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => props.onChange(event.target.checked)}
        />
      );
    case "choice":
      return <ChoiceLeaf {...props} shape={shape} />;
    case "named":
      return <NamedLeaf {...props} shape={shape} />;
    case "union":
      return <UnionEditor {...props} shape={shape} drawField={ValueField} />;
    default:
      return <JsonEditor {...props} />;
  }
};
