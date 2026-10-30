/**
 * A view's switches as the toolbar reads and sets them: a switch's value in a view, and a view with one switch set.
 *
 * @module
 */
import type { ViewSwitch } from "../switches";
import type { ViewState } from "../viewState";

/**
 * A view with one switch set.
 *
 * @param view - the view.
 * @param each - the switch.
 * @param value - its new value.
 */
export const withSwitch = (view: ViewState, each: ViewSwitch, value: string): ViewState => ({
  ...view,
  switches: { ...view.switches, [each.id]: value }
});

/**
 * A switch's value in a view.
 *
 * @param view - the view.
 * @param each - the switch.
 */
export const switchValueIn = (view: ViewState, each: ViewSwitch): string =>
  view.switches[each.id] ?? each.default;
