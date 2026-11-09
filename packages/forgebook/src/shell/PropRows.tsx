/**
 * One prop of the Props tab as it is drawn: its head (its name, whether it is required, its group in the "Required"
 * group, its type), then its control, or its description for reading.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import { isColorProp, type PanelProp } from "../argTypes.ts";
import { type ArgValue, isUnsetArg, UNSET_ARG } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { ArgControlLoaders } from "./customControls.ts";
import { Icon, type IconName } from "./icons.tsx";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import { ChoiceControl, MOST_PLAIN_OPTIONS, NumberField, type OnValueChange, textOf } from "./PropFields.tsx";
import { Switch } from "./Switch.tsx";
import { STRINGS } from "./strings.ts";
import type { PropEditorProps } from "./valueEditors/PropEditor.tsx";

/** A prop the story gives a text by its key (`storyText("key")`): the key, and whether the panel wrote over it. */
export type TextArgNote = {
  /** The text's key. */
  readonly key: string;
  /** Whether the panel holds a value of its own for the prop. */
  readonly isChanged: boolean;
};

/** The editors a catalogue's plain props never load: nested fields, a searchable list, the tokens, the files. */
const PROP_EDITOR = lazyModule(() =>
  import("./valueEditors/PropEditor.tsx").then((module) => module.PropEditor)
);

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

/** What a field says of its value, and the two ways back from it. */
export type FieldState = {
  /** The value shown: the story's own, or the panel's over it. */
  readonly value: ArgValue | undefined;
  /** The panel's own value; none when the story's own is shown. */
  readonly panelValue: ArgValue | undefined;
  /** Called with a changed value. */
  readonly onValueChange: OnValueChange;
};

/**
 * The way back from a prop's value: to no value at all, and to the story's own, each offered only when it changes
 * something.
 *
 * @param props - the prop and its state.
 */
const FieldActions = ({
  prop,
  value,
  panelValue,
  onValueChange
}: FieldState & { readonly prop: PanelProp }): ReactNode => {
  const label = prop.label ?? prop.name;
  const action = (text: string, icon: IconName, next: ArgValue | undefined): ReactNode => (
    <button
      type="button"
      className="forgebook-prop__action"
      aria-label={text}
      title={text}
      onClick={(): void => onValueChange(prop.name, next)}
    >
      <Icon name={icon} size={12} />
    </button>
  );
  return (
    <span className="forgebook-prop__actions">
      {value === undefined ? null : action(STRINGS.unsetProp(label), "noValue", UNSET_ARG)}
      {panelValue === undefined ? null : action(STRINGS.resetProp(label), "replay", undefined)}
    </span>
  );
};

/** What a prop's value is when its field alone cannot say: no value over the story's own, or an empty text. */
const stateNote = (state: FieldState): string | undefined => {
  if (isUnsetArg(state.panelValue)) return STRINGS.stateUnset;
  return state.value === "" ? STRINGS.stateEmpty : undefined;
};

/**
 * A prop's name, whether it is required, its group when asked, its type (whole in the tooltip when it is cut), what its
 * value is and the ways back from it.
 *
 * @param props - the prop, whether it names its group, and its state.
 */
const PropHead = ({
  prop,
  showsGroup,
  state
}: {
  readonly prop: PanelProp;
  readonly showsGroup: boolean;
  readonly state?: FieldState;
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
    {state === undefined ? null : (
      <>
        {stateNote(state) === undefined ? null : (
          <span className="forgebook-prop__state">{stateNote(state)}</span>
        )}
        <FieldActions prop={prop} {...state} />
      </>
    )}
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

/** Whether a prop is drawn by the editors that load on use, not by the first screen's fields. */
const usesEditors = (prop: PanelProp, named: Readonly<Record<string, unknown>> | undefined): boolean =>
  named !== undefined ||
  prop.shape !== undefined ||
  prop.customControl !== undefined ||
  prop.control === "token" ||
  prop.control === "file" ||
  (prop.kind === "choice" &&
    (prop.control === undefined || prop.control === "select") &&
    (prop.choices?.length ?? 0) > MOST_PLAIN_OPTIONS);

/** One adjustable prop with its control: a boolean's is a switch. */
export const PropControl = ({
  prop,
  showsGroup,
  value,
  panelValue,
  named,
  namedValues,
  loadTokens,
  argControls,
  textArg,
  onValueChange
}: {
  readonly prop: PanelProp;
  /** Whether it names its group: in the "Required" group. */
  readonly showsGroup: boolean;
  readonly value: ArgValue | undefined;
  /** The panel's own value; none when the story's own is shown. */
  readonly panelValue: ArgValue | undefined;
  /** The values the source names for the prop's type, when it names some. */
  readonly named: Readonly<Record<string, unknown>> | undefined;
  /** The source's named values, for the parts of a value they fill. */
  readonly namedValues: NamedValues;
  /** Loads the catalogue's design tokens; none when it has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
  /** Loads each custom control the catalogue registers, by name; none when it registers none. */
  readonly argControls?: ArgControlLoaders | undefined;
  /** Where the story's text for the prop comes from, when the story names one by its key. */
  readonly textArg: TextArgNote | undefined;
  readonly onValueChange: OnValueChange;
}): ReactNode => {
  // the description is shown under the control and named by it, so the control's name is the prop alone
  const descriptionId = useId();
  const label = prop.label ?? prop.name;
  const state: FieldState = { value, panelValue, onValueChange };
  if (prop.kind === "toggle") {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} showsGroup={showsGroup} state={state} />
        <div className="forgebook-prop__field">
          <Switch
            label={label}
            isOn={value === true}
            describedBy={descriptionId}
            onChange={(isOn: boolean): void => onValueChange(prop.name, isOn)}
          />
        </div>
        <PropNote id={descriptionId} prop={prop} />
      </div>
    );
  }
  if (usesEditors(prop, named)) {
    const editorProps: PropEditorProps = {
      prop,
      value,
      descriptionId,
      namedValues,
      loadTokens,
      argControls,
      onValueChange
    };
    const isWide = (prop.shape !== undefined || prop.customControl !== undefined) && named === undefined;
    return (
      <div className="forgebook-prop" data-wide={isWide || undefined}>
        <PropHead prop={prop} showsGroup={showsGroup} state={state} />
        <LazyView
          module={PROP_EDITOR}
          props={editorProps}
          loading={null}
          failed={(message: string): ReactNode => (
            <p className="forgebook-prop__description" role="alert">
              {message}
            </p>
          )}
        />
        <PropNote id={descriptionId} prop={prop} />
      </div>
    );
  }
  if (prop.kind === "choice") {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} showsGroup={showsGroup} state={state} />
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
        <PropHead prop={prop} showsGroup={showsGroup} state={state} />
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
  // a text with a line break keeps it: an `<input>` would drop it, from the field and from the link
  const isMultiline = prop.control === "textarea" || (typeof value === "string" && value.includes("\n"));
  const TextControl = isMultiline ? "textarea" : "input";
  return (
    <div className="forgebook-prop">
      <PropHead prop={prop} showsGroup={showsGroup} state={state} />
      <div className="forgebook-prop__field">
        <TextControl
          aria-label={label}
          aria-describedby={descriptionId}
          {...(isMultiline ? { rows: 4 } : { type: "text" })}
          value={textOf(value)}
          onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
            onValueChange(prop.name, event.target.value)
          }
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
