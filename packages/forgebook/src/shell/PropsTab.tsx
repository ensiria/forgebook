/**
 * The panel's Props tab: the props the story lets the panel set, grouped by control (choices, text and numbers,
 * toggles), each with its description and default, then the props it cannot set. A story of fixed examples sets none:
 * the tab says so and lists every prop for reading (D-64). The props come with the story's `argTypes` laid over them
 * (`argTypes.ts`): a control they name (a list, buttons, checkboxes, a range, a colour, a date) wins over the one
 * the prop's type gives.
 *
 * @module
 */

import type { StoryControlsSetting } from "@forgebook/story-format/source";
import { type ChangeEvent, type ReactNode, useId } from "react";

import type { PanelProp } from "../argTypes";
import { type ArgValue, isNamedArg, type PanelArgs } from "../messages";
import type { NamedValues } from "../namedValues";
import { ChoiceControl, NumberField, textOf } from "./PropFields";
import { STRINGS } from "./strings";

/** A prop the story gives a text by its key (`storyText("key")`): the key, and whether the panel wrote over it. */
export type TextArgNote = {
  /** The text's key. */
  readonly key: string;
  /** Whether the panel holds a value of its own for the prop. */
  readonly isChanged: boolean;
};

/** The tab's props. */
export type PropsTabProps = {
  /** The props, from the component's types with the story's `argTypes` laid over them. */
  readonly props: readonly PanelProp[];
  /** The values shown: the story's args with the panel's changes. */
  readonly values: PanelArgs;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** Called with a changed value; `undefined` removes the panel's value. */
  readonly onValueChange: (name: string, value: ArgValue | undefined) => void;
  /** Removes every value the panel set. */
  readonly onReset: () => void;
  /** The values the source offers by name for a type the panel cannot write (`IconComponent`); none by default. */
  readonly namedValues?: NamedValues | undefined;
  /** The props the story gives a text by its key, by name; none by default. */
  readonly textArgs?: Readonly<Record<string, TextArgNote>>;
};

/** A colour prop: named so by its `argTypes`, or by the name convention (`color`, `accentColor`). */
const isColorProp = (prop: PanelProp): boolean =>
  prop.control === "color" ||
  (prop.control === undefined &&
    prop.kind === "text" &&
    (prop.name === "color" || prop.name.endsWith("Color")));

/** A CSS colour as the colour picker takes it (`#rrggbb`), or black when the value is not one. */
const pickerColor = (value: ArgValue | undefined): string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";

/** No prop named by a text key. */
const NO_TEXT_ARGS: Readonly<Record<string, TextArgNote>> = {};

/** A prop's name, whether it is required, and its type (whole in the tooltip when it is cut). */
const PropHead = ({ prop }: { readonly prop: PanelProp }): ReactNode => (
  <div className="forgebook-prop__head">
    <code className="forgebook-prop__name">
      {prop.label ?? prop.name}
      {prop.isRequired ? (
        <span className="forgebook-prop__required" title={STRINGS.required}>
          *
        </span>
      ) : null}
    </code>
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
  readonly onValueChange: PropsTabProps["onValueChange"];
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
const PropControl = ({
  prop,
  value,
  named,
  textArg,
  onValueChange
}: {
  readonly prop: PanelProp;
  readonly value: ArgValue | undefined;
  /** The values the source names for the prop's type, when it names some. */
  readonly named: Readonly<Record<string, unknown>> | undefined;
  /** Where the story's text for the prop comes from, when the story names one by its key. */
  readonly textArg: TextArgNote | undefined;
  readonly onValueChange: PropsTabProps["onValueChange"];
}): ReactNode => {
  // the description is shown under the control and named by it, so the control's name is the prop alone
  const descriptionId = useId();
  const label = prop.label ?? prop.name;
  if (named !== undefined) {
    return (
      <div className="forgebook-prop">
        <PropHead prop={prop} />
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
        <PropHead prop={prop} />
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
        <PropHead prop={prop} />
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
      <PropHead prop={prop} />
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
const Toggle = ({
  prop,
  value,
  onValueChange
}: {
  readonly prop: PanelProp;
  readonly value: ArgValue | undefined;
  readonly onValueChange: PropsTabProps["onValueChange"];
}): ReactNode => {
  const descriptionId = useId();
  return (
    <label className="forgebook-toggle" title={prop.description}>
      <input
        type="checkbox"
        checked={value === true}
        aria-describedby={descriptionId}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          onValueChange(prop.name, event.target.checked)
        }
      />
      <code>{prop.label ?? prop.name}</code>
      <span id={descriptionId} className="forgebook-visually-hidden">
        {prop.description}
      </span>
    </label>
  );
};

/**
 * The Props tab.
 *
 * @param props - the props, the values, which props the story lets the panel set, and the setters.
 */
export const PropsTab = ({
  props,
  values,
  controls,
  onValueChange,
  onReset,
  namedValues = {},
  textArgs = NO_TEXT_ARGS
}: PropsTabProps): ReactNode => {
  // a prop of a type the source names values for is chosen among them, a node that takes a text is set as one; any
  // other `other` prop cannot be set from the panel
  const isNamed = (prop: PanelProp): boolean =>
    prop.kind === "other" && prop.control === undefined && namedValues[prop.type] !== undefined;
  const isSettable = (prop: PanelProp): boolean =>
    (prop.kind !== "other" || prop.canTakeText === true || isNamed(prop)) &&
    prop.kind !== "event" &&
    (controls === "all" || controls.includes(prop.name));
  const settable = props.filter(isSettable);
  const groups = [
    {
      title: STRINGS.propGroups.choice,
      props: settable.filter((prop) => prop.kind === "choice" || isNamed(prop))
    },
    {
      title: STRINGS.propGroups.text,
      props: settable.filter((prop) => ["text", "number", "other"].includes(prop.kind) && !isNamed(prop))
    }
  ].filter((group) => group.props.length > 0);
  const toggles = settable.filter((prop) => prop.kind === "toggle");
  const others = props.filter((prop) => prop.kind !== "event" && !isSettable(prop));
  const hasControls = controls === "all" || controls.length > 0;
  return (
    <div className="forgebook-tab-props">
      {hasControls ? null : <p className="forgebook-tab-note">{STRINGS.fixedExamples}</p>}
      {groups.map((group) => (
        <div key={group.title} className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{group.title}</h3>
          <div className="forgebook-prop-grid">
            {group.props.map((prop) => (
              <PropControl
                key={prop.name}
                prop={prop}
                value={values[prop.name]}
                named={isNamed(prop) ? namedValues[prop.type] : undefined}
                textArg={textArgs[prop.name]}
                onValueChange={onValueChange}
              />
            ))}
          </div>
        </div>
      ))}
      {toggles.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{STRINGS.propGroups.toggle}</h3>
          <div className="forgebook-toggles">
            {toggles.map((prop) => (
              <Toggle key={prop.name} prop={prop} value={values[prop.name]} onValueChange={onValueChange} />
            ))}
          </div>
        </div>
      )}
      {others.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">
            {hasControls ? STRINGS.otherProps : STRINGS.allProps}
          </h3>
          <div className="forgebook-prop-grid">
            {others.map((prop) => (
              <div key={prop.name} className="forgebook-prop">
                <PropHead prop={prop} />
                <p className="forgebook-prop__description">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasControls ? (
        <div className="forgebook-tab-foot">
          <button type="button" className="forgebook-text-button" onClick={onReset}>
            {STRINGS.resetArgs}
          </button>
        </div>
      ) : null}
    </div>
  );
};
