/**
 * A control's next value, for its key: the view with one control moved on by a step through its values, as its
 * toolbar control would set it.
 *
 * @remarks
 * Pure. A control its toolbar control leaves disabled is left as it is here too: a switch or a background the story
 * fixes (or a width), and a control the compare view draws side by side.
 *
 * @module
 */

import { AUDIENCE_IDS } from "../audiences.ts";
import type { CatalogueSettings } from "../catalogue.ts";
import { cycledValue, switchValues } from "../controlKeys.ts";
import type { FixedView } from "../storyGlobals.ts";
import {
  isComparing,
  PLAIN_BACKDROP,
  SHEETS_CHOICES,
  type StageWidth,
  type ViewState
} from "../viewState.ts";
import { withSwitch } from "./switchView.ts";

/** What a cycle reads of the catalogue: its controls' values. */
type CycledCatalogue = Pick<CatalogueSettings, "switches" | "backdrops" | "textSizes" | "widths">;

/**
 * The view with one of Forgebook's own controls moved on.
 *
 * @param view - the view.
 * @param id - the control's id.
 * @param step - 1 forward, -1 back.
 * @param catalogue - the controls' values.
 */
const cycledOwn = (
  view: ViewState,
  id: string,
  step: 1 | -1,
  catalogue: CycledCatalogue
): ViewState | undefined => {
  if (id === "backdrop") {
    const backdrops = [PLAIN_BACKDROP, ...catalogue.backdrops.map((backdrop) => backdrop.id)];
    return { ...view, backdrop: cycledValue(backdrops, view.backdrop, step) };
  }
  if (id === "sheets") return { ...view, sheets: cycledValue(SHEETS_CHOICES, view.sheets, step) };
  if (id === "text") return { ...view, text: cycledValue(catalogue.textSizes, view.text, step) };
  if (id === "audience") return { ...view, audience: cycledValue(AUDIENCE_IDS, view.audience, step) };
  if (id !== "width") return undefined;
  const widths: StageWidth[] = ["fill", ...catalogue.widths.map((preset) => preset.width)];
  return { ...view, width: cycledValue(widths, view.width, step) };
};

/**
 * The view with a control moved on by a step, or none when the control cannot be set now.
 *
 * @param view - the view shown.
 * @param id - the control's id.
 * @param step - 1 forward, -1 back.
 * @param catalogue - the controls' values.
 * @param fixed - what the shown story fixes of the view.
 * @param isStoryPage - whether a story's page is shown (the compare view draws there).
 */
export const cycledView = (
  view: ViewState,
  id: string,
  step: 1 | -1,
  catalogue: CycledCatalogue,
  fixed: FixedView,
  isStoryPage: boolean
): ViewState | undefined => {
  // the compare view draws each cell at its own width: the width control is off there, its key too
  if (isStoryPage && (view.compare.includes(id) || (id === "width" && isComparing(view)))) return undefined;
  const each = catalogue.switches.find((candidate) => candidate.id === id);
  if (each !== undefined) {
    if (fixed.switches[id] !== undefined) return undefined;
    const current = view.switches[id] ?? each.default;
    return withSwitch(view, each, cycledValue(switchValues(each), current, step));
  }
  const isFixed =
    (id === "backdrop" && fixed.backdrop !== undefined) || (id === "width" && fixed.width !== undefined);
  if (isFixed) return undefined;
  return cycledOwn(view, id, step, catalogue);
};
