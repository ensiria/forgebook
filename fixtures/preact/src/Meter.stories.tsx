/**
 * A class component: its props read from what it is constructed with, drawn by Preact.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/preact";

import { Meter } from "./Meter";

export default { title: "Data/Meter", component: Meter } satisfies Meta<typeof Meter>;

/** Half full. */
export const Half: Story<typeof Meter> = { args: { value: 0.5, label: "Storage" } };
