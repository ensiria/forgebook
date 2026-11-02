/**
 * The device frame's toggle at the start of the stage's width, and, while a device is shown, its menu of models and
 * the button that turns it.
 *
 * @remarks
 * The toggle is on the first screen, so it is in the shell's first load; the menu comes with the device's parts
 * (`DeviceSlot.tsx`), which a framed story loads anyway. The address keeps only what differs from the page's default
 * (`deviceView.ts`).
 *
 * @module
 */
import type { ReactNode } from "react";

import { type DeviceDefault, shownDevice, withFrame } from "../deviceView.ts";
import type { ViewState } from "../viewState.ts";
import { useDeviceParts } from "./DeviceSlot.tsx";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";

/** The toggle's props. */
export type DeviceToggleProps = {
  /** The view shown. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  /** The page's default device: the shown story's, or the catalogue's on a component's page. */
  readonly defaults: DeviceDefault;
};

/**
 * The toggle, then the menu while a device is shown.
 *
 * @param props - the view, its setter and the page's default device.
 */
export const DeviceToggle = ({ view, onViewChange, defaults }: DeviceToggleProps): ReactNode => {
  const shown = shownDevice(view, defaults);
  const parts = useDeviceParts(shown !== undefined);
  return (
    <span className="forgebook-device-menu">
      <button
        type="button"
        className="forgebook-device-toggle"
        title={STRINGS.device}
        aria-label={STRINGS.device}
        aria-pressed={shown !== undefined}
        onClick={(): void => onViewChange(withFrame(view, defaults, shown === undefined))}
      >
        <Icon name="device" size={14} />
      </button>
      {shown === undefined || parts === undefined ? null : (
        <parts.DeviceMenu view={view} onViewChange={onViewChange} defaults={defaults} shown={shown} />
      )}
    </span>
  );
};
