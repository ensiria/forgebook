/**
 * The stories of a directive, read by its attribute selector.
 *
 * @module
 */
import { Tooltip } from "./tooltip.directive.ts";

export default { title: "Tooltip", component: Tooltip };

/** The Default story. */
export const Default = {
  render: (): { readonly template: string } => ({ template: `<button fbTooltip="Hi">Hover</button>` })
};
