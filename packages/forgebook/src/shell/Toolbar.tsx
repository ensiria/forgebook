/**
 * The catalogue's toolbar: the View menu first, then the controls the person pinned, in their order, then the panel
 * and Compare; every value kept in the address, the arrangement in the person's browser.
 *
 * @remarks
 * The controls are the catalogue's switches and Forgebook's own (the background, the style sheets, the text size, the
 * stage's width); which start pinned is the catalogue's choice, where each sits is the person's (`toolbarLayout.ts`).
 * The panel and Compare belong to the page, not to the view: they stay at the end.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useId, useRef } from "react";

import type { CatalogueSettings } from "../catalogue.ts";
import { type DeviceDefault, NO_DEVICE } from "../deviceView.ts";
import { type FixedView, NOT_FIXED, withFixed, withOwnFixed } from "../storyGlobals.ts";
import { switchWithRole } from "../switches.ts";
import { hasViewChanges, isComparing, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { isLookControl } from "./logicView.ts";
import { PinnedControl } from "./PinnedControl.tsx";
import { STRINGS } from "./strings.ts";
import { useControlKeys } from "./useControlKeys.ts";
import { usePopover } from "./usePopover.ts";
import { useToolbarLayout } from "./useToolbarLayout.ts";
import { useToolbarOverflow } from "./useToolbarOverflow.ts";
import { ViewMenu } from "./ViewMenu.tsx";

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
  /** Whether the shown page is about logic (a hook's story or page): the bar puts away what only changes looks. */
  readonly isLogic?: boolean;
  /** The page's default device: the shown story's, or the catalogue's on a component's page; none by default. */
  readonly deviceDefault?: DeviceDefault;
};

/** One choice of the Compare menu: what it sets side by side, and its name. */
type CompareChoice = {
  /** The compared axes; none for Off. */
  readonly axes: readonly string[];
  /** The name in the menu. */
  readonly label: string;
};

/**
 * The Compare menu's choices: Off, the colour scheme at both contrasts when the catalogue has both, each other switch,
 * and the text sizes and the style sheets when the catalogue shows them.
 *
 * @param catalogue - the catalogue's switches and controls.
 */
const compareChoices = (catalogue: Pick<CatalogueSettings, "switches" | "ownControls">): CompareChoice[] => {
  const { switches, ownControls } = catalogue;
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
    ...switches
      .filter((each) => each !== scheme && each !== contrast)
      .map((each) => ({ axes: [each.id], label: each.label })),
    ...(ownControls.includes("text") ? [{ axes: ["text"], label: STRINGS.compareText }] : []),
    ...(ownControls.includes("sheets") ? [{ axes: ["sheets"], label: STRINGS.compareSheets }] : [])
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
  const { isOpen, isDrawn, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const catalogue = useCatalogue();
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
        onClick={(event: MouseEvent<HTMLButtonElement>): void => setIsOpen(!isOpen, event)}
      >
        <Icon name="compare" size={14} />
        <span className="forgebook-button__label">{STRINGS.compare}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {isDrawn ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-popover--end"
          role="dialog"
          aria-label={STRINGS.compare}
        >
          <fieldset className="forgebook-choices">
            <legend className="forgebook-visually-hidden">{STRINGS.compare}</legend>
            {compareChoices(catalogue).map((choice) => (
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
  fixed = NOT_FIXED,
  isLogic = false,
  deviceDefault = NO_DEVICE
}: ToolbarProps): ReactNode => {
  const layout = useToolbarLayout();
  const catalogue = useCatalogue();
  // the story's fixed values are shown, and a change of anything else keeps the user's own in the address
  const view = withFixed(ownView, fixed);
  const onViewChange = (changed: ViewState): void => onOwnViewChange(withOwnFixed(changed, ownView, fixed));
  const context = { view, onViewChange, isStoryPage, fixed, shownWidth, deviceDefault };
  useControlKeys({ keys: layout.keys, view, onViewChange, fixed, isStoryPage });
  const pinnedRef = useRef<HTMLDivElement>(null);
  // a page about logic puts away the pinned controls that only change looks: the View menu then counts them
  const putAway = layout.placed
    .filter((each) => each.isPinned && isLogic && isLookControl(each.control.id, catalogue.switches))
    .map((each) => each.control.id);
  const pinned = layout.placed.filter((each) => each.isPinned && !putAway.includes(each.control.id));
  const moved = useToolbarOverflow(
    pinnedRef,
    pinned.map((each) => each.control.id)
  );
  // a bar that wraps has room for every pinned control
  const onBar = layout.isWrapped ? pinned : pinned.filter((each) => !moved.includes(each.control.id));
  return (
    <div className={layout.isWrapped ? "forgebook-toolbar forgebook-toolbar--wrap" : "forgebook-toolbar"}>
      {onShowSidebar === undefined ? null : <ShowSidebarButton onShowSidebar={onShowSidebar} />}
      <ViewMenu
        layout={layout}
        ownView={ownView}
        movedIds={[...(layout.isWrapped ? [] : moved), ...putAway]}
        {...context}
      />
      {onBar.length === 0 ? null : <span className="forgebook-toolbar__divider" />}
      {/* the pinned controls take the room View, the panel and Compare leave; a bar that wraps wraps only them */}
      <div ref={pinnedRef} className="forgebook-toolbar__pinned-list">
        {onBar.map((each) => (
          <PinnedControl
            key={each.control.id}
            control={each.control}
            isHidden={each.isHidden}
            isChanged={hasViewChanges(ownView, catalogue.switches, [each.control.id])}
            layout={layout}
            {...context}
          />
        ))}
      </div>
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
      {isLogic ? null : (
        <CompareMenu view={view} onViewChange={onViewChange} isDisabled={!isStoryPage} fixed={fixed} />
      )}
    </div>
  );
};
