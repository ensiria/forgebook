/**
 * A row of the View menu: a handle to move the control (dragged, or with the arrow keys, the new position announced),
 * its name with a dot when its value is changed, its value, its key, a pin that puts it on the toolbar and a button that
 * hides it in the menu.
 *
 * @module
 */
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import type { ToolbarControl as Control, PlacedControl } from "../toolbarLayout.ts";
import { ControlKeyField } from "./ControlKeyField.tsx";
import { controlLabel } from "./controlLabel.ts";
import { InfoTip } from "./InfoTip.tsx";
import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { STRINGS } from "./strings.ts";
import type { ToolbarLayout } from "./useToolbarLayout.ts";

/** The arrow keys that move a row, and by how much. */
const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

/**
 * One control's row: its handle, its name, its value, its key, its pin and its hide button.
 *
 * @param props - the placed control, its position, what moving and placing it do, and what every control shares.
 */
export const ControlRow = ({
  each,
  index,
  count,
  isDragged,
  isMoved,
  isChanged,
  layout,
  hintId,
  onGrab,
  onAnnounce,
  drawControl
}: {
  readonly each: PlacedControl;
  readonly index: number;
  readonly count: number;
  readonly isDragged: boolean;
  /** Whether it is pinned but the bar has no room for it now. */
  readonly isMoved: boolean;
  /** Whether the person set a value that is not its default. */
  readonly isChanged: boolean;
  readonly layout: ToolbarLayout;
  readonly hintId: string;
  readonly onGrab: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
  readonly onAnnounce: (text: string) => void;
  /** Draws a control in a row's form, as the toolbar draws it, with the view it reads and sets. */
  readonly drawControl: (control: Control) => ReactNode;
}): ReactNode => {
  const { control, isPinned } = each;
  const label = controlLabel(control);
  const step = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const offset = ARROW_STEPS[event.key] ?? 0;
    const target = index + offset;
    if (offset === 0 || target < 0 || target >= count) return;
    event.preventDefault();
    layout.move(control.id, target);
    onAnnounce(LATER_STRINGS.controlMoved(label, target + 1, count));
  };
  // a switch's note (the touch simulation's limits): an info button beside its value
  const description = control.kind === "switch" ? control.switch.description : undefined;
  return (
    <li
      className="forgebook-arrange"
      data-control={control.id}
      data-pinned={isPinned ? "" : undefined}
      data-dragged={isDragged ? "" : undefined}
      data-moved={isMoved ? "" : undefined}
    >
      <button
        type="button"
        className="forgebook-arrange__handle"
        aria-label={LATER_STRINGS.moveControl(label)}
        aria-describedby={hintId}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>): void => onGrab(event, control.id)}
        onKeyDown={step}
      >
        <Icon name="grip" size={14} />
      </button>
      <span className="forgebook-popover__label">
        {label}
        {isChanged ? (
          <span className="forgebook-dot" role="img" aria-label={STRINGS.controlChanged(label)} />
        ) : null}
      </span>
      <div className="forgebook-arrange__control">
        {drawControl(control)}
        {description === undefined ? null : <InfoTip note={description} about={label} />}
      </div>
      <ControlKeyField
        label={label}
        shortcut={layout.keys[control.id]}
        onKeyChange={(key: string | null): string | undefined => layout.setKey(control.id, key)}
      />
      <button
        type="button"
        className="forgebook-icon-button"
        aria-label={LATER_STRINGS.pinControl(label)}
        title={isMoved ? LATER_STRINGS.pinnedNoRoom : LATER_STRINGS.pinControl(label)}
        aria-pressed={isPinned}
        onClick={(): void => layout.pin(control.id, !isPinned)}
      >
        <Icon name="pin" size={14} />
      </button>
      <button
        type="button"
        className="forgebook-icon-button"
        aria-label={LATER_STRINGS.hideControl(label)}
        title={LATER_STRINGS.hideControl(label)}
        onClick={(): void => layout.hide(control.id, true)}
      >
        <Icon name="eyeOff" size={14} />
      </button>
    </li>
  );
};
