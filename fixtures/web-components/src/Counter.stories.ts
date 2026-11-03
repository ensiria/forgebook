/**
 * An element named by its class, whose own state new args keep.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/web-components";

import { FixtureCounter } from "./FixtureCounter";

export default { title: "Inputs/Counter", component: FixtureCounter } satisfies Meta<typeof FixtureCounter>;

/** A counter. */
export const Default: Story<typeof FixtureCounter> = { args: { label: "Clicks" } };
