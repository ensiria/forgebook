/**
 * What a story about logic (`parameters.logic`) leaves out of the toolbar and the stage: what only changes its looks.
 *
 * @remarks
 * A logic story is a hook's or a function's scene, so the bar puts away the controls that only change how it looks
 * (the colour scheme, the contrast, the style sheets, the text size, the backdrop), which the View menu still offers,
 * and Compare, which it does not: the story is drawn once, never compared, while the address keeps its compare for the
 * other stories.
 *
 * @module
 */
import { switchWithRole, type ViewSwitch } from "../switches.ts";
import type { ViewState } from "../viewState.ts";

/** Forgebook's own controls that only change a story's looks. */
const LOOK_OWN_CONTROLS: readonly string[] = ["backdrop", "sheets", "text"];

/**
 * Whether a toolbar control only changes a story's looks.
 *
 * @param id - the control's id.
 * @param switches - the catalogue's switches.
 */
export const isLookControl = (id: string, switches: readonly ViewSwitch[]): boolean =>
  LOOK_OWN_CONTROLS.includes(id) ||
  switchWithRole(switches, "colorScheme")?.id === id ||
  switchWithRole(switches, "contrast")?.id === id;

/**
 * The view a story is drawn with: a logic story's never compares.
 *
 * @param view - the address's view.
 * @param isLogic - whether the story is about logic.
 */
export const logicView = (view: ViewState, isLogic: boolean): ViewState =>
  isLogic && view.compare.length > 0 ? { ...view, compare: [] } : view;

/**
 * A change of a logic story's view, back to the address: the address keeps its own compare.
 *
 * @param next - the changed view.
 * @param addressView - the address's view.
 * @param isLogic - whether the story is about logic.
 */
export const logicViewChange = (next: ViewState, addressView: ViewState, isLogic: boolean): ViewState =>
  isLogic ? { ...next, compare: addressView.compare } : next;
