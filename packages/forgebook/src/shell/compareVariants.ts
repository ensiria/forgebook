/**
 * The frames of the compare view: the story once per value of one switch, or of two (the theme at both contrasts),
 * or per text size or style sheets, each with its label.
 *
 * @remarks
 * Every value of a switch is drawn, its default too, so the frames show where the story starts; only the colour
 * scheme's system value is left out, since it draws as light or as dark, one of the others. A value that writes
 * nothing on the root (`isUnset`: the stories' own text, left to right, the mouse) is a value like the rest. In a pair, a cell's label leaves out the second switch's default (`Light`, `Light · More contrast`), so the familiar
 * value reads alone. A cell another switch's value contradicts is left out (a look drawn only for dark, at light): it
 * would draw the same as the cell of the implied value, under a name that is not what it shows. Pure.
 *
 * @module
 */

import type { CatalogueSettings } from "../catalogue.ts";
import { shownSwitches } from "../switches.ts";
import { type CompareAxes, SHEETS_CHOICES, type ViewState } from "../viewState.ts";
import { LATER_STRINGS } from "./laterStrings.ts";
import { STRINGS } from "./strings.ts";

/** What the compare view reads of the catalogue: its switches and its text sizes. */
export type CompareCatalogue = Pick<CatalogueSettings, "switches" | "textSizes">;

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
 * @param catalogue - the catalogue's switches and text sizes.
 */
const axisVariants = (axis: string, catalogue: CompareCatalogue): AxisVariant[] => {
  if (axis === "text") {
    return catalogue.textSizes.map((text) => ({
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
  const each = catalogue.switches.find((candidate) => candidate.id === axis);
  if (each === undefined) return [];
  return each.values
    .filter((value) => value.scheme !== "system")
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
 * @param catalogue - the catalogue's switches and text sizes.
 * @param view - the stage's view, whose other switches may imply a compared one.
 */
export const compareVariants = (
  axes: CompareAxes,
  catalogue: CompareCatalogue,
  view: ViewState
): CompareVariant[] => {
  const [first, second] = axes;
  if (first === undefined) return [];
  const firsts = axisVariants(first, catalogue);
  const cells: CompareVariant[] =
    second === undefined
      ? firsts
      : axisVariants(second, catalogue).flatMap((outer) =>
          firsts.map((inner) => ({
            label: LATER_STRINGS.compareCell(outer.isDefault ? [inner.label] : [inner.label, outer.label]),
            viewOf: (stage: ViewState): ViewState => outer.viewOf(inner.viewOf(stage))
          }))
        );
  return cells.filter((cell) => {
    const { switches } = cell.viewOf(view);
    const shown = shownSwitches(switches, catalogue.switches);
    return axes.every((axis) => shown[axis] === switches[axis]);
  });
};
