/**
 * One control of the toolbar or the View menu, wherever the person placed it: a switch the catalogue declares, or one
 * of Forgebook's own (the background, the style sheets, the text size, the stage's width), drawn for the toolbar or for
 * a row of the View menu; off while the compare view sets it or the story fixes it.
 *
 * @remarks
 * On the toolbar a control takes its compact form: the colour scheme as segments with icons, a two-value contrast as a
 * toggle, a few short values as segments after the control's name, anything longer as a list after it. In the View
 * menu the row shows the name, so the control is the segments or the list alone.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import type { OwnControlId } from "../catalogue.ts";
import type { FixedView } from "../storyGlobals.ts";
import { switchControl, type ViewSwitch } from "../switches.ts";
import type { ToolbarControl as Control } from "../toolbarLayout.ts";
import {
  isComparing,
  PLAIN_BACKDROP,
  SHEETS_CHOICES,
  type SheetsChoice,
  type StageWidth,
  type ViewState
} from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon, type IconName } from "./icons.tsx";
import { Segmented, type SegmentOption } from "./Segmented.tsx";
import { STRINGS } from "./strings.ts";
import { switchValueIn, withSwitch } from "./switchView.ts";
import { WidthField } from "./WidthField.tsx";

/** Where a control is drawn: on the toolbar, or in a row of the View menu. */
export type ControlForm = "bar" | "row";

/** What every control reads and sets. */
export type ControlContext = {
  /** The view shown. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  /** Whether a story's page is shown: the compare view sets values there, never on a component's page. */
  readonly isStoryPage: boolean;
  /** What the shown story fixes of the view. */
  readonly fixed: FixedView;
  /** The width the shown story really has, in CSS px, for the width field; none on a component's page. */
  readonly shownWidth: number | undefined;
};

/** The icon of each scheme a colour scheme switch's values draw in. */
const SCHEME_ICONS: Readonly<Record<"light" | "dark" | "system", IconName>> = {
  light: "sun",
  dark: "moon",
  system: "monitor"
};

/** The most characters a control's values may take together to sit on the toolbar as segments. */
const COMPACT_LETTERS = 20;

/** The most values a control may have to sit on the toolbar as segments. */
const COMPACT_VALUES = 3;

/**
 * Whether values fit on the toolbar as segments: few, and short together.
 *
 * @param labels - the values' names.
 */
const isCompact = (labels: readonly string[]): boolean =>
  labels.length <= COMPACT_VALUES && labels.join("").length <= COMPACT_LETTERS;

/** The name of each of Forgebook's own controls. */
const OWN_LABELS: Readonly<Record<OwnControlId, () => string>> = {
  backdrop: () => STRINGS.backdrop,
  sheets: () => STRINGS.sheets,
  text: () => STRINGS.text,
  width: () => STRINGS.width
};

/**
 * A control's name, as its row, its menu and its buttons' names write it.
 *
 * @param control - the control.
 */
export const controlLabel = (control: Control): string =>
  control.kind === "switch" ? control.switch.label : OWN_LABELS[control.id]();

/** A choice drawn as segments or as a list, the same way for every control. */
type Choice<TValue extends string | number> = {
  /** The control's name. */
  readonly label: string;
  /** Its values. */
  readonly options: readonly SegmentOption<TValue>[];
  /** The chosen one. */
  readonly value: TValue;
  /** Called with the chosen one. */
  readonly onValueChange: (value: TValue) => void;
  /** Whether it is off. */
  readonly isDisabled: boolean;
  /** Why it is off, when the story sets it. */
  readonly disabledNote: string | undefined;
};

/**
 * A choice as a native list: the platform's keys and screen reader support, for values too many or too long for
 * segments.
 *
 * @param props - the choice, and the list's id for its label.
 */
const ChoiceList = <TValue extends string | number>({
  id,
  label,
  options,
  value,
  onValueChange,
  isDisabled,
  disabledNote
}: Choice<TValue> & { readonly id: string }): ReactNode => (
  <select
    id={id}
    className="forgebook-select"
    aria-label={label}
    value={String(value)}
    disabled={isDisabled}
    title={isDisabled ? disabledNote : undefined}
    onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
      const chosen = options.find((option) => String(option.value) === event.currentTarget.value);
      if (chosen !== undefined) onValueChange(chosen.value);
    }}
  >
    {options.map((option) => (
      <option key={String(option.value)} value={String(option.value)}>
        {option.label}
      </option>
    ))}
  </select>
);

/**
 * A choice in its form: in a row, segments (or a list when asked); on the toolbar, segments after its name when the
 * values are few and short, else a list after its name.
 *
 * @param props - the choice, its form, and whether it is a list wherever it is.
 */
const FormChoice = <TValue extends string | number>({
  form,
  isList,
  ...choice
}: Choice<TValue> & { readonly form: ControlForm; readonly isList: boolean }): ReactNode => {
  const id = useId();
  const isSegments = !isList && (form === "row" || isCompact(choice.options.map((option) => option.label)));
  const drawn = isSegments ? <Segmented {...choice} /> : <ChoiceList {...choice} id={id} />;
  if (form === "row") return drawn;
  return (
    <div className="forgebook-toolbar__control">
      {isSegments ? (
        <span className="forgebook-toolbar__label" aria-hidden="true">
          {choice.label}
        </span>
      ) : (
        <label className="forgebook-toolbar__label" htmlFor={id}>
          {choice.label}
        </label>
      )}
      {drawn}
    </div>
  );
};

/**
 * A switch: the colour scheme with icons and a two-value contrast as a toggle on the toolbar, any other as a choice.
 *
 * @param props - the switch, its form, and what every control shares.
 */
const SwitchControl = ({
  each,
  form,
  view,
  onViewChange,
  isStoryPage,
  fixed
}: ControlContext & { readonly each: ViewSwitch; readonly form: ControlForm }): ReactNode => {
  const isFixed = fixed.switches[each.id] !== undefined;
  const isDisabled = (isStoryPage && view.compare.includes(each.id)) || isFixed;
  const disabledNote = isFixed ? STRINGS.setByStory : undefined;
  const value = switchValueIn(view, each);
  const choose = (chosen: string): void => onViewChange(withSwitch(view, each, chosen));
  const more = each.values.find((option) => option.isMore === true);
  const standard = each.values.find((option) => option.isMore !== true);
  if (form === "bar" && each.role === "colorScheme") {
    return (
      <Segmented
        label={each.label}
        isDisabled={isDisabled}
        disabledNote={disabledNote}
        options={each.values.map((option) => ({
          value: option.value,
          label: option.label,
          icon: SCHEME_ICONS[option.scheme ?? "light"]
        }))}
        value={value}
        onValueChange={choose}
      />
    );
  }
  if (form === "bar" && each.role === "contrast" && more !== undefined && standard !== undefined) {
    return (
      <button
        type="button"
        className="forgebook-button"
        title={isFixed ? STRINGS.setByStory : each.label}
        aria-pressed={value === more.value}
        disabled={isDisabled}
        onClick={(): void => choose(value === more.value ? standard.value : more.value)}
      >
        <Icon name="contrast" size={14} />
        <span className="forgebook-button__label">{each.label}</span>
      </button>
    );
  }
  return (
    <FormChoice
      form={form}
      isList={switchControl(each) === "list"}
      label={each.label}
      options={each.values.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      onValueChange={choose}
      isDisabled={isDisabled}
      disabledNote={disabledNote}
    />
  );
};

/**
 * The stage's width: its presets as segments, closed by the field that takes any width.
 *
 * @param props - its form and what every control shares.
 */
const WidthControl = ({
  form,
  view,
  onViewChange,
  isStoryPage,
  fixed,
  shownWidth
}: ControlContext & { readonly form: ControlForm }): ReactNode => {
  const { widths } = useCatalogue();
  const setWidth = (width: StageWidth): void => onViewChange({ ...view, width });
  const presets = (
    <Segmented
      label={STRINGS.width}
      isDisabled={(isStoryPage && isComparing(view)) || fixed.width !== undefined}
      disabledNote={fixed.width === undefined ? undefined : STRINGS.setByStory}
      options={[
        { value: "fill", label: STRINGS.widthFill },
        ...widths.map((preset) => ({
          value: preset.width,
          label: preset.label ?? STRINGS.widthPx(preset.width)
        }))
      ]}
      value={view.width}
      onValueChange={setWidth}
      after={<WidthField width={view.width} shownWidth={shownWidth} onWidthChange={setWidth} />}
    />
  );
  if (form === "row") return presets;
  return (
    <div className="forgebook-toolbar__width">
      <span className="forgebook-toolbar__icon" title={STRINGS.width}>
        <Icon name="width" size={14} />
      </span>
      {presets}
    </div>
  );
};

/**
 * One of Forgebook's own controls.
 *
 * @param props - the control, its form, and what every control shares.
 */
const OwnControl = ({
  id,
  form,
  ...context
}: ControlContext & { readonly id: OwnControlId; readonly form: ControlForm }): ReactNode => {
  const catalogue = useCatalogue();
  const { view, onViewChange, isStoryPage, fixed } = context;
  if (id === "width") return <WidthControl form={form} {...context} />;
  if (id === "backdrop") {
    return (
      <FormChoice
        form={form}
        // its names are too long for segments
        isList={true}
        label={STRINGS.backdrop}
        options={[
          { value: PLAIN_BACKDROP, label: STRINGS.backdropPlain },
          ...catalogue.backdrops.map((backdrop) => ({ value: backdrop.id, label: backdrop.label }))
        ]}
        value={view.backdrop}
        onValueChange={(backdrop: string): void => onViewChange({ ...view, backdrop })}
        isDisabled={fixed.backdrop !== undefined}
        disabledNote={fixed.backdrop === undefined ? undefined : STRINGS.setByStory}
      />
    );
  }
  if (id === "sheets") {
    return (
      <FormChoice
        form={form}
        isList={false}
        label={STRINGS.sheets}
        options={SHEETS_CHOICES.map((sheets) => ({ value: sheets, label: STRINGS.sheetChoices[sheets] }))}
        value={view.sheets}
        onValueChange={(sheets: SheetsChoice): void => onViewChange({ ...view, sheets })}
        isDisabled={isStoryPage && view.compare.includes("sheets")}
        disabledNote={undefined}
      />
    );
  }
  return (
    <FormChoice
      form={form}
      isList={false}
      label={STRINGS.text}
      options={catalogue.textSizes.map((text) => ({ value: text, label: STRINGS.textScale(text) }))}
      value={view.text}
      onValueChange={(text: number): void => onViewChange({ ...view, text })}
      isDisabled={isStoryPage && view.compare.includes("text")}
      disabledNote={undefined}
    />
  );
};

/**
 * One control, drawn for where it sits.
 *
 * @param props - the control, its form, and what every control shares.
 */
export const ToolbarControl = ({
  control,
  form,
  ...context
}: ControlContext & { readonly control: Control; readonly form: ControlForm }): ReactNode =>
  control.kind === "switch" ? (
    <SwitchControl each={control.switch} form={form} {...context} />
  ) : (
    <OwnControl id={control.id} form={form} {...context} />
  );
