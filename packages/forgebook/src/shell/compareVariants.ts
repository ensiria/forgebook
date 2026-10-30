/**
 * The frames of the compare view: the story once per value of one switch, or of two (the theme at both contrasts),
 * or per text size or style sheets, each with its label.
 *
 * @remarks
 * A switch's unset value (the system's theme, the library's own motion) is left out: it draws one of the others. In
 * a pair, a cell's label leaves out the second switch's default (`Light`, `Light · More contrast`), so the familiar
 * value reads alone. Pure.
 *
 * @module
 */

import type { ViewSwitch } from "../switches";
import { type CompareAxes, SHEETS_CHOICES, TEXT_SCALES, type ViewState } from "../viewState";
import { STRINGS } from "./strings";

/** One frame of the compare view. */
export type CompareVariant = {
  /** What the frame shows, under it. */
  readonly label: string;
  /**
   * The view the frame draws in: the stage's, with the compared values set.
   *
   * @param view - the stage's view.
   */
  readonly viewOf: (view: ViewState) => ViewState;
};

/** A value of one axis: a variant, and whether it is its switch's default (Forgebook's own axes have none). */
type AxisVariant = CompareVariant & {
  /** Whether the value is its switch's default. */
  readonly isDefault: boolean;
};

/**
 * The values one axis sets, each with its label.
 *
 * @param axis - a switch's id, `text` or `sheets`.
 * @param switches - the catalogue's switches.
 */
const axisVariants = (axis: string, switches: readonly ViewSwitch[]): AxisVariant[] => {
  if (axis === "text") {
    return TEXT_SCALES.map((text) => ({
      label: STRINGS.textScale(text),
      isDefault: false,
      viewOf: (view: ViewState): ViewState => ({ ...view, text })
    }));
  }
  if (axis === "sheets") {
    return SHEETS_CHOICES.map((sheets) => ({
      label: STRINGS.sheetChoices[sheets],
      isDefault: false,
      viewOf: (view: ViewState): ViewState => ({ ...view, sheets })
    }));
  }
  const each = switches.find((candidate) => candidate.id === axis);
  if (each === undefined) return [];
  return each.values
    .filter((value) => value.isUnset !== true)
    .map((value) => ({
      label: value.label,
      isDefault: value.value === each.default,
      viewOf: (view: ViewState): ViewState => ({
        ...view,
        switches: { ...view.switches, [each.id]: value.value }
      })
    }));
};

/**
 * The frames of the compare view: one per value of its axis, or per pair of values of its two axes (the second
 * outermost: every theme at the standard contrast, then at more).
 *
 * @param axes - the compared axes.
 * @param switches - the catalogue's switches.
 */
export const compareVariants = (axes: CompareAxes, switches: readonly ViewSwitch[]): CompareVariant[] => {
  const [first, second] = axes;
  if (first === undefined) return [];
  const firsts = axisVariants(first, switches);
  if (second === undefined) return firsts;
  return axisVariants(second, switches).flatMap((outer) =>
    firsts.map((inner) => ({
      label: STRINGS.compareCell(outer.isDefault ? [inner.label] : [inner.label, outer.label]),
      viewOf: (view: ViewState): ViewState => outer.viewOf(inner.viewOf(view))
    }))
  );
};
