/**
 * The meter's stories.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/preact";

import { Meter } from "./Meter.tsx";

export default { title: "Data/Meter", component: Meter } satisfies Meta<typeof Meter>;

/** Half full. */
export const Half: Story<typeof Meter> = { args: { value: 0.5, label: "Storage" } };
