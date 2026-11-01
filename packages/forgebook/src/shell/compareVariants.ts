/**
 * The frames of the compare view: the story once per value of one switch, or of two (the theme at both contrasts),
 * or per text size or style sheets, each with its label.
 *
 * @remarks
 * Every value of a switch is drawn, its default too, so the frames show where the story starts; only the colour
 * scheme's system value is left out, since it draws as light or as dark, one of the others. A value that writes
 * nothing on the root (`isUnset`: the stories' own text, left to right, the mouse) is a value like the rest. In a pair, a cell's label leaves out the second switch's default (`Light`, `Light · More contrast`), so the familiar
 * value reads alone. Pure.
 *
 * @module
 */

import type { CatalogueSettings } from "../catalogue.ts";
import { type CompareAxes, SHEETS_CHOICES, type ViewState } from "../viewState.ts";
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
 */
export const compareVariants = (axes: CompareAxes, catalogue: CompareCatalogue): CompareVariant[] => {
  const [first, second] = axes;
  if (first === undefined) return [];
  const firsts = axisVariants(first, catalogue);
  if (second === undefined) return firsts;
  return axisVariants(second, catalogue).flatMap((outer) =>
    firsts.map((inner) => ({
      label: STRINGS.compareCell(outer.isDefault ? [inner.label] : [inner.label, outer.label]),
      viewOf: (view: ViewState): ViewState => outer.viewOf(inner.viewOf(view))
    }))
  );
};
