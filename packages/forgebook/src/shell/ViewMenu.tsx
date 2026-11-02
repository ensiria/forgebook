/**
 * The View menu's button, and its panel once opened (`ViewMenuPanel.tsx`).
 *
 * @remarks
 * The panel is the shell's largest control, and most visits never open it, so it loads on the first click. The click
 * waits for it rather than opening an empty menu: `usePopover` grows the panel in and moves the focus as it is drawn.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useState } from "react";

import type { PlacedControl } from "../toolbarLayout.ts";
import { hasViewChanges, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import type { ControlContext } from "./ToolbarControl.tsx";
import { usePopover } from "./usePopover.ts";
import type { ToolbarLayout } from "./useToolbarLayout.ts";
import type { ViewMenuPanel } from "./ViewMenuPanel.tsx";

/**
 * The ids of the controls whose values the View menu answers for: those not on the toolbar (in it, or hidden, whose
 * value still applies, or pinned but moved into it for want of room), the stage's width aside, which is not a view
 * setting.
 *
 * @param placed - the placed controls.
 * @param movedIds - the pinned controls the bar has no room for, shown in the menu: counted with its own.
 */
export const menuControlIds = (
  placed: readonly PlacedControl[],
  movedIds: readonly string[] = []
): string[] =>
  placed
    .filter((each) => (!each.isPinned || movedIds.includes(each.control.id)) && each.control.id !== "width")
    .map((each) => each.control.id);

/**
 * The View menu.
 *
 * @param props - the arrangement, whether the person changed one of the menu's values, and what every control shares.
 */
export const ViewMenu = ({
  layout,
  ownView,
  movedIds,
  ...context
}: ControlContext & {
  readonly layout: ToolbarLayout;
  /** The pinned controls the bar has no room for now: listed here as pinned, shown here until there is room. */
  readonly movedIds: readonly string[];
  /** The person's own view, without what the story fixes: a value the story fixes is not a change of theirs. */
  readonly ownView: ViewState;
}): ReactNode => {
  const { isOpen, isDrawn, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const { switches } = useCatalogue();
  const [panel, setPanel] = useState<{ readonly component: typeof ViewMenuPanel } | undefined>(undefined);
  const ids = menuControlIds(layout.placed, movedIds);
  const toggle = (event: MouseEvent<HTMLButtonElement>): void => {
    if (panel !== undefined) {
      setIsOpen(!isOpen, event);
      return;
    }
    const press = { detail: event.detail };
    void import("./ViewMenuPanel.tsx").then(({ ViewMenuPanel: component }) => {
      setPanel({ component });
      setIsOpen(true, press);
    });
  };
  const Panel = panel?.component;
  return (
    <div className="forgebook-view-menu">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
      >
        <Icon name="sliders" size={14} />
        {STRINGS.view}
        {hasViewChanges(ownView, switches, ids) ? (
          <span className="forgebook-dot" role="img" aria-label={STRINGS.viewChanged} />
        ) : null}
        <Icon name="chevronDown" size={12} />
      </button>
      {isDrawn && Panel !== undefined ? (
        <Panel
          layout={layout}
          ownView={ownView}
          ids={ids}
          movedIds={movedIds}
          panelRef={panelRef}
          panelId={panelId}
          {...context}
        />
      ) : null}
    </div>
  );
};
