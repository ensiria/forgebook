/**
 * The panel's Props tab: the props the story lets the panel set, grouped by control (choices, text and numbers, objects
 * and lists, toggles), each with its description and default, then the props it cannot set. A story of fixed examples sets none:
 * the tab says so and lists every prop for reading. The props come with the story's `argTypes` laid over them
 * (`argTypes.ts`): a control they name (a list, buttons, checkboxes, a range, a colour, a date) wins over the one
 * the prop's type gives.
 *
 * @remarks
 * Props whose TSDoc names a group (`@group Selection`) are listed under its name after the others, as the API reference
 * lists them (`propGroups.ts`): each group's controls, its toggles, then its props the panel cannot set. Each starts
 * open, and a reader may fold it away. A component whose props name no group shows the tab as it always was.
 *
 * The required props come first among each kind of control and in each group, or in one "Required" group before the
 * others, each naming its group, as the story, its component, the catalogue and the reader's switch at the top of the
 * tab say (`useRequiredFirst.ts`).
 *
 * @module
 */

import type { RequiredFirst } from "@forgebook/story-format/csf";
import type { StoryControlsSetting } from "@forgebook/story-format/source";
import type { ReactNode } from "react";

import { isNamedProp, type PanelProp, settableProps } from "../argTypes.ts";
import type { ArgValue, PanelArgs } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import { canOrderRequired, laidOutProps, propGroupOrder } from "../propGroups.ts";
import { useCatalogue } from "./catalogueContext.ts";
import type { ArgControlLoaders } from "./customControls.ts";
import { Icon } from "./icons.tsx";
import { PropControl, ReadOnlyProp, type TextArgNote, Toggle } from "./PropRows.tsx";
import { RequiredFirstSwitch } from "./RequiredFirstSwitch.tsx";
import { STRINGS } from "./strings.ts";
import { useRequiredFirst } from "./useRequiredFirst.ts";
import type { WorstCaseState } from "./worstArgs.ts";

/** The tab's props. */
export type PropsTabProps = {
  /** The props, from the component's types with the story's `argTypes` laid over them. */
  readonly props: readonly PanelProp[];
  /** The values shown: the story's args with the panel's changes. */
  readonly values: PanelArgs;
  /** The panel's own values, for what can go back to the story's. */
  readonly panelArgs: PanelArgs;
  /** Loads the catalogue's design tokens; none when it has none. */
  readonly loadTokens?: (() => Promise<unknown>) | undefined;
  /** Loads each custom control the catalogue registers, by name; none when it registers none. */
  readonly argControls?: ArgControlLoaders | undefined;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** Called with a changed value; `undefined` removes the panel's value. */
  readonly onValueChange: (name: string, value: ArgValue | undefined) => void;
  /** Removes every value the panel set. */
  readonly onReset: () => void;
  /** The worst case the tab's button sets, and the spills counted while it is on; none hides the button. */
  readonly worstCase?: WorstCaseState | undefined;
  /** The values the source offers by name for a type the panel cannot write (`IconComponent`); none by default. */
  readonly namedValues?: NamedValues | undefined;
  /** The props the story gives a text by its key, by name; none by default. */
  readonly textArgs?: Readonly<Record<string, TextArgNote>>;
  /**
   * The prop groups the component's meta lists first, in order (`parameters.propGroups`), ahead of the catalogue's;
   * none by default.
   */
  readonly componentGroups?: readonly string[];
  /**
   * Where the story puts the required props (`parameters.requiredFirst`, its own or its meta's); none for the
   * catalogue's.
   */
  readonly requiredFirst?: RequiredFirst | undefined;
};

/** No prop named by a text key. */
const NO_TEXT_ARGS: Readonly<Record<string, TextArgNote>> = {};

/** No group named first. */
const NO_GROUPS: readonly string[] = [];

/**
 * A group the props' TSDoc names, under its name: its controls in the order of the props, its toggles, then the props
 * the panel cannot set. The "Required" group is drawn as one, each of its props naming its own group.
 *
 * @param props - the group's name and props, how each prop is drawn, and whether it is the "Required" group.
 */
const NamedGroup = ({
  name,
  props,
  isSettable,
  control,
  toggle,
  isRequired = false
}: {
  readonly name: string;
  readonly props: readonly PanelProp[];
  readonly isSettable: (prop: PanelProp) => boolean;
  readonly control: (prop: PanelProp, showsGroup: boolean) => ReactNode;
  readonly toggle: (prop: PanelProp, showsGroup: boolean) => ReactNode;
  readonly isRequired?: boolean;
}): ReactNode => {
  const controls = props.filter((prop) => isSettable(prop) && prop.kind !== "toggle");
  const toggles = props.filter((prop) => isSettable(prop) && prop.kind === "toggle");
  const others = props.filter((prop) => !isSettable(prop));
  return (
    <div className="forgebook-prop-group" data-required={isRequired || undefined}>
      <details className="forgebook-fold" open>
        <summary className="forgebook-fold__summary forgebook-prop-group__title">
          <Icon name="chevronRight" size={12} />
          <h3 className="forgebook-fold__name">{name}</h3>
          <span className="forgebook-fold__count">{STRINGS.propCount(props.length)}</span>
        </summary>
        <div className="forgebook-prop-group__body">
          {controls.length === 0 ? null : (
            <div className="forgebook-prop-grid">{controls.map((prop) => control(prop, isRequired))}</div>
          )}
          {toggles.length === 0 ? null : (
            <div className="forgebook-toggles">{toggles.map((prop) => toggle(prop, isRequired))}</div>
          )}
          {others.length === 0 ? null : (
            <div className="forgebook-prop-grid">
              {others.map((prop) => (
                <ReadOnlyProp key={prop.name} prop={prop} showsGroup={isRequired} />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
};

/**
 * The worst case's button, and once it is on, how many elements spill (the frame outlines them).
 *
 * @param props - the worst case.
 */
const WorstCaseControl = ({ worstCase }: { readonly worstCase: WorstCaseState }): ReactNode => (
  <>
    <button
      type="button"
      className="forgebook-text-button"
      aria-pressed={worstCase.isOn}
      disabled={worstCase.isOn}
      title={STRINGS.worstCaseHint}
      onClick={worstCase.onApply}
    >
      {STRINGS.worstCase}
    </button>
    {worstCase.isOn && worstCase.spillCount !== undefined ? (
      <output className="forgebook-tab-foot__note" data-has-spills={worstCase.spillCount > 0}>
        {STRINGS.spills(worstCase.spillCount)}
      </output>
    ) : null}
  </>
);

/**
 * The Props tab.
 *
 * @param props - the props, the values, which props the story lets the panel set, and the setters.
 */
export const PropsTab = ({
  props,
  values,
  panelArgs,
  loadTokens,
  argControls,
  controls,
  onValueChange,
  onReset,
  worstCase,
  namedValues = {},
  textArgs = NO_TEXT_ARGS,
  componentGroups = NO_GROUPS,
  requiredFirst
}: PropsTabProps): ReactNode => {
  const catalogue = useCatalogue();
  const ordering = useRequiredFirst(requiredFirst);
  const isNamed = (prop: PanelProp): boolean => isNamedProp(prop, namedValues);
  const allSettable = settableProps(props, controls, namedValues);
  const isSettable = (prop: PanelProp): boolean => allSettable.includes(prop);
  const listed = props.filter((prop) => prop.kind !== "event");
  const { required, groups: propGroups } = laidOutProps(
    listed,
    propGroupOrder(componentGroups, catalogue.propGroups),
    ordering.layout
  );
  // the props that name no group are drawn as the tab always drew them, by control, in the layout's order
  const ungrouped = propGroups.find((group) => group.name === undefined)?.props ?? [];
  const settable = ungrouped.filter(isSettable);
  const control = (prop: PanelProp, showsGroup: boolean): ReactNode => (
    <PropControl
      key={prop.name}
      prop={prop}
      showsGroup={showsGroup}
      value={values[prop.name]}
      panelValue={panelArgs[prop.name]}
      named={isNamed(prop) ? namedValues[prop.type] : undefined}
      namedValues={namedValues}
      loadTokens={loadTokens}
      argControls={argControls}
      textArg={textArgs[prop.name]}
      onValueChange={onValueChange}
    />
  );
  const toggle = (prop: PanelProp, showsGroup: boolean): ReactNode => (
    <Toggle
      key={prop.name}
      prop={prop}
      showsGroup={showsGroup}
      value={values[prop.name]}
      panelValue={panelArgs[prop.name]}
      onValueChange={onValueChange}
    />
  );
  const isStructured = (prop: PanelProp): boolean =>
    (prop.shape !== undefined || prop.customControl !== undefined) && !isNamed(prop);
  const groups = [
    {
      title: STRINGS.propGroups.choice,
      props: settable.filter((prop) => prop.kind === "choice" || isNamed(prop))
    },
    {
      title: STRINGS.propGroups.text,
      props: settable.filter(
        (prop) =>
          ["text", "number", "other"].includes(prop.kind) &&
          !isNamed(prop) &&
          !isStructured(prop) &&
          prop.customControl === undefined
      )
    },
    { title: STRINGS.propGroups.structured, props: settable.filter(isStructured) }
  ].filter((group) => group.props.length > 0);
  const toggles = settable.filter((prop) => prop.kind === "toggle");
  const others = ungrouped.filter((prop) => !isSettable(prop));
  const hasControls = controls === "all" || controls.length > 0;
  return (
    <div className="forgebook-tab-props">
      {canOrderRequired(listed) ? (
        <div className="forgebook-tab-head">
          <RequiredFirstSwitch state={ordering} />
        </div>
      ) : null}
      {hasControls ? null : <p className="forgebook-tab-note">{STRINGS.fixedExamples}</p>}
      {required.length === 0 ? null : (
        <NamedGroup
          name={STRINGS.required}
          props={required}
          isSettable={isSettable}
          control={control}
          toggle={toggle}
          isRequired={true}
        />
      )}
      {groups.map((group) => (
        <div key={group.title} className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{group.title}</h3>
          <div className="forgebook-prop-grid">{group.props.map((prop) => control(prop, false))}</div>
        </div>
      ))}
      {toggles.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{STRINGS.propGroups.toggle}</h3>
          <div className="forgebook-toggles">{toggles.map((prop) => toggle(prop, false))}</div>
        </div>
      )}
      {others.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">
            {hasControls ? STRINGS.otherProps : STRINGS.allProps}
          </h3>
          <div className="forgebook-prop-grid">
            {others.map((prop) => (
              <ReadOnlyProp key={prop.name} prop={prop} showsGroup={false} />
            ))}
          </div>
        </div>
      )}
      {propGroups.map((group) =>
        group.name === undefined ? null : (
          <NamedGroup
            key={group.name}
            name={group.name}
            props={group.props}
            isSettable={isSettable}
            control={control}
            toggle={toggle}
          />
        )
      )}
      {hasControls ? (
        <div className="forgebook-tab-foot">
          <button type="button" className="forgebook-text-button" onClick={onReset}>
            {STRINGS.resetArgs}
          </button>
          {worstCase?.canApply === true ? <WorstCaseControl worstCase={worstCase} /> : null}
        </div>
      ) : null}
    </div>
  );
};
