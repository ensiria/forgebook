/**
 * An `async setup`: the story is drawn, and its play runs, once what it awaits has come.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/vue";

import Awaited from "./Awaited.vue";

export default { title: "States/Awaited", component: Awaited } satisfies Meta<typeof Awaited>;

/** The component, awaited. */
export const Default: Story<typeof Awaited> = {
  play: async ({ canvas }) => {
    canvas.getByTestId("awaited");
  }
};
