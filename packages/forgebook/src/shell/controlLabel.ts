/**
 * A control's name, as the toolbar, the View menu's rows and their buttons write it.
 *
 * @remarks
 * Apart from the controls themselves (`ToolbarControl`), so the View menu's panel, which loads when it first opens,
 * names its rows without bringing the controls' module along: the menu hands it the controls drawn.
 *
 * @module
 */
import type { OwnControlId } from "../catalogue.ts";
import { DEVICE_PARAMETER } from "../deviceView.ts";
import type { ToolbarControl as Control } from "../toolbarLayout.ts";
import { STRINGS } from "./strings.ts";

/** The name of each of Forgebook's own controls. */
const OWN_LABELS: Readonly<Record<OwnControlId, () => string>> = {
  backdrop: () => STRINGS.backdrop,
  sheets: () => STRINGS.sheets,
  text: () => STRINGS.text,
  width: () => STRINGS.width,
  [DEVICE_PARAMETER]: () => STRINGS.device
};

/**
 * A control's name, as its row, its menu and its buttons' names write it.
 *
 * @param control - the control.
 */
export const controlLabel = (control: Control): string =>
  control.kind === "switch" ? control.switch.label : OWN_LABELS[control.id]();
