/**
 * The toolbar: the theme, high contrast, the View menu (motion, speed, press feedback, background, style sheets, text
 * size, the source's languages), the story's width, the props panel and Compare, on one line.
 *
 * @module
 */

import type { StoryLanguage } from "@ensiria/story-format/source";
import { type ChangeEvent, type ReactNode, useId } from "react";

import {
  BACKDROP_CHOICES,
  COMPARE_MODES,
  DEFAULT_VIEW,
  hasViewChanges,
  isComparing,
  MOTION_CHOICES,
  type MotionChoice,
  PRESS_CHOICES,
  type PressChoice,
  SHEETS_CHOICES,
  type SheetsChoice,
  SPEED_CHOICES,
  type SpeedChoice,
  STAGE_WIDTHS,
  type StageWidth,
  TEXT_SCALES,
  type TextScale,
  THEME_CHOICES,
  type ThemeChoice,
  type ViewState
} from "../viewState";
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
  /** The languages of the shown story's source; the View menu has no Language row without any. */
  readonly languages: readonly StoryLanguage[];
  /** Whether a story's page is shown: the props panel and Compare belong to it, not to a component's page. */
  readonly isStoryPage?: boolean;
  /** Shows the hidden sidebar; none while it is shown. */
  readonly onShowSidebar?: (() => void) | undefined;
  /** The width the shown story really has, in CSS px, for the width field; none on a component's page. */
  readonly shownWidth?: number | undefined;
};

/** The theme's icons. */
const THEME_ICONS: Readonly<Record<ViewState["theme"], IconName>> = {
  light: "sun",
  dark: "moon",
  system: "monitor"
};

/**
 * The View menu: motion, speed, press feedback, background, style sheets, text size and language, with a dot on its
 * button when one is changed. The background is a list, as the language is: its six names are too long for a row of
 * segments (D-649).
 */
const ViewMenu = ({ view, onViewChange, languages }: ToolbarProps): ReactNode => {
  const { isOpen, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const languageId = useId();
  const backdropId = useId();

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
        {hasViewChanges(view) ? (
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
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.motion}</span>
            <Segmented
              label={STRINGS.motion}
              options={MOTION_CHOICES.map((motion) => ({ value: motion, label: STRINGS.motions[motion] }))}
              value={view.motion}
              onValueChange={(motion: MotionChoice): void => onViewChange({ ...view, motion })}
            />
          </div>
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.speed}</span>
            <Segmented
              label={STRINGS.speed}
              options={SPEED_CHOICES.map((speed) => ({ value: speed, label: STRINGS.speeds[speed] }))}
              value={view.speed}
              onValueChange={(speed: SpeedChoice): void => onViewChange({ ...view, speed })}
            />
          </div>
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.press}</span>
            <Segmented
              label={STRINGS.press}
              options={PRESS_CHOICES.map((press) => ({ value: press, label: STRINGS.presses[press] }))}
              value={view.press}
              onValueChange={(press: PressChoice): void => onViewChange({ ...view, press })}
            />
          </div>
          <div className="forgebook-popover__row">
            <label className="forgebook-popover__label" htmlFor={backdropId}>
              {STRINGS.backdrop}
            </label>
            <select
              id={backdropId}
              className="forgebook-select"
              value={view.backdrop}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                const { value } = event.currentTarget;
                const backdrop = BACKDROP_CHOICES.find((choice) => choice === value);
                if (backdrop !== undefined) onViewChange({ ...view, backdrop });
              }}
            >
              {BACKDROP_CHOICES.map((backdrop) => (
                <option key={backdrop} value={backdrop}>
                  {STRINGS.backdrops[backdrop]}
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
              isDisabled={view.compare === "sheets"}
              onValueChange={(sheets: SheetsChoice): void => onViewChange({ ...view, sheets })}
            />
          </div>
          <div className="forgebook-popover__row">
            <span className="forgebook-popover__label">{STRINGS.text}</span>
            <Segmented
              label={STRINGS.text}
              options={TEXT_SCALES.map((text) => ({ value: text, label: STRINGS.textScale(text) }))}
              value={view.text}
              isDisabled={view.compare === "text"}
              onValueChange={(text: TextScale): void => onViewChange({ ...view, text })}
            />
          </div>
          {languages.length === 0 ? null : (
            <div className="forgebook-popover__row">
              <label className="forgebook-popover__label" htmlFor={languageId}>
                {STRINGS.language}
              </label>
              <select
                id={languageId}
                className="forgebook-select"
                value={view.language}
                disabled={view.compare === "language"}
                onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                  onViewChange({ ...view, language: event.currentTarget.value })
                }
              >
                <option value={DEFAULT_VIEW.language}>{STRINGS.storiesLanguage}</option>
                {languages.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="forgebook-popover__foot">
            <button
              type="button"
              className="forgebook-text-button"
              onClick={(): void =>
                onViewChange({
                  ...view,
                  motion: DEFAULT_VIEW.motion,
                  speed: DEFAULT_VIEW.speed,
                  press: DEFAULT_VIEW.press,
                  backdrop: DEFAULT_VIEW.backdrop,
                  sheets: DEFAULT_VIEW.sheets,
                  text: DEFAULT_VIEW.text,
                  language: DEFAULT_VIEW.language
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

/**
 * The Compare menu: what the stage sets side by side (the themes at both contrasts, the languages, the text sizes, the
 * style sheets), or nothing; its button is pressed while the stage compares.
 *
 * @param props - the view, its setter, the story's languages, and whether the page compares at all.
 */
const CompareMenu = ({
  view,
  onViewChange,
  languages,
  isDisabled
}: ToolbarProps & { readonly isDisabled: boolean }): ReactNode => {
  const { isOpen, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
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
            {COMPARE_MODES.map((mode) => {
              const isUnavailable = mode === "language" && languages.length === 0;
              return (
                <label key={mode} className="forgebook-choice" data-disabled={isUnavailable ? "" : undefined}>
                  <input
                    type="radio"
                    name={name}
                    checked={view.compare === mode}
                    disabled={isUnavailable}
                    onChange={(): void => {
                      onViewChange({ ...view, compare: mode });
                      setIsOpen(false);
                    }}
                  />
                  {STRINGS.compareModes[mode]}
                  {isUnavailable ? (
                    <span className="forgebook-popover__note">{STRINGS.compareNoLanguages}</span>
                  ) : null}
                </label>
              );
            })}
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
 * @param props - the view, its setter and the shown story's languages.
 */
export const Toolbar = ({
  view,
  onViewChange,
  languages,
  isStoryPage = true,
  onShowSidebar,
  shownWidth
}: ToolbarProps): ReactNode => (
  <div className="forgebook-toolbar">
    {onShowSidebar === undefined ? null : <ShowSidebarButton onShowSidebar={onShowSidebar} />}
    <div className="forgebook-toolbar__group">
      <Segmented
        label={STRINGS.themeGroup}
        isDisabled={isStoryPage && view.compare === "theme"}
        options={THEME_CHOICES.map((theme) => ({
          value: theme,
          label: STRINGS.themes[theme],
          icon: THEME_ICONS[theme]
        }))}
        value={view.theme}
        onValueChange={(theme: ThemeChoice): void => onViewChange({ ...view, theme })}
      />
      <button
        type="button"
        className="forgebook-button"
        title={STRINGS.moreContrast}
        aria-pressed={view.isMoreContrast}
        disabled={isStoryPage && view.compare === "theme"}
        onClick={(): void => onViewChange({ ...view, isMoreContrast: !view.isMoreContrast })}
      >
        <Icon name="contrast" size={14} />
        <span className="forgebook-button__label">{STRINGS.moreContrast}</span>
      </button>
    </div>
    <span className="forgebook-toolbar__divider" />
    <ViewMenu view={view} onViewChange={onViewChange} languages={languages} />
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
          ...STAGE_WIDTHS.map((width) => ({ value: width, label: STRINGS.widthPx(width) }))
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
    <CompareMenu view={view} onViewChange={onViewChange} languages={languages} isDisabled={!isStoryPage} />
  </div>
);
