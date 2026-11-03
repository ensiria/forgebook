/**
 * The stories the reader takes the badge, its subcomponent and its selector from.
 *
 * @module
 */
import type { Meta } from "@forgebook/angular";

import { Badge } from "./badge.component.ts";
import { Tooltip } from "./tooltip.directive.ts";

export default { title: "Badge", component: Badge, subcomponents: { Tooltip } } satisfies Meta<typeof Badge>;

/** The Default story. */
export const Default = { args: { label: "New" } };
