/**
 * The badge's stories.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/solid";

import { Badge } from "./Badge.tsx";

export default { title: "Inputs/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The badge with its label. */
export const Default: Story<typeof Badge> = { args: { label: "New" } };
