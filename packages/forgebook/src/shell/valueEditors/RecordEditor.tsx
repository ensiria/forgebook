/**
 * Any names, each holding a value of one shape (`Record<string, number>`): each entry's name and value, added and
 * removed. A name that cannot be kept stays in its field with the reason beside it, and the value is untouched.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId, useState } from "react";

import { type ArgObject, type ArgValue, isArgObject } from "../../messages.ts";
import { isUnsafeFreeName, startValueOf } from "../../shapeValues.ts";
import type { ValueShape } from "../../valueShape.ts";
import { Icon } from "../icons.tsx";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { DrawField, FieldProps } from "./fieldTypes.ts";

/** Names no object holds: a component that merges it would write on every object of the page. */
const PROTOTYPE_NAMES: readonly string[] = ["__proto__", "constructor", "prototype"];

/** Why a name cannot be kept, or none when it can. */
const nameProblem = (name: string, others: readonly string[]): string | undefined => {
  if (name === "") return EDITOR_STRINGS.nameEmpty;
  if (others.includes(name)) return EDITOR_STRINGS.nameTaken;
  return PROTOTYPE_NAMES.includes(name) || isUnsafeFreeName(name) ? EDITOR_STRINGS.nameRefused : undefined;
};

/** An entry's name: what is typed stays here until it can be kept. */
const EntryName = ({
  name,
  others,
  label,
  onRename
}: {
  readonly name: string;
  readonly others: readonly string[];
  readonly label: string;
  readonly onRename: (name: string) => void;
}): ReactNode => {
  const problemId = useId();
  const [draft, setDraft] = useState(name);
  // the row may come to hold another entry (one above it removed, a reset): what was typed was for the last
  const [shownName, setShownName] = useState(name);
  if (shownName !== name) {
    setShownName(name);
    setDraft(name);
  }
  const problem = nameProblem(draft, others);
  return (
    <div className="forgebook-value-record__name">
      <input
        type="text"
        aria-label={EDITOR_STRINGS.fieldName(label)}
        aria-invalid={problem !== undefined}
        aria-describedby={problem === undefined ? undefined : problemId}
        value={draft}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          const next = event.target.value;
          setDraft(next);
          if (nameProblem(next, others) === undefined) onRename(next);
        }}
        onBlur={(): void => {
          if (problem !== undefined) setDraft(name);
        }}
      />
      {problem === undefined ? null : (
        <p id={problemId} className="forgebook-value-note" data-tone="problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
};

/**
 * A record's editor.
 *
 * @param props - the field's props, and how to draw a value.
 */
export const RecordEditor = ({
  shape,
  value,
  label,
  namedValues,
  depth,
  onChange,
  drawField
}: FieldProps & {
  readonly shape: { readonly of: ValueShape };
  readonly drawField: DrawField;
}): ReactNode => {
  const current: ArgObject = value !== undefined && isArgObject(value) ? value : {};
  const entries = Object.entries(current);
  const names = entries.map(([name]) => name);
  const start = startValueOf(shape.of, namedValues);
  const newName = (): string => {
    const base = EDITOR_STRINGS.newField;
    let count = names.length + 1;
    while (names.includes(`${base}${count}`)) count += 1;
    return `${base}${count}`;
  };
  // renamed in place, so the entries keep their order and the field keeps its focus
  const rename = (from: string, to: string): void =>
    onChange(Object.fromEntries(entries.map(([name, each]) => [name === from ? to : name, each])));
  const change = (name: string, next: ArgValue | undefined): void => {
    if (next !== undefined) onChange({ ...current, [name]: next });
  };
  return (
    <div className="forgebook-value-list">
      {entries.length === 0 ? <p className="forgebook-value-note">{EDITOR_STRINGS.emptyList}</p> : null}
      {entries.map(([name, each], index) => {
        const entryLabel = EDITOR_STRINGS.itemName(label, index + 1);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a name changes as it is typed, and the field must keep its focus
          <div key={index} className="forgebook-value-list__item">
            <div className="forgebook-value-record__entry">
              <EntryName
                name={name}
                others={names.filter((other) => other !== name)}
                label={entryLabel}
                onRename={(to: string): void => rename(name, to)}
              />
              <div className="forgebook-value-list__field">
                {drawField({
                  shape: shape.of,
                  value: each,
                  label: EDITOR_STRINGS.fieldValue(entryLabel, name),
                  namedValues,
                  depth: depth + 1,
                  onChange: (next: ArgValue | undefined): void => change(name, next)
                })}
              </div>
            </div>
            <div className="forgebook-value-list__buttons">
              <button
                type="button"
                className="forgebook-prop__action"
                aria-label={EDITOR_STRINGS.removeItem(entryLabel)}
                title={EDITOR_STRINGS.removeItem(entryLabel)}
                onClick={(): void => {
                  const { [name]: _removed, ...rest } = current;
                  onChange(rest);
                }}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="forgebook-text-button forgebook-value-add"
        disabled={start === undefined}
        onClick={(): void => {
          if (start !== undefined) onChange({ ...current, [newName()]: start });
        }}
      >
        <Icon name="plus" size={12} />
        {EDITOR_STRINGS.addItem(label)}
      </button>
    </div>
  );
};
