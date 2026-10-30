/**
 * The fields of the props panel that set a value from a list or a number: a choice (buttons, a list, checkboxes, a
 * list of several), a number, a range and a date, as the prop's type or its `argTypes` say.
 *
 * @module
 */

import type { ChangeEvent, ReactNode } from "react";

import type { PanelProp } from "../argTypes.ts";
import { type ArgValue, isChoiceList } from "../messages.ts";
import { Segmented } from "./Segmented.tsx";
import { STRINGS } from "./strings.ts";

/** Called with a changed value; `undefined` removes the panel's value. */
export type OnValueChange = (name: string, value: ArgValue | undefined) => void;

/** A value as a text field shows it: texts and numbers as they are, anything else empty. */
export const textOf = (value: ArgValue | undefined): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** A value as a choice holds it: a text or a number, otherwise none. */
const choiceOf = (value: ArgValue | undefined): string | number | undefined =>
  typeof value === "string" || typeof value === "number" ? value : undefined;

/** A choice's value as the panel shows it: its `argTypes` label, or the value. */
const choiceLabel = (prop: PanelProp, choice: string | number): string =>
  prop.labels?.[String(choice)] ?? String(choice);

/** A number of ms since the Unix epoch as a `datetime-local` field holds it, in the browser's time zone. */
const dateFieldOf = (value: ArgValue | undefined): string => {
  if (typeof value !== "number") return "";
  const date = new Date(value);
  const local = new Date(value - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

/** The value of the choice that leaves a prop to the story: no choice of a component is an empty text. */
const UNSET = "";

/** The most choices shown as buttons, and the longest label; past either, a list. */
const FEW_CHOICES = { count: 4, length: 10 } as const;

/** Whether a choice's values fit side by side as buttons. */
const isFewChoices = (choices: readonly (string | number)[]): boolean =>
  choices.length <= FEW_CHOICES.count &&
  choices.every((choice) => choice !== UNSET && String(choice).length <= FEW_CHOICES.length);

/** A choice of several values: checkboxes (`check`) or a list that takes several (`multi-select`). */
const MultiChoiceControl = ({
  prop,
  value,
  descriptionId,
  onValueChange
}: {
  readonly prop: PanelProp;
  readonly value: ArgValue | undefined;
  readonly descriptionId: string;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  const choices = prop.choices ?? [];
  const chosen = isChoiceList(value) ? value : [];
  // the values keep the order of the options, whatever order they were picked in
  const change = (next: readonly (string | number)[]): void =>
    onValueChange(
      prop.name,
      choices.filter((choice) => next.includes(choice))
    );
  if (prop.control === "multi-select") {
    return (
      <select
        multiple
        aria-label={prop.label ?? prop.name}
        aria-describedby={descriptionId}
        value={chosen.map(String)}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
          const picked = [...event.target.selectedOptions].map((option) => option.value);
          change(choices.filter((choice) => picked.includes(String(choice))));
        }}
      >
        {choices.map((choice) => (
          <option key={String(choice)} value={String(choice)}>
            {choiceLabel(prop, choice)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <fieldset className="forgebook-prop__checks" aria-describedby={descriptionId}>
      <legend className="forgebook-visually-hidden">{prop.label ?? prop.name}</legend>
      {choices.map((choice) => (
        <label key={String(choice)} className="forgebook-toggle">
          <input
            type="checkbox"
            checked={chosen.includes(choice)}
            onChange={(event: ChangeEvent<HTMLInputElement>): void =>
              change(event.target.checked ? [...chosen, choice] : chosen.filter((other) => other !== choice))
            }
          />
          {choiceLabel(prop, choice)}
        </label>
      ))}
    </fieldset>
  );
};

/**
 * A choice's control: buttons side by side for `radio` or a few short values, a list for `select` or otherwise, and
 * a multiple choice for `check` and `multi-select`.
 */
export const ChoiceControl = ({
  prop,
  value,
  descriptionId,
  onValueChange
}: {
  readonly prop: PanelProp;
  readonly value: ArgValue | undefined;
  readonly descriptionId: string;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  if (prop.control === "check" || prop.control === "multi-select") {
    return (
      <MultiChoiceControl
        prop={prop}
        value={value}
        descriptionId={descriptionId}
        onValueChange={onValueChange}
      />
    );
  }
  const choices = prop.choices ?? [];
  const unsetLabel =
    prop.defaultValue === undefined ? STRINGS.unset : STRINGS.unsetDefault(prop.defaultValue);
  const isButtons = prop.control === "radio" || (prop.control === undefined && isFewChoices(choices));
  if (isButtons) {
    return (
      <Segmented
        label={prop.label ?? prop.name}
        options={[
          { value: UNSET, label: unsetLabel },
          ...choices.map((choice) => ({ value: choice, label: choiceLabel(prop, choice) }))
        ]}
        value={choiceOf(value) ?? UNSET}
        onValueChange={(chosen: string | number): void =>
          onValueChange(prop.name, chosen === UNSET ? undefined : chosen)
        }
      />
    );
  }
  return (
    <select
      aria-label={prop.label ?? prop.name}
      aria-describedby={descriptionId}
      value={textOf(value)}
      onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
        const chosen = choices.find((choice) => String(choice) === event.target.value);
        onValueChange(prop.name, chosen);
      }}
    >
      <option value="">{unsetLabel}</option>
      {choices.map((choice) => (
        <option key={String(choice)} value={String(choice)}>
          {choiceLabel(prop, choice)}
        </option>
      ))}
    </select>
  );
};

/** A field for a number, a range or a date, as its `argTypes` say; a date's value is ms since the Unix epoch. */
export const NumberField = ({
  prop,
  value,
  descriptionId,
  onValueChange
}: {
  readonly prop: PanelProp;
  readonly value: ArgValue | undefined;
  readonly descriptionId: string;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  const label = prop.label ?? prop.name;
  if (prop.control === "date") {
    return (
      <input
        type="datetime-local"
        aria-label={label}
        aria-describedby={descriptionId}
        value={dateFieldOf(value)}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          const time = event.target.valueAsNumber;
          // the field's own value is in UTC: read back in the browser's time zone, as it was shown
          const local = Number.isNaN(time) ? undefined : time + new Date(time).getTimezoneOffset() * 60_000;
          onValueChange(prop.name, local);
        }}
      />
    );
  }
  const bounds = {
    ...(prop.min === undefined ? {} : { min: prop.min }),
    ...(prop.max === undefined ? {} : { max: prop.max }),
    ...(prop.step === undefined ? {} : { step: prop.step })
  };
  const change = (text: string): void => onValueChange(prop.name, text === "" ? undefined : Number(text));
  return (
    <>
      {prop.control === "range" ? (
        <input
          type="range"
          aria-label={label}
          aria-describedby={descriptionId}
          {...bounds}
          value={typeof value === "number" ? value : (prop.min ?? 0)}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => change(event.target.value)}
        />
      ) : null}
      <input
        type="number"
        aria-label={prop.control === "range" ? STRINGS.rangeValue(label) : label}
        aria-describedby={descriptionId}
        {...bounds}
        value={textOf(value)}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => change(event.target.value)}
      />
    </>
  );
};
