/**
 * The device control of the toolbar and the View menu: a list that says what the story is shown in ("No frame", "iPhone
 * 16"…), turns the frame off and picks the model, and, while a device is shown, the button that turns it.
 *
 * @remarks
 * A native list, for the platform's keys and screen reader, its models grouped by kind. The address keeps only what
 * differs from the page's default (`deviceView.ts`, `deviceMenuView.ts`). The device's drawing is not here: it loads
 * with the device's parts the first time a story is framed (`DeviceSlot.tsx`).
 *
 * @module
 */
import type { ChangeEvent, ReactNode } from "react";

import { withModel, withTurn } from "../deviceMenuView.ts";
import {
  DEVICE_ENTRIES,
  type DeviceDefault,
  type DeviceEntry,
  type DeviceKind,
  isDeviceId,
  shownDevice,
  withFrame
} from "../deviceView.ts";
import type { ViewState } from "../viewState.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";

/** The value of the list's first choice: no device. */
const NO_FRAME = "off";

/** The device control's props. */
export type DeviceControlProps = {
  /** Where it is drawn: on the toolbar, with its icon, or in a row of the View menu, whose row names it. */
  readonly form: "bar" | "row";
  /** The view shown. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  /** The page's default device: the shown story's, a component's stories', or the catalogue's. */
  readonly defaults: DeviceDefault;
};

/** The list's groups, in its order. */
const KIND_GROUPS: readonly { readonly kind: DeviceKind; readonly label: () => string }[] = [
  { kind: "phone", label: () => STRINGS.devicePhones },
  { kind: "tablet", label: () => STRINGS.deviceTablets }
];

/**
 * A model's name in the list: the generic phone's is the shell's text, so a catalogue can translate it.
 *
 * @param entry - the model.
 */
const entryName = (entry: DeviceEntry): string => (entry.id === "phone" ? STRINGS.deviceGeneric : entry.name);

/**
 * The device control.
 *
 * @param props - its form, the view, its setter and the page's default device.
 */
export const DeviceControl = ({ form, view, onViewChange, defaults }: DeviceControlProps): ReactNode => {
  const shown = shownDevice(view, defaults);
  const choose = (value: string): void => {
    if (value === NO_FRAME) onViewChange(withFrame(view, defaults, false));
    else if (isDeviceId(value)) onViewChange(withModel(view, defaults, value));
  };
  return (
    <div className="forgebook-toolbar__control forgebook-device-control">
      {form === "bar" ? (
        <span className="forgebook-toolbar__icon" title={STRINGS.device}>
          <Icon name="device" size={14} />
        </span>
      ) : null}
      <select
        className="forgebook-select"
        aria-label={STRINGS.device}
        value={shown?.model ?? NO_FRAME}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void => choose(event.currentTarget.value)}
      >
        <option value={NO_FRAME}>{STRINGS.deviceNone}</option>
        {KIND_GROUPS.map((group) => (
          <optgroup key={group.kind} label={group.label()}>
            {DEVICE_ENTRIES.filter((entry) => entry.kind === group.kind).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entryName(entry)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {shown === undefined ? null : (
        <button
          type="button"
          className="forgebook-button forgebook-button--icon"
          title={STRINGS.deviceTurn}
          aria-label={STRINGS.deviceTurn}
          aria-pressed={shown.orientation === "landscape"}
          onClick={(): void => onViewChange(withTurn(view, defaults, shown))}
        >
          <Icon name="turn" size={14} />
        </button>
      )}
    </div>
  );
};
