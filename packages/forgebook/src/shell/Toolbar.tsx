/**
 * The catalogue's toolbar: the colour scheme and the contrast switches, the View menu (every other declared switch,
 * the background, the style sheets, the text size), the stage's width, the panel, and Compare; every value kept in the
 * address.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import { switchControl, switchWithRole, type ViewSwitch } from "../switches";
import {
  DEFAULT_VIEW,
  hasViewChanges,
  isComparing,
  isMenuSwitch,
  PLAIN_BACKDROP,
  SHEETS_CHOICES,
  type SheetsChoice,
  type StageWidth,
  type ViewState
} from "../viewState";
import { useCatalogue } from "./catalogueContext";
import { Icon, type IconName } from "./icons";
import { Segmented } from "./Segmented";
import { STRINGS } from "./strings";
import { usePopover } from "./usePopover";
import { WidthField } from "./WidthField";

/** The toolbar's props. */
export type ToolbarProps = {
  /** The view. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  /** Whether a story's page is shown: the props panel and Compare belong to it, not to a component's page. */
  readonly isStoryPage?: boolean;
  /** Shows the hidden sidebar; none while it is shown. */
  readonly onShowSidebar?: (() => void) | undefined;
  /** The width the shown story really has, in CSS px, for the width field; none on a component's page. */
  readonly shownWidth?: number | undefined;
};

/** The icon of each scheme a colour scheme switch's values draw in. */
const SCHEME_ICONS: Readonly<Record<"light" | "dark" | "system", IconName>> = {
  light: "sun",
  dark: "moon",
  system: "monitor"
};

/**
 * A view with one switch set.
 *
 * @param view - the view.
 * @param each - the switch.
 * @param value - its new value.
 */
const withSwitch = (view: ViewState, each: ViewSwitch, value: string): ViewState => ({
  ...view,
  switches: { ...view.switches, [each.id]: value }
});

/**
 * A switch's value in a view.
 *
 * @param view - the view.
 * @param each - the switch.
 */
const switchValueIn = (view: ViewState, each: ViewSwitch): string => view.switches[each.id] ?? each.default;

/**
 * One switch's row in the View menu: segments, or a list for many values.
 *
 * @param props - the switch, the view and its setter.
 */
const SwitchRow = ({
  each,
  view,
  onViewChange
}: {
  readonly each: ViewSwitch;
  readonly view: ViewState;
  readonly onViewChange: (view: ViewState) => void;
}): ReactNode => {
  const listId = useId();
  const isCompared = view.compare.includes(each.id);
  if (switchControl(each) === "list") {
    return (
      <div className="forgebook-popover__row">
        <label className="forgebook-popover__label" htmlFor={listId}>
          {each.label}
        </label>
        <select
          id={listId}
          className="forgebook-select"
          value={switchValueIn(view, each)}
          disabled={isCompared}
          onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
            onViewChange(withSwitch(view, each, event.currentTarget.value))
          }
        >
          {each.values.map((value) => (
            <option key={value.value} value={value.value}>
              {value.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="forgebook-popover__row">
      <span className="forgebook-popover__label">{each.label}</span>
      <Segmented
        label={each.label}
        options={each.values.map((value) => ({ value: value.value, label: value.label }))}
        value={switchValueIn(view, each)}
        isDisabled={isCompared}
        onValueChange={(value: string): void => onViewChange(withSwitch(view, each, value))}
      />
    </div>
  );
};

/**
 * The View menu: every declared switch the toolbar does not show itself, the background, the style sheets and the
 * text size, with a dot on its button when one is changed. The background is a list: its six names are too long for
 * a row of segments (D-649).
 *
 * @param props - the view and its setter.
 */
const ViewMenu = ({ view, onViewChange }: ToolbarProps): ReactNode => {
  const { isOpen, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const backdropId = useId();
  const menuSwitches = switches.filter(isMenuSwitch);

  return (
    <div className="forgebook-view-menu">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={(): void => setIsOpen(!isOpen)}
      >
        <Icon name="sliders" size={14} />
        {STRINGS.view}
        {hasViewChanges(view, switches) ? (
          <span className="forgebook-dot" role="img" aria-label={STRINGS.viewChanged} />
        ) : null}
        <Icon name="chevronDown" size={12} />
      </button>
      {isOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover"
          role="dialog"
          aria-label={STRINGS.view}
        >
          {menuSwitches.map((each) => (
            <SwitchRow key={each.id} each={each} view={view} onViewChange={onViewChange} />
          ))}
          <div className="forgebook-popover__row">
            <label className="forgebook-popover__label" htmlFor={backdropId}>
              {STRINGS.backdrop}
            </label>
            <select
              id={backdropId}
              className="forgebook-select"
              value={view.backdrop}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                onViewChange({ ...view, backdrop: event.currentTarget.value })
              }
            >
              <option value={PLAIN_BACKDROP}>{STRINGS.backdropPlain}</option>
              {catalogue.backdrops.map((backdrop) => (
                <option key={backdrop.id} value={backdrop.id}>
                  {backdrop.label}
                </option>
              ))}
            </select>
          </div>
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.sheets}</span>
            <Segmented
              label={STRINGS.sheets}
              options={SHEETS_CHOICES.map((sheets) => ({
                value: sheets,
                label: STRINGS.sheetChoices[sheets]
              }))}
              value={view.sheets}
              isDisabled={view.compare.includes("sheets")}
              onValueChange={(sheets: SheetsChoice): void => onViewChange({ ...view, sheets })}
            />
          </div>
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.text}</span>
            <Segmented
              label={STRINGS.text}
              options={catalogue.textSizes.map((text) => ({ value: text, label: STRINGS.textScale(text) }))}
              value={view.text}
              isDisabled={view.compare.includes("text")}
              onValueChange={(text: number): void => onViewChange({ ...view, text })}
            />
          </div>
          <div className="forgebook-popover__foot">
            <button
              type="button"
              className="forgebook-text-button"
              onClick={(): void =>
                onViewChange({
                  ...view,
                  switches: {
                    ...view.switches,
                    ...Object.fromEntries(menuSwitches.map((each) => [each.id, each.default]))
                  },
                  backdrop: DEFAULT_VIEW.backdrop,
                  sheets: DEFAULT_VIEW.sheets,
                  text: DEFAULT_VIEW.text
                })
              }
            >
              {STRINGS.resetView}
            </button>
            <span className="forgebook-popover__note">{STRINGS.viewInAddress}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** One choice of the Compare menu: what it sets side by side, and its name. */
type CompareChoice = {
  /** The compared axes; none for Off. */
  readonly axes: readonly string[];
  /** The name in the menu. */
  readonly label: string;
};

/**
 * The Compare menu's choices: Off, the colour scheme at both contrasts when the catalogue has both, each switch of
 * the View menu, the text sizes and the style sheets.
 *
 * @param switches - the catalogue's switches.
 */
const compareChoices = (switches: readonly ViewSwitch[]): CompareChoice[] => {
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const schemes: CompareChoice[] =
    scheme === undefined
      ? []
      : [
          contrast === undefined
            ? { axes: [scheme.id], label: scheme.label }
            : { axes: [scheme.id, contrast.id], label: STRINGS.compareOf([scheme.label, contrast.label]) }
        ];
  return [
    { axes: [], label: STRINGS.compareOff },
    ...schemes,
    ...switches.filter(isMenuSwitch).map((each) => ({ axes: [each.id], label: each.label })),
    { axes: ["text"], label: STRINGS.compareText },
    { axes: ["sheets"], label: STRINGS.compareSheets }
  ];
};

/**
 * The Compare menu: what the stage sets side by side, or nothing; its button is pressed while the stage compares.
 *
 * @param props - the view, its setter, and whether the page compares at all.
 */
const CompareMenu = ({
  view,
  onViewChange,
  isDisabled
}: ToolbarProps & { readonly isDisabled: boolean }): ReactNode => {
  const { isOpen, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const switches = useCatalogue().switches;
  const name = useId();
  return (
    <div className="forgebook-view-menu">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button"
        title={STRINGS.compare}
        aria-pressed={isComparing(view)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        disabled={isDisabled}
        onClick={(): void => setIsOpen(!isOpen)}
      >
        <Icon name="compare" size={14} />
        <span className="forgebook-button__label">{STRINGS.compare}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {isOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-popover--end"
          role="dialog"
          aria-label={STRINGS.compare}
        >
          <fieldset className="forgebook-choices">
            <legend className="forgebook-visually-hidden">{STRINGS.compare}</legend>
            {compareChoices(switches).map((choice) => (
              <label key={choice.axes.join(",")} className="forgebook-choice">
                <input
                  type="radio"
                  name={name}
                  checked={view.compare.join(",") === choice.axes.join(",")}
                  onChange={(): void => {
                    onViewChange({ ...view, compare: choice.axes });
                    setIsOpen(false);
                  }}
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The button that shows the hidden sidebar, at the toolbar's start; the home's bar holds only it.
 *
 * @param props - what showing the sidebar does.
 */
export const ShowSidebarButton = ({ onShowSidebar }: { readonly onShowSidebar: () => void }): ReactNode => (
  <button
    type="button"
    className="forgebook-icon-button"
    title={STRINGS.showSidebar}
    aria-label={STRINGS.showSidebar}
    onClick={onShowSidebar}
  >
    <Icon name="sidebar" size={14} />
  </button>
);

/**
 * The colour scheme switch and the contrast switch, at the toolbar's start: the scheme as segments with icons, a
 * two-value contrast as a toggle (a longer one as segments).
 *
 * @param props - the view, its setter, and whether a story's page is shown (the compare view sets them there).
 */
const SchemeSwitches = ({
  view,
  onViewChange,
  isStoryPage
}: Pick<ToolbarProps, "view" | "onViewChange"> & { readonly isStoryPage: boolean }): ReactNode => {
  const switches = useCatalogue().switches;
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const isCompared = (each: ViewSwitch): boolean => isStoryPage && view.compare.includes(each.id);
  const more = contrast?.values.find((value) => value.isMore === true);
  const standard = contrast?.values.find((value) => value.isMore !== true);
  if (scheme === undefined && contrast === undefined) return null;
  return (
    <div className="forgebook-toolbar__group">
      {scheme === undefined ? null : (
        <Segmented
          label={scheme.label}
          isDisabled={isCompared(scheme)}
          options={scheme.values.map((value) => ({
            value: value.value,
            label: value.label,
            icon: SCHEME_ICONS[value.scheme ?? "light"]
          }))}
          value={switchValueIn(view, scheme)}
          onValueChange={(value: string): void => onViewChange(withSwitch(view, scheme, value))}
        />
      )}
      {contrast === undefined || more === undefined || standard === undefined ? null : (
        <button
          type="button"
          className="forgebook-button"
          title={contrast.label}
          aria-pressed={switchValueIn(view, contrast) === more.value}
          disabled={isCompared(contrast)}
          onClick={(): void =>
            onViewChange(
              withSwitch(
                view,
                contrast,
                switchValueIn(view, contrast) === more.value ? standard.value : more.value
              )
            )
          }
        >
          <Icon name="contrast" size={14} />
          <span className="forgebook-button__label">{contrast.label}</span>
        </button>
      )}
    </div>
  );
};

/**
 * The toolbar.
 *
 * @param props - the view, its setter, the page shown and the story's width.
 */
export const Toolbar = ({
  view,
  onViewChange,
  isStoryPage = true,
  onShowSidebar,
  shownWidth
}: ToolbarProps): ReactNode => {
  const { widths } = useCatalogue();
  return (
    <div className="forgebook-toolbar">
      {onShowSidebar === undefined ? null : <ShowSidebarButton onShowSidebar={onShowSidebar} />}
      <SchemeSwitches view={view} onViewChange={onViewChange} isStoryPage={isStoryPage} />
      <span className="forgebook-toolbar__divider" />
      <ViewMenu view={view} onViewChange={onViewChange} />
      <span className="forgebook-toolbar__divider" />
      <div className="forgebook-toolbar__width">
        <span className="forgebook-toolbar__icon" title={STRINGS.width}>
          <Icon name="width" size={14} />
        </span>
        <Segmented
          label={STRINGS.width}
          isDisabled={isStoryPage && isComparing(view)}
          options={[
            { value: "fill", label: STRINGS.widthFill },
            ...widths.map((preset) => ({
              value: preset.width,
              label: preset.label ?? STRINGS.widthPx(preset.width)
            }))
          ]}
          value={view.width}
          onValueChange={(width: StageWidth): void => onViewChange({ ...view, width })}
          after={
            <WidthField
              width={view.width}
              shownWidth={shownWidth}
              onWidthChange={(width: StageWidth): void => onViewChange({ ...view, width })}
            />
          }
        />
      </div>
      <span className="forgebook-toolbar__spacer" />
      <button
        type="button"
        className="forgebook-button"
        title={STRINGS.panel}
        aria-pressed={view.isPanelOpen}
        disabled={!isStoryPage}
        onClick={(): void => onViewChange({ ...view, isPanelOpen: !view.isPanelOpen })}
      >
        <Icon name="panel" size={14} />
        <span className="forgebook-button__label">{STRINGS.panel}</span>
      </button>
      <CompareMenu view={view} onViewChange={onViewChange} isDisabled={!isStoryPage} />
    </div>
  );
};
