/**
 * An error while drawing, reported by the frame and left behind when the value changes. Marked untested: a story that
 * throws on purpose would fail the server's tests.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/solid";

import { Fragile } from "./Fragile";

export default { title: "States/Fragile", component: Fragile, tags: ["!test"] } satisfies Meta<
  typeof Fragile
>;

/** Fine, until the panel says `boom`. */
export const Default: Story<typeof Fragile> = { args: { text: "Fine" } };
