/**
 * A directive's story: its template uses the directive on an element.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/angular";

import { Tooltip } from "./tooltip.directive";

export default { title: "Inputs/Tooltip", component: Tooltip, args: { fbTooltip: "Saved" } } satisfies Meta<
  typeof Tooltip
>;

/** On a button. */
export const OnButton: Story<typeof Tooltip> = {
  render: (args) => ({ props: args, template: `<button type="button" [fbTooltip]="fbTooltip">Save</button>` })
};
