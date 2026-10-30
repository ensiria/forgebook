/**
 * The catalogue's toolbar: the colour scheme and the contrast switches, the View menu (every other declared switch,
 * the background, the style sheets, the text size), the stage's width, the panel, and Compare; every value kept in the
 * address.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import { type FixedView, NOT_FIXED, withFixed, withOwnFixed } from "../storyGlobals";
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
import { Icon } from "./icons";
import { SchemeSwitches } from "./SchemeSwitches";
import { Segmented } from "./Segmented";
import { STRINGS } from "./strings";
import { switchValueIn, withSwitch } from "./switchView";
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
  /** What the shown story fixes of the view: shown, and not changeable here; nothing by default. */
  readonly fixed?: FixedView;
};

/**
 * One switch's row in the View menu: segments, or a list for many values.
 *
 * @param props - the switch, the view and its setter.
 */
const SwitchRow = ({
  each,
  view,
  onViewChange,
  isFixed
}: {
  readonly each: ViewSwitch;
  readonly view: ViewState;
  readonly onViewChange: (view: ViewState) => void;
  /** Whether the story sets the switch. */
  readonly isFixed: boolean;
}): ReactNode => {
  const listId = useId();
  const isCompared = view.compare.includes(each.id) || isFixed;
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
          title={isFixed ? STRINGS.setByStory : undefined}
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
        disabledNote={isFixed ? STRINGS.setByStory : undefined}
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
const ViewMenu = ({
  view,
  onViewChange,
  fixed = NOT_FIXED,
  hasOwnChanges
}: ToolbarProps & {
  /** Whether the user changed the view: a value the story fixes is not a change of theirs. */
  readonly hasOwnChanges: boolean;
}): ReactNode => {
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
        {hasOwnChanges ? (
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
            <SwitchRow
              key={each.id}
              each={each}
              view={view}
              onViewChange={onViewChange}
              isFixed={fixed.switches[each.id] !== undefined}
            />
          ))}
          <div className="forgebook-popover__row">
            <label className="forgebook-popover__label" htmlFor={backdropId}>
              {STRINGS.backdrop}
            </label>
            <select
              id={backdropId}
              className="forgebook-select"
              value={view.backdrop}
              disabled={fixed.backdrop !== undefined}
              title={fixed.backdrop === undefined ? undefined : STRINGS.setByStory}
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
  isDisabled,
  fixed = NOT_FIXED
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
                  // a switch the story fixes would draw the same story in every cell
                  disabled={choice.axes.some((axis) => fixed.switches[axis] !== undefined)}
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
 * The toolbar.
 *
 * @param props - the view, its setter, the page shown and the story's width.
 */
export const Toolbar = ({
  view: ownView,
  onViewChange: onOwnViewChange,
  isStoryPage = true,
  onShowSidebar,
  shownWidth,
  fixed = NOT_FIXED
}: ToolbarProps): ReactNode => {
  const { widths, switches } = useCatalogue();
  // the story's fixed values are shown, and a change of anything else keeps the user's own in the address
  const view = withFixed(ownView, fixed);
  const onViewChange = (changed: ViewState): void => onOwnViewChange(withOwnFixed(changed, ownView, fixed));
  return (
    <div className="forgebook-toolbar">
      {onShowSidebar === undefined ? null : <ShowSidebarButton onShowSidebar={onShowSidebar} />}
      <SchemeSwitches view={view} onViewChange={onViewChange} isStoryPage={isStoryPage} fixed={fixed} />
      <span className="forgebook-toolbar__divider" />
      <ViewMenu
        view={view}
        onViewChange={onViewChange}
        fixed={fixed}
        hasOwnChanges={hasViewChanges(ownView, switches)}
      />
      <span className="forgebook-toolbar__divider" />
      <div className="forgebook-toolbar__width">
        <span className="forgebook-toolbar__icon" title={STRINGS.width}>
          <Icon name="width" size={14} />
        </span>
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
      <CompareMenu view={view} onViewChange={onViewChange} isDisabled={!isStoryPage} fixed={fixed} />
    </div>
  );
};
