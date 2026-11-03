/**
 * The panel docked under a story: a row of tabs (Props, Events, Parts and styling, Code, Design, Accessibility) and the chosen
 * tab's content, which scrolls on its own, so reading the props or the code never moves the story away.
 *
 * @remarks
 * The tabs follow the ARIA tabs pattern: the arrow keys move between them, Home and End go to the ends. The handle on
 * the top edge sets the panel's height (dragged, or with the arrow keys); the height is a convenience of this browser,
 * kept in its storage, not in the address. Only the tabs the story has something for are shown.
 *
 * @module
 */
import { type KeyboardEvent, type PointerEvent, type ReactNode, useId, useRef } from "react";

import type { PanelTab } from "../viewState.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { useStored } from "./useStored.ts";

/** One tab of the panel. */
export type DockTab = {
  /** The tab's id, kept in the address. */
  readonly id: PanelTab;
  /** The tab's name. */
  readonly label: string;
  /** A short note beside the name (a count); none by default. */
  readonly hint?: string | undefined;
  /** What the tab shows. */
  readonly content: ReactNode;
};

/** The dock's props. */
export type DockProps = {
  /** The tabs the story has something for, in order. */
  readonly tabs: readonly DockTab[];
  /** The chosen tab; the first tab shows when the story has nothing for it. */
  readonly activeTab: PanelTab;
  /** Called with the tab chosen. */
  readonly onTabChange: (tab: PanelTab) => void;
  /** Closes the panel. */
  readonly onClose: () => void;
};

/** The panel's height, in CSS px: the default, the bounds a drag keeps to, and one arrow key's step. */
const HEIGHT = { initial: 300, min: 120, step: 24 } as const;

/** Where this browser keeps the panel's height. */
const HEIGHT_KEY = "dock-height";

/** The height a stored text holds, or the default. */
const storedHeight = (stored: string | null): number => {
  const value = Number(stored);
  return stored !== null && Number.isFinite(value) && value >= HEIGHT.min ? value : HEIGHT.initial;
};

/** A height kept between the minimum and most of the window, so the story always keeps some room. */
const boundedHeight = (height: number): number =>
  Math.round(Math.min(window.innerHeight * 0.8, Math.max(HEIGHT.min, height)));

/**
 * The panel under a story.
 *
 * @param props - the tabs, the chosen one and the setters.
 */
export const Dock = ({ tabs, activeTab, onTabChange, onClose }: DockProps): ReactNode => {
  const [height, setHeight] = useStored(HEIGHT_KEY, storedHeight, (value: number) =>
    String(Math.round(value))
  );
  const tabRefs = useRef(new Map<PanelTab, HTMLButtonElement>());
  const baseId = useId();
  const shown = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const startResize = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = height;
    const move = (moveEvent: globalThis.PointerEvent): void =>
      setHeight(boundedHeight(startHeight + startY - moveEvent.clientY));
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowUp") setHeight(boundedHeight(height + HEIGHT.step));
    else if (event.key === "ArrowDown") setHeight(boundedHeight(height - HEIGHT.step));
    else return;
    event.preventDefault();
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = tabs.findIndex((tab) => tab.id === shown?.id);
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1
    };
    const next = tabs[targets[event.key] ?? -1];
    if (next === undefined) return;
    event.preventDefault();
    onTabChange(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <section className="forgebook-dock" style={{ height }} aria-label={STRINGS.panel}>
      {/* biome-ignore lint/a11y/useSemanticElements: a draggable splitter has no element of its own; role separator with a value is the ARIA pattern for it */}
      <div
        className="forgebook-dock__handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label={STRINGS.panelHeight}
        aria-valuenow={height}
        aria-valuemin={HEIGHT.min}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={resizeWithKeys}
      />
      <div className="forgebook-dock__bar">
        <div className="forgebook-dock__tabs" role="tablist" aria-label={STRINGS.panel} onKeyDown={moveFocus}>
          {tabs.map((tab) => {
            const isActive = tab.id === shown?.id;
            return (
              <button
                key={tab.id}
                ref={(element: HTMLButtonElement | null): void => {
                  if (element === null) tabRefs.current.delete(tab.id);
                  else tabRefs.current.set(tab.id, element);
                }}
                type="button"
                role="tab"
                id={`${baseId}-${tab.id}`}
                className="forgebook-dock__tab"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel`}
                tabIndex={isActive ? 0 : -1}
                onClick={(): void => onTabChange(tab.id)}
              >
                {tab.label}
                {tab.hint === undefined ? null : <span className="forgebook-dock__hint">{tab.hint}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="forgebook-icon-button"
          title={STRINGS.closePanel}
          aria-label={STRINGS.closePanel}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      {shown === undefined ? null : (
        <div
          id={`${baseId}-panel`}
          className="forgebook-dock__body"
          role="tabpanel"
          aria-labelledby={`${baseId}-${shown.id}`}
        >
          {shown.content}
        </div>
      )}
    </section>
  );
};
