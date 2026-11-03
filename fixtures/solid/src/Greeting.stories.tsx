/**
 * The story's texts and clock, read with Solid's accessors.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/solid";

import { Greeting } from "./Greeting";

export default { title: "States/Greeting", component: Greeting } satisfies Meta<typeof Greeting>;

/** A Live story: the clock starts at its moment and runs. */
export const Live: Story<typeof Greeting> = { parameters: { clock: { start: "2030-01-01T10:00:00Z" } } };
