/**
 * An element that breaks for one value: the frame shows its error and leaves it when the value changes back.
 *
 * @module
 */
import "./FixtureFragile";

import type { Meta, Story } from "@forgebook/web-components";

export default { title: "States/Fragile", component: "fixture-fragile" } satisfies Meta<"fixture-fragile">;

/** A text that breaks for `boom`. */
export const Default: Story<"fixture-fragile"> = { args: { text: "Fine" } };
