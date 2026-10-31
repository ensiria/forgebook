/**
 * A control pinned on the toolbar, with its own small menu on right-click (or the keyboard's menu key): take it off
 * the toolbar, hide it in the View menu or show it there again. The order is not changed here: it is set in the View
 * menu.
 *
 * @module
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import type { ToolbarControl as Control } from "../toolbarLayout.ts";
import { STRINGS } from "./strings.ts";
import { type ControlContext, controlLabel, ToolbarControl } from "./ToolbarControl.tsx";
import type { ToolbarLayout } from "./useToolbarLayout.ts";

/** Where the menu opens, in the window's px. */
type MenuPoint = { readonly x: number; readonly y: number };

/**
 * The control's menu: its two choices as menu items, the first focused, the arrow keys between them; closed by a
 * choice, a press outside or Escape, the focus going back where it was.
 *
 * @param props - the control, where the menu opens, what its choices do, and what closing it does.
 */
const ControlMenu = ({
  control,
  isHidden,
  at,
  layout,
  onClose
}: {
  readonly control: Control;
  readonly isHidden: boolean;
  readonly at: MenuPoint;
  readonly layout: ToolbarLayout;
  readonly onClose: () => void;
}): ReactNode => {
  const menuRef = useRef<HTMLDivElement>(null);
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
    layout.pin(control.id, false);
  };
  const toggleHidden = (): void => {
    onClose();
    layout.hide(control.id, !isHidden);
  };
  return (
    <div
      ref={menuRef}
      className="forgebook-context-menu"
      role="menu"
      aria-label={STRINGS.controlMenu(controlLabel(control))}
      style={{ left: at.x, top: at.y }}
      onKeyDown={step}
    >
      <button type="button" role="menuitem" className="forgebook-context-menu__item" onClick={unpin}>
        {STRINGS.unpinControl}
      </button>
      <button type="button" role="menuitem" className="forgebook-context-menu__item" onClick={toggleHidden}>
        {isHidden ? STRINGS.showInView : STRINGS.hideInView}
      </button>
    </div>
  );
};

/**
 * A pinned control.
 *
 * @param props - the control, the arrangement, and what every control shares.
 */
export const PinnedControl = ({
  control,
  isHidden,
  isChanged,
  layout,
  ...context
}: ControlContext & {
  readonly control: Control;
  /** Whether it takes no row in the View menu. */
  readonly isHidden: boolean;
  /** Whether the person set a value that is not its default: a dot marks it, as View's button marks its own. */
  readonly isChanged: boolean;
  readonly layout: ToolbarLayout;
}): ReactNode => {
  const shortcut = layout.keys[control.id];
  const [menuAt, setMenuAt] = useState<MenuPoint | undefined>(undefined);
  // one function for the menu's life: it focuses its first item once, when it opens
  const close = useCallback((): void => setMenuAt(undefined), []);
  const open = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    // the keyboard's menu key gives no pointer: the menu opens under the control
    const box = event.currentTarget.getBoundingClientRect();
    const isFromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenuAt(isFromKeyboard ? { x: box.left, y: box.bottom } : { x: event.clientX, y: event.clientY });
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the menu opens from the controls inside, which keep their own roles; the keyboard's menu key reaches it from them
    <div
      className="forgebook-toolbar__pinned"
      data-control={control.id}
      // the key that cycles it, in the tooltip of every part that has no tooltip of its own
      title={
        shortcut === undefined ? undefined : STRINGS.cycleKey(controlLabel(control), shortcut.toUpperCase())
      }
      onContextMenu={open}
    >
      <ToolbarControl control={control} form="bar" {...context} />
      {isChanged ? (
        <span
          className="forgebook-dot forgebook-toolbar__changed"
          role="img"
          aria-label={STRINGS.controlChanged(controlLabel(control))}
        />
      ) : null}
      {menuAt === undefined ? null : (
        <ControlMenu control={control} isHidden={isHidden} at={menuAt} layout={layout} onClose={close} />
      )}
    </div>
  );
};
