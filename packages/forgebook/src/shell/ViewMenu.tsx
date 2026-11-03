/**
 * The View menu: its button, with a dot when one of its values is changed, and its panel (`ViewMenuPanel`): every
 * control the person did not hide in it, in their order, each with its value, a handle to move it, a pin that puts it
 * on the toolbar and a button that hides it here (a pinned one stays on the toolbar); at its foot the hidden controls,
 * the wrap choice, the values' reset and the toolbar's reset.
 *
 * @remarks
 * The button is on every page and the panel only once asked for, so the panel's module loads the first time the menu
 * opens, fetched already when the pointer comes over the button or the focus reaches it. The popover opens at once as
 * before, and its content is drawn as soon as the module is there, the focus then going to its chosen option.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useState } from "react";

import type { ToolbarControl as Control, PlacedControl } from "../toolbarLayout.ts";
import { hasViewChanges, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { type ControlContext, ToolbarControl } from "./ToolbarControl.tsx";
import type { Loaded } from "./useLoaded.ts";
import { usePopover } from "./usePopover.ts";
import type { ToolbarLayout } from "./useToolbarLayout.ts";
import type { ViewMenuPanel } from "./ViewMenuPanel.tsx";

/** The room the menu keeps from the window's right edge, in CSS px. */
const EDGE_PX = 12;

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

/** The panel, once its module is there: a menu drawn after the first draws it at once. */
let loadedPanel: typeof ViewMenuPanel | undefined;

/** The panel's module, fetched once: a second call while it loads, or after, gets the same answer. */
let panelModule: Promise<typeof ViewMenuPanel> | undefined;

/** Loads the panel's module, or gives the load already asked for. */
const loadPanel = (): Promise<typeof ViewMenuPanel> => {
  panelModule ??= import("./ViewMenuPanel.tsx").then((module) => {
    loadedPanel = module.ViewMenuPanel;
    return module.ViewMenuPanel;
  });
  return panelModule;
};

/** The panel as the menu first finds it: there when an earlier menu loaded it. */
const initialPanel = (): Loaded<typeof ViewMenuPanel> =>
  loadedPanel === undefined ? { status: "loading" } : { status: "ready", value: loadedPanel };

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
  const [panel, setPanel] = useState(initialPanel);
  const ids = menuControlIds(layout.placed, movedIds);
  // the menu never runs past the window's edges: a narrow window keeps it inside, its widest values then scroll; a
  // short one scrolls its rows, the foot staying in sight
  useLayoutEffect(() => {
    const drawn = panelRef.current;
    if (!isDrawn || drawn === null) return;
    const keepInside = (): void => {
      const box = drawn.getBoundingClientRect();
      drawn.style.maxWidth = `${window.innerWidth - box.left - EDGE_PX}px`;
      drawn.style.maxHeight = `${window.innerHeight - box.top - EDGE_PX}px`;
    };
    keepInside();
    window.addEventListener("resize", keepInside);
    return (): void => window.removeEventListener("resize", keepInside);
  }, [isDrawn, panelRef]);

  // the panel's module loads when the menu is first drawn, if the pointer or the focus did not ask for it already
  useEffect(() => {
    if (!isDrawn || panel.status !== "loading") return;
    let isCurrent = true;
    loadPanel()
      .then((value) => {
        if (isCurrent) setPanel({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (isCurrent)
          setPanel({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [isDrawn, panel.status]);

  // a panel drawn after the menu opened takes the focus to its chosen option, as the popover does for one drawn with it
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the panel's arrival moves the focus
  useEffect(() => {
    if (panel.status !== "ready" || !isOpen) return;
    const panelElement = panelRef.current;
    if (panelElement === null || panelElement.contains(document.activeElement)) return;
    panelElement.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [panel.status]);

  /** Fetches the panel ahead of a press, so the menu draws it at once. */
  const preload = (): void => {
    loadPanel().catch(() => undefined);
  };

  return (
    <div className="forgebook-view-menu">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => setIsOpen(!isOpen, event)}
      >
        <Icon name="sliders" size={14} />
        {STRINGS.view}
        {hasViewChanges(ownView, switches, ids) ? (
          <span className="forgebook-dot" role="img" aria-label={STRINGS.viewChanged} />
        ) : null}
        <Icon name="chevronDown" size={12} />
      </button>
      {isDrawn ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-popover--arrange"
          role="dialog"
          aria-label={STRINGS.view}
        >
          {panel.status === "ready" ? (
            <panel.value
              layout={layout}
              ownView={ownView}
              movedIds={movedIds}
              ids={ids}
              drawControl={(control: Control): ReactNode => (
                <ToolbarControl control={control} form="row" {...context} />
              )}
              {...context}
            />
          ) : null}
          {panel.status === "error" ? (
            <p className="forgebook-problems" role="alert">
              {STRINGS.viewMenuError}: {panel.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
