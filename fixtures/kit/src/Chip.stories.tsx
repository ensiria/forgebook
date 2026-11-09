/**
 * The chip's story, with no `argTypes`: both its icons are set by the kit's icon picker, one typed through an alias.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { Chip } from "./Chip";

export default { title: "Actions/Chip", component: Chip } satisfies Meta<typeof Chip>;

/** A chip with a text alone: its icons are the panel's to add. */
export const Basic: Story<typeof Chip> = { args: { label: "Filter" } };
