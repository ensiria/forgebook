/**
 * One prop of the Props tab as it is drawn: its head (its name, whether it is required, its group in the "Required"
 * group, its type), then its control, its toggle, or its description for reading.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import { isColorProp, type PanelProp } from "../argTypes.ts";
import { type ArgValue, isNamedArg } from "../messages.ts";
import { ChoiceControl, NumberField, type OnValueChange, textOf } from "./PropFields.tsx";
import { STRINGS } from "./strings.ts";

/** A prop the story gives a text by its key (`storyText("key")`): the key, and whether the panel wrote over it. */
export type TextArgNote = {
  /** The text's key. */
  readonly key: string;
  /** Whether the panel holds a value of its own for the prop. */
  readonly isChanged: boolean;
};

/** A CSS colour as the colour picker takes it (`#rrggbb`), or black when the value is not one. */
const pickerColor = (value: ArgValue | undefined): string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";

/** A prop's group, beside its name in the "Required" group, which gathers props of every group. */
const GroupName = ({
  prop,
  showsGroup
}: {
  readonly prop: PanelProp;
  readonly showsGroup: boolean;
}): ReactNode =>
  showsGroup && prop.group !== undefined ? <span className="forgebook-prop__group">{prop.group}</span> : null;

/**
 * A prop's name, whether it is required, its group when asked, and its type (whole in the tooltip when it is cut).
 *
 * @param props - the prop, and whether it names its group.
 */
const PropHead = ({
  prop,
  showsGroup
}: {
  readonly prop: PanelProp;
  readonly showsGroup: boolean;
}): ReactNode => (
  <div className="forgebook-prop__head">
    <code className="forgebook-prop__name">
      {prop.label ?? prop.name}
      {prop.isRequired ? (
        <span className="forgebook-prop__required" title={STRINGS.required}>
          *
        </span>
      ) : null}
    </code>
    <GroupName prop={prop} showsGroup={showsGroup} />
    <code className="forgebook-prop__type" title={prop.type}>
      {prop.type}
    </code>
  </div>
);

/** A prop's description and default, under its control. */
const PropNote = ({ id, prop }: { readonly id: string; readonly prop: PanelProp }): ReactNode =>
  prop.description === "" && prop.defaultValue === undefined ? null : (
    <p id={id} className="forgebook-prop__description">
      {prop.description}
      {prop.defaultValue === undefined ? null : (
        <>
          {prop.description === "" ? null : " "}
          {STRINGS.defaultIs} <code>{prop.defaultValue}</code>
        </>
      )}
    </p>
  );

/**
 * Where a prop's text comes from, under its field: the key of the story's text, and a way back to it once the panel
 * wrote over it.
 *
 * @param props - the note, the prop's name and the value setter.
 */
const TextArgLine = ({
  note,
  name,
  onValueChange
}: {
  readonly note: TextArgNote;
  readonly name: string;
  readonly onValueChange: OnValueChange;
}): ReactNode => (
  <p className="forgebook-prop__text-arg">
    {STRINGS.fromTexts} <code>{note.key}</code>
    {note.isChanged ? (
      <button
        type="button"
        className="forgebook-text-button"
        onClick={(): void => onValueChange(name, undefined)}
      >
        {STRINGS.backToText}
      </button>
    ) : null}
  </p>
);

/** One adjustable prop with its control. */
export const PropControl = ({
  prop,
  showsGroup,
  value,
  named,
  textArg,
  onValueChange
}: {
  readonly prop: PanelProp;
  /** Whether it names its group: in the "Required" group. */
  readonly showsGroup: boolean;
  readonly value: ArgValue | undefined;
  /** The values the source names for the prop's type, when it names some. */
  readonly named: Readonly<Record<string, unknown>> | undefined;
  /** Where the story's text for the prop comes from, when the story names one by its key. */
  readonly textArg: TextArgNote | undefined;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  // the description is shown under the control and named by it, so the control's name is the prop alone
  const descriptionId = useId();
  const label = prop.label ?? prop.name;
  if (named !== undefined) {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} showsGroup={showsGroup} />
        <select
          aria-label={label}
          aria-describedby={descriptionId}
          value={isNamedArg(value) ? value.named : ""}
          onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
            const chosen = event.target.value;
            onValueChange(prop.name, chosen === "" ? undefined : { of: prop.type, named: chosen });
          }}
        >
          <option value="">{STRINGS.unset}</option>
          {Object.keys(named).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <PropNote id={descriptionId} prop={prop} />
      </div>
    );
  }
  if (prop.kind === "choice") {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} showsGroup={showsGroup} />
        <ChoiceControl
          prop={prop}
          value={value}
          descriptionId={descriptionId}
          onValueChange={onValueChange}
        />
        <PropNote id={descriptionId} prop={prop} />
      </div>
    );
  }
  if (prop.kind === "number") {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} showsGroup={showsGroup} />
        <div className="forgebook-prop__field">
          <NumberField
            prop={prop}
            value={value}
            descriptionId={descriptionId}
            onValueChange={onValueChange}
          />
        </div>
        <PropNote id={descriptionId} prop={prop} />
      </div>
    );
  }
  return (
    <div className="forgebook-prop">
      <PropHead prop={prop} showsGroup={showsGroup} />
      <div className="forgebook-prop__field">
        <input
          type="text"
          aria-label={label}
          aria-describedby={descriptionId}
          value={textOf(value)}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            const text = event.target.value;
            onValueChange(prop.name, text === "" ? undefined : text);
          }}
        />
        {/* a colour picker beside the text: the field still takes any CSS colour, a token's var() included */}
        {isColorProp(prop) ? (
          <input
            type="color"
            className="forgebook-prop__color"
            aria-label={STRINGS.pickColor(label)}
            value={pickerColor(value)}
            onChange={(event: ChangeEvent<HTMLInputElement>): void =>
              onValueChange(prop.name, event.target.value)
            }
          />
        ) : null}
      </div>
      {textArg === undefined ? null : (
        <TextArgLine note={textArg} name={prop.name} onValueChange={onValueChange} />
      )}
      <PropNote id={descriptionId} prop={prop} />
    </div>
  );
};

/** A toggle: its name in a compact checkbox, its description as the tooltip and for screen readers. */
export const Toggle = ({
  prop,
  showsGroup,
  value,
  onValueChange
}: {
  readonly prop: PanelProp;
  /** Whether it names its group: in the "Required" group. */
  readonly showsGroup: boolean;
  readonly value: ArgValue | undefined;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  const descriptionId = useId();
  return (
    <label className="forgebook-toggle" title={prop.description}>
      <input
        type="checkbox"
        aria-label={prop.label ?? prop.name}
        checked={value === true}
        aria-describedby={descriptionId}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          onValueChange(prop.name, event.target.checked)
        }
      />
      <code>{prop.label ?? prop.name}</code>
      <GroupName prop={prop} showsGroup={showsGroup} />
      <span id={descriptionId} className="forgebook-visually-hidden">
        {prop.description}
      </span>
    </label>
  );
};

/** A prop the panel cannot set: its name, its type and its description, for reading; its group when asked. */
export const ReadOnlyProp = ({
  prop,
  showsGroup
}: {
  readonly prop: PanelProp;
  readonly showsGroup: boolean;
}): ReactNode => (
  <div className="forgebook-prop">
    <PropHead prop={prop} showsGroup={showsGroup} />
    <p className="forgebook-prop__description">{prop.description}</p>
  </div>
);
