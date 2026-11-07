/**
 * A control pinned on the toolbar, with its own small menu on right-click (or the keyboard's menu key): take it off
 * the toolbar, hide it in the View menu or show it there again. The order is not changed here: it is set in the View
 * menu.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";

import type { ToolbarControl as Control } from "../toolbarLayout.ts";
import { controlLabel } from "./controlLabel.ts";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import type { MenuPoint } from "./PinnedControlMenu.tsx";
import { STRINGS } from "./strings.ts";
import { type ControlContext, ToolbarControl } from "./ToolbarControl.tsx";
import type { ToolbarLayout } from "./useToolbarLayout.ts";

/** A note's button, for the few switches with a note: most catalogues pin none of them. */
const INFO_TIP = lazyModule(() => import("./InfoTip.tsx").then((module) => module.InfoTip));

/** The control's menu, loaded the first time one opens. */
const CONTROL_MENU = lazyModule(() => import("./PinnedControlMenu.tsx").then((module) => module.ControlMenu));

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
      {control.kind === "switch" && control.switch.description !== undefined ? (
        <LazyView
          module={INFO_TIP}
          props={{ note: control.switch.description, about: controlLabel(control) }}
          loading={null}
          failed={(): ReactNode => null}
        />
      ) : null}
      {isChanged ? (
        <span
          className="forgebook-dot forgebook-toolbar__changed"
          role="img"
          aria-label={STRINGS.controlChanged(controlLabel(control))}
        />
      ) : null}
      {menuAt === undefined ? null : (
        <LazyView
          module={CONTROL_MENU}
          props={{
            id: control.id,
            label: controlLabel(control),
            isHidden,
            at: menuAt,
            layout,
            onClose: close
          }}
          loading={null}
          failed={(): ReactNode => null}
        />
      )}
    </div>
  );
};
