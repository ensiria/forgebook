/**
 * A pinned control's small menu, opened by a right-click or the keyboard's menu key: take it off the toolbar, hide it in
 * the View menu or show it there again.
 *
 * @remarks
 * Loaded the first time one opens (`PinnedControl.tsx`): the control is on the first screen, and few readers ever ask for
 * its menu.
 *
 * @module
 */
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { LATER_STRINGS } from "./laterStrings.ts";
import type { ToolbarLayout } from "./useToolbarLayout.ts";

/** The room the menu keeps from the window's edges, in CSS px. */
const EDGE_PX = 8;

/** Where the menu opens, in the window's px. */
export type MenuPoint = {
  /** From the window's left. */
  readonly x: number;
  /** From the window's top. */
  readonly y: number;
};

/** The menu's props. */
export type ControlMenuProps = {
  /** The control's id. */
  readonly id: string;
  /**
   * The control's name. Given rather than read here: a module the page also imports would be taken into a chunk of its
   * own, and the first load would grow by more than this menu saves.
   */
  readonly label: string;
  /** Whether it takes no row in the View menu. */
  readonly isHidden: boolean;
  /** Where the menu opens. */
  readonly at: MenuPoint;
  /** The toolbar's arrangement, which its choices change. */
  readonly layout: ToolbarLayout;
  /** Called when it closes. */
  readonly onClose: () => void;
};

/**
 * The control's menu: its two choices as menu items, the first focused, the arrow keys between them; closed by a
 * choice, a press outside or Escape, the focus going back where it was.
 *
 * @param props - the control, where the menu opens, what its choices do, and what closing it does.
 */
export const ControlMenu = ({ id, label, isHidden, at, layout, onClose }: ControlMenuProps): ReactNode => {
  const menuRef = useRef<HTMLDivElement>(null);
  // the menu stays inside the window: opened near its right or lower edge, it moves back by what would run past
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(EDGE_PX, Math.min(at.x, window.innerWidth - box.width - EDGE_PX))}px`;
    menu.style.top = `${Math.max(EDGE_PX, Math.min(at.y, window.innerHeight - box.height - EDGE_PX))}px`;
  }, [at]);
  useEffect(() => {
    const before = document.activeElement;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const close = (event: globalThis.PointerEvent | globalThis.KeyboardEvent): void => {
      const isOutside =
        event instanceof PointerEvent &&
        !(event.target instanceof Node && menuRef.current?.contains(event.target));
      const isEscape = event instanceof KeyboardEvent && event.key === "Escape";
      if (!isOutside && !isEscape) return;
      onClose();
      if (isEscape && before instanceof HTMLElement) before.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return (): void => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [onClose]);
  const step = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const focused = document.activeElement;
    const index = focused instanceof HTMLButtonElement ? items.indexOf(focused) : -1;
    const next = (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  const unpin = (): void => {
    onClose();
    layout.pin(id, false);
  };
  const toggleHidden = (): void => {
    onClose();
    layout.hide(id, !isHidden);
  };
  return (
    <div
      ref={menuRef}
      className="forgebook-context-menu"
      role="menu"
      aria-label={LATER_STRINGS.controlMenu(label)}
      style={{ left: at.x, top: at.y }}
      onKeyDown={step}
    >
      <button type="button" role="menuitem" className="forgebook-context-menu__item" onClick={unpin}>
        {LATER_STRINGS.unpinControl}
      </button>
      <button type="button" role="menuitem" className="forgebook-context-menu__item" onClick={toggleHidden}>
        {isHidden ? LATER_STRINGS.showInView : LATER_STRINGS.hideInView}
      </button>
    </div>
  );
};
